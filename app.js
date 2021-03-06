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
const makecsv = require('./lib/makecsv');
const makepdf = require('./lib/makepdfjs');
const rollup = require('./lib/rollup2');

module.exports = async function(plugin) {
  const { agentName, agentPath, customFolder, useIds, ...opt } = plugin.params.data;

  // Загрузить словари (пока только months)
  const lang = plugin.params.data.lang || 'en';
  dict.start(path.resolve(__dirname, './locale'), lang);

  // Путь к пользовательским таблицам
  scriptapi.customFolder = customFolder;

  // Подключиться к БД
  const sqlclientFilename = agentPath + '/lib/sqlclient.js';
  if (!fs.existsSync(sqlclientFilename)) throw { message: 'File not found: ' + sqlclientFilename };
  const Client = require(sqlclientFilename);
  let client = new Client(opt);
  await client.connect();
  plugin.log('Connected to ' + agentName);

  plugin.onCommand(async mes => {
    if (mes.command == 'report') return reportRequest(mes);
    if (mes.command == 'chart') return chartRequest(mes);
  });

  async function reportRequest(mes) {
    const respObj = { id: mes.id, type: 'command' };
    try {
      let res = []; // Массив объектов для формирования отчета

      if (mes.process_type == 'ufun') {
        // Запустить пользовательский обработчик
        const filename = mes.uhandler;
        if (!filename || !fs.existsSync(filename)) throw { message: 'Script file not found: ' + filename };

        hut.unrequire(filename);
        try {
          res = await require(filename)(mes.reportVars, mes.devices, client, mes.filter, scriptapi);
        } catch (e) {
          plugin.log('Script error: ' + util.inspect(e));
          throw { message: 'Script error: ' + hut.getShortErrStr(e) };
        }
      } else {
        res = await getRes(mes);
      }

      const targetFolder = mes.targetFolder || './';
      let rName = mes.reportName + '_' + Date.now();

      let filename;
      if (mes.content == 'pdf') {
        // Обработать mes.makeup_elements - отсортировать, обработать макроподстановки
        const elements = reportutil.processMakeupElements(mes.makeup_elements, mes.filter, res, mes.reportVars);

        filename = path.resolve(targetFolder, rName + '.pdf');
        makepdf(elements, res, filename, mes);
      } else if (mes.content == 'csv') {
        const columns = reportutil.getTableColumnsFromMakeup(mes.makeup_elements);
        if (!columns) throw { message: 'Not found table element!' };

        filename = path.resolve(targetFolder, rName + '.csv');
        await makecsv(columns, res, filename, mes);
      }

      if (!filename) throw { message: 'Expected content: pdf, csv' };

      respObj.payload = { content: mes.content, filename };
      respObj.response = 1;
    } catch (e) {
      console.log('ERROR: ' + util.inspect(e));
      respObj.error = e;
      respObj.response = 0;
    }

    plugin.send(respObj);
    plugin.log('SEND RESPONSE ' + util.inspect(respObj));
  }

  async function getRes(mes) {
    // Подготовить запрос или запрос уже готов
    const query = mes.sql || { ...mes.filter };
    if (query.end2) query.end = query.end2;
    query.ids = mes.ids;
    plugin.log('query.ids: ' + query.ids);
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
      return rollup(arr, mes);
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
      plugin.log(
        'Remap error for query.ids=' + query.ids + ' query.dn_prop=' + query.dn_prop + ' : ' + util.inspect(e)
      );
    }
    return arr;
  }

  // Формирование данных графиков со сверткой или пользовательскими скриптами
  async function chartRequest(mes) {
    const respObj = { id: mes.id, type: 'command' };
    try {
      let res = []; // Массив объектов для формирования графика

      if (mes.process_type == 'ufun') {
        // Запустить пользовательский обработчик
      } else {
        res = await getChartRes(mes);
      }

      respObj.payload = res;
      respObj.response = 1;
    } catch (e) {
      console.log('ERROR: ' + util.inspect(e));
      respObj.error = e;
      respObj.response = 0;
    }

    plugin.send(respObj);
    plugin.log('SEND RESPONSE ' + util.inspect(respObj));
  }

  async function getChartRes(mes) {
      // Подготовить запрос или запрос уже готов
      const query = mes.sql || { ...mes.filter };
      if (query.end2) query.end = query.end2;
  
      const sqlStr = client.prepareQuery(query);
      plugin.log('SQL: ' + sqlStr);
  
      // Выполнить запрос
      let arr = [];
      if (sqlStr) {
        arr = await client.query(sqlStr);
      }
  
      // результат преобразовать в массив объектов
    if (arr && arr.length) {
        mes.trend = 1;
        
        return rollup(arr, mes);
      }
      return [];
  }
};
