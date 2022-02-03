/**
 * app.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const dict = require('./dict');
const reportutil = require('./lib/reportutil');
const makecsv = require('./lib/makecsv');
const makepdf = require('./lib/makepdfjs');

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
      // Подготовить запрос или запрос уже готов
      const query = mes.sql || { ...mes.filter };
      if (query.end2) query.end = query.end2;

      const sqlStr = client.prepareQuery(query);
      plugin.log('SQL: ' + sqlStr);

      // Выполнить запрос, результат преобразовать в массив массивов
      let res = [];
      if (sqlStr) {
        const arr = await client.query(sqlStr);
        res = reportutil.processReportResult(mes, arr);
      }

      const targetFolder = mes.targetFolder || './';
      let rName = mes.reportName + '_' + Date.now();
      let filename;
      if (mes.content == 'pdf') {
        filename = path.resolve(targetFolder, rName + '.pdf');

        // Обработать mes.makeup_elements - отсортировать, обработать макроподстановки
        const elements = reportutil.processMakeupElements(mes.makeup_elements, mes.filter, res, plugin);
        makepdf(elements, res, filename);
        // console.log('MAKE PDF ' + filename);
      } else if (mes.content == 'csv') {
        filename = path.resolve(targetFolder, rName + '.csv');
        const columns = reportutil.getTableColumnsFromMakeup(mes.makeup_elements);
        if (!columns) throw { message: 'Not found table element!' };

        await makecsv(columns, res, filename);
      }
      if (!filename) throw { message: 'Expected content: pdf, csv' };

      respObj.payload = { content: mes.content, filename };
      respObj.response = 1;
    } catch (e) {
      respObj.error = e.message;
      respObj.response = 1;
    }

    plugin.send(respObj);
    plugin.log('SEND RESPONSE ' + util.inspect(respObj));
    // console.log('SEND RESPONSE ' + util.inspect(respObj));
  }
};
