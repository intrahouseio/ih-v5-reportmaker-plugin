const util = require('util');
const fs = require('fs');
const path = require('path');

const reportutil = require('./lib/reportutil');
const makecsv = require('./lib/makecsv');
const makepdf = require('./lib/makepdfjs');
// const makepdf = require('./lib/makepdf');

module.exports = async function(plugin) {
  const { agentName, agentPath, ...opt } = plugin.params.data;

  // Подключиться к БД?
  const sqlclientFilename = agentPath + '/lib/sqlclient.js';
  if (!fs.existsSync(sqlclientFilename)) throw { message: 'File not found: ' + sqlclientFilename };
  const Client = require(sqlclientFilename);
  let client = new Client(opt);

  await client.connect();
  plugin.log('Connected to ' + agentName);

  plugin.onCommand(async mes => {
    console.log('GET COMMAND mes=' + util.inspect(mes));
    if (mes.command == 'report') return reportRequest(mes);
  });

  async function reportRequest(mes) {
    let respObj;
    try {
      // Подготовить запрос или запрос уже готов
      const query = mes.sql || mes.filter;
      console.log('before client.prepareQuery ' + util.inspect(query));
      const sqlStr = client.prepareQuery(query);
      plugin.log('SQL: ' + sqlStr);
      console.log('SQL: ' + sqlStr);

      // Выполнить запрос
      let res = [];
      if (sqlStr) {
        const arr = await client.query(sqlStr);
        res = reportutil.processReportResult(mes, arr);
      }

      const targetFolder = mes.targetFolder || './';

      let payload;
      // if (mes.content == 'pdf') {
      const filename = path.resolve(targetFolder, mes.reportName +'_'+ Date.now() + '.pdf');
      makepdf(mes.makeup_elements, res, filename);
      payload = { content: 'pdf', filename };

      respObj = { id: mes.id, type: 'command', response: 1, payload };

      plugin.log('SEND RESPONSE ' + util.inspect({ id: mes.id, type: 'command', response: 1 }));
    } catch (e) {
      respObj = { id: mes.id, type: 'command', response: 0, error: e.message };
      plugin.log('Reportmaker error:' + util.inspect(e));
      console.log('Reportmaker error:' + util.inspect(e));
    }

    plugin.send(respObj);
    plugin.log('SEND RESPONSE ' + util.inspect(respObj));
    console.log('SEND RESPONSE ' + util.inspect(respObj));
  }
};
