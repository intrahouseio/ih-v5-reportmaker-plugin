/**
 * app.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const dict = require('./dict');
const hut = require('./lib/hut');
const scriptapi = require('./lib/scriptapi');
const reportutil = require('./lib/reportutil');
const aggutil = require('./lib/aggutil');
const dateutils = require('./lib/dateutils');
const makecsv = require('./lib/makecsv');
const makepdf = require('./lib/makepdfjs');
const rollup = require('./lib/rollup2');
const makexlsx = require('./lib/makexlsx');

module.exports = async function(plugin) {
  const { agentName, agentPath, customFolder, jbaseFolder, useIds, ...opt } = plugin.params.data;

  // Загрузить словари
  const lang = plugin.params.data.lang || 'en';
  dict.start(path.resolve(__dirname, './locale'), lang);

  plugin.apimanager.start(plugin, { customFolder, jbaseFolder, useIds });

  Object.keys(scriptapi).forEach(prop => {
    if (typeof scriptapi[prop] == 'function') {
      plugin.apimanager[prop] = scriptapi[prop];
    }
  });

  // Подключиться к БД
  const sqlclientFilename = agentPath + '/lib/sqlclient.js';
  if (!fs.existsSync(sqlclientFilename)) throw { message: 'File not found: ' + sqlclientFilename };

  const Client = require(sqlclientFilename);
  let client = new Client(opt);
  await client.connect();
  plugin.log('Connected to ' + agentName);

  plugin.onCommand(async mes => {
    if (mes.command == 'report') return reportRequest(mes);
    if (mes.command == 'jreport') return jreportRequest(mes);
  });

  async function reportRequest(mes) {
    const respObj = { id: mes.id, type: 'command' };
    const uuid = mes.debug_uuid;

    try {
      let res = []; // Массив объектов - данные для формирования отчета

      if (mes.process_type == 'ufun') {
        res = await runUhandler(); // Запустить пользовательский обработчик
      } else if (mes.process_type == 'afun') {
        // Свертка
        if (mes.aggsql && agentName == 'sqlite') {
           // Проверить агрегирующие функции
          try {
            aggutil.checkAggFunc(mes.reportVars);
            res = await getResWithAgg(mes); // Свертка с агрегированием SQL
          } catch (e) {
            plugin.log(e.message);
            res = await getRes(mes);
          }
        } else {
          res = await getRes(mes);
        }
      } else {
        res = await getRes(mes); // ToDo - нужно без свертки ?? Или сворачивать по ms?
      }

      const targetFolder = mes.targetFolder || './';
      let rName = mes.reportName + '_f' + dateutils.getDateTimeFor(new Date(), 'created');

      let filename;
      if (mes.content == 'pdf') {
        filename = path.resolve(targetFolder, rName + '.pdf');
        // Обработать mes.makeup_elements - отсортировать, обработать макроподстановки
        // Каждую страницу обработать отдельно
        // mes.makeup_elements = [{id:'page_1', landscape:true/false, elements:[] }]
        if (!Array.isArray(mes.makeup_elements)) throw { message: 'Expected array of makeup elements' };
        const page_elements = [];
        mes.makeup_elements.forEach(item => {
          const elements = reportutil.processMakeupElements(item.elements, mes.filter, res, mes.reportVars);
          page_elements.push({ id: item.id, landscape: item.landscape, elements });
        });

        makepdf(page_elements, res, filename, mes);
      } else if (mes.content == 'csv') {
        if (!Array.isArray(mes.makeup_elements)) throw { message: 'Expected array of makeup elements' };
        const tables = [];

        // НУЖНО выгрузить все таблицы - слева направо
        for (const item of mes.makeup_elements) {
          let columns = reportutil.getTableColumnsFromMakeup(item.elements);
          if (columns) {
            tables.push(columns);
          }
        }

        if (!tables.length) throw { message: 'Not found table element!' };
        filename = path.resolve(targetFolder, rName + '.csv');
        await makecsv(tables, res, filename, mes);
      } else if (mes.content == 'xlsx') {
        plugin.log('mes.content = ' + mes.content);
        if (!Array.isArray(mes.makeup_elements)) throw { message: 'Expected array of makeup elements' };
        const tables = [];

        // НУЖНО выгрузить все таблицы - слева направо
        for (const item of mes.makeup_elements) {
          let columns = reportutil.getTableColumnsFromMakeup(item.elements);
          if (columns) {
            tables.push(columns);
          }
        }

        if (!tables.length) throw { message: 'Not found table element!' };
        filename = path.resolve(targetFolder, rName + '.xlsx');
        await makexlsx(tables, res, filename, mes);
      }

      if (!filename) throw { message: 'Expected content: pdf, csv, xlsx' };

      respObj.payload = { content: mes.content, filename };
      respObj.response = 1;
    } catch (e) {
      console.log('ERROR: Reportmaker. ' + util.inspect(e));
      respObj.error = e;
      respObj.response = 0;
    }

    plugin.send(respObj);
    plugin.log('SEND RESPONSE ' + util.inspect(respObj));

    function debug(msg) {
      if (typeof msg == 'object') msg = util.inspect(msg, null, 4);
      plugin.send({ type: 'debug', txt: msg, uuid });
    }

    async function runUhandler() {
      // Запустить пользовательский обработчик
      const filename = mes.uhandler;
      if (!filename || !fs.existsSync(filename)) throw { message: 'Script file not found: ' + filename };

      hut.unrequire(filename);
      let txt = '';
      try {
        txt = 'Start';
        // 'Start\n reportVars =  ' + util.inspect(mes.reportVars) +'\n devices=  ' +util.inspect(mes.devices) +'\n filter =  ' + util.inspect(mes.filter);
        debug(txt);
        const result = await require(filename)(mes.reportVars, mes.devices, client, mes.filter, plugin.apimanager, debug);
        txt = 'Stop\n result =  ' + util.inspect(result);
        debug(txt);
        return result;
      } catch (e) {
        txt = 'Script error: ' + util.inspect(e);
        plugin.log(txt);
        debug(txt);
        throw { message: 'Script error: ' + hut.getShortErrStr(e) };
      }
    }
  }

  async function getResWithAgg(mes) {
    // Пока только SQLite
    const query = { ...mes.filter };
    if (query.end2) query.end = query.end2;
    query.notnull = true; 
    query.discrete = mes.discrete;
    query.aggs = aggutil.getAggFunc(mes.reportVars);

    const sqlStr = client.prepareQueryWithAgg(query, useIds);
    if (!sqlStr) {
      plugin.log('prepareQueryWithAgg failed! No sqlStr');
      return [];
    }

    plugin.log('SQL: ' + sqlStr);
    const arr = await client.query(sqlStr);
    plugin.log('Records: ' + arr.length);
    // результат преобразовать в массив объектов, внутри объекта - переменные отчета со значениями
    return aggutil.formDataForReport(arr, mes, plugin);
  }

  async function getRes(mes) {
    // Подготовить запрос или запрос уже готов
    const query = mes.sql || { ...mes.filter };
    let true_end;
    if (query.end2 && query.end2 != query.end) {
      true_end = query.end;
      query.end = query.end2;
    }
    query.ids = mes.ids;
    plugin.log('query.ids: ' + query.ids);
    query.notnull = true; // Исключить значения null для отчетов

    const sqlStr = client.prepareQuery(query, useIds);
    plugin.log('SQL: ' + sqlStr);

    // Выполнить запрос
    let arr = [];
    if (sqlStr) {
      arr = await client.query(sqlStr);
      // Выполнить обратный маппинг id => dn, prop
      if (useIds) {
        arr = remap(arr, query);
      }
    }

    // результат преобразовать в массив объектов
    // внутри объекта - переменные отчета со значениями
    if (arr && arr.length && mes.reportVars && mes.reportVars.length) {
      plugin.log('Records: ' + arr.length);
      const rolled = rollup(arr, mes);
      if (true_end && rolled.length && true_end<rolled[rolled.length-1].startTs) {
        // Удалить последнюю запись, которую добавили для получения diff
        rolled.pop();
      }
      return rolled;
    }
    return [];
  }

  function remap(arr, query) {
    if (!query.ids || !query.dn_prop) return arr;

    const idArr = query.ids.split(',');
    const dnArr = query.dn_prop.split(',');
    if (idArr.length != dnArr.length) return arr;

    const idMap = {};
    try {
      for (let i = 0; i < idArr.length; i++) {
        const intId = Number(idArr[i]);
        const [dn, prop] = dnArr[i].split('.');
        idMap[intId] = { dn, prop };
      }
      arr.forEach(item => {
        if (item.id && idMap[item.id]) {
          Object.assign(item, idMap[item.id]);
        }
      });
    } catch (e) {
      plugin.log('Remap error for query.ids=' + query.ids + ' query.dn_prop=' + query.dn_prop + ' : ' + util.inspect(e));
    }
    return arr;
  }

  async function jreportRequest(mes) {
    const respObj = { id: mes.id, type: 'command' };
    try {
      let res = mes.data; // Массив объектов для формирования отчета приходит в запросе
      const targetFolder = mes.targetFolder || './';
      let rName = mes.reportName + '_f' + dateutils.getDateTimeFor(new Date(), 'created');

      let filename;
      if (mes.content == 'pdf') {
        filename = path.resolve(targetFolder, rName + '.pdf');
        // Обработать mes.makeup_elements - отсортировать, обработать макроподстановки
        // Каждую страницу обработать отдельно
        // mes.makeup_elements = [{id:'page_1', landscape:true/false, elements:[] }]
        if (!Array.isArray(mes.makeup_elements)) throw { message: 'Expected array of makeup elements' };
        const page_elements = [];
        mes.makeup_elements.forEach(item => {
          const elements = reportutil.processMakeupElements(item.elements, mes.filter, res, mes.reportVars);
          page_elements.push({ id: item.id, landscape: item.landscape, elements });
        });

        makepdf(page_elements, res, filename, mes);
      } else if (mes.content == 'csv' || mes.content == 'xlsx') {
        if (!Array.isArray(mes.makeup_elements)) throw { message: 'Expected array of makeup elements' };
        const tables = [];

        // Выдает первую таблицу - НУЖНО выгрузить все таблицы - слева направо
        for (const item of mes.makeup_elements) {
          // columns = reportutil.getTableColumnsFromMakeup(mes.makeup_elements);
          let columns = reportutil.getTableColumnsFromMakeup(item.elements);
          if (columns) {
            tables.push(columns);
          }
        }

        if (!tables.length) throw { message: 'Not found table element!' };
        switch (mes.content) {
          case 'csv':
            filename = path.resolve(targetFolder, rName + '.csv');
            await makecsv(tables, res, filename, mes);
            break;

          case 'xlsx':
            filename = path.resolve(targetFolder, rName + '.xlsx');
            await makexlsx(tables, res, filename, mes);
            break;

          default:
            throw { message: 'Expected content: pdf, csv, xlsx' };
        }
      }

      if (!filename) throw { message: 'Expected content: pdf, csv, xlsx' };

      respObj.payload = { content: mes.content, filename };
      respObj.response = 1;
    } catch (e) {
      console.log('ERROR: Reportmaker. ' + util.inspect(e));
      respObj.error = e;
      respObj.response = 0;
    }

    plugin.send(respObj);
    plugin.log('SEND RESPONSE ' + util.inspect(respObj));
  }
};
