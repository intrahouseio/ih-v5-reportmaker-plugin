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
  const { agentName, agentPath, ...opt } = plugin.params.data;

  // Загрузить словари (пока только months)
  const lang = plugin.params.data.lang || 'en';
  dict.start(path.resolve(__dirname, './locale'), lang);

  // Подключиться к БД
  const sqlclientFilename = agentPath + '/lib/sqlclient.js';
  if (!fs.existsSync(sqlclientFilename)) throw { message: 'File not found: ' + sqlclientFilename };
  const Client = require(sqlclientFilename);
  let client = new Client(opt);
  await client.connect();
  plugin.log('Connected to ' + agentName);

  plugin.onCommand(async mes => {
    if (mes.command == 'report') return reportRequest(mes);
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

    const sqlStr = client.prepareQuery(query);
    plugin.log('SQL: ' + sqlStr);

    // Выполнить запрос
    let arr = [];
    if (sqlStr) {
      arr = await client.query(sqlStr);
    }

    // результат преобразовать в массив объектов
    // внутри объекта - переменные отчета со значениями
    if (arr && arr.length && mes.reportVars && mes.reportVars.length) {
      return rollup(arr, mes);
    }
    return [];
  }
};
