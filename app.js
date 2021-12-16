const util = require('util');
const fs = require('fs');

const reportutil = require('./lib/reportutil');
const makecsv = require('./lib/makecsv');
const makepdf = require('./lib/makepdf');

module.exports = async function(plugin) {
  let client;

  const { agentName, agentPath, ...opt } = plugin.params.data;

  const sqlclientFilename = agentPath + '/lib/sqlclient.js';
  if (!fs.existsSync(sqlclientFilename)) throw { message: 'File not found: ' + sqlclientFilename };

  // Подключиться к БД?
  const Client = require(sqlclientFilename);
  client = new Client(opt);

  await client.connect();
  plugin.log('Connected to ' + agentName);

  plugin.onCommand(async mes => {
    plugin.log('GET COMMAND mes=' + util.inspect(mes));
    if (mes.command == 'report') return reportRequest(mes);
    /*
    const content = {blocks:[{block_type:'table'}]};
    const columns = [
      {name:'Дата', width:40, align:'left'},
      {name:'Значение', width:40, align:'center'}
    ];
    const data = [['02.02.2020', '42']];

    if (mes.command == 'report') return make({content, columns}, data)
    */
  });

  function make(readobj, data) {
    /*
    makepdf(readobj.content, readobj.columns, data, (err, binary) => {
    if (!err) {
      console.log('makePdf OK!')
      fs.writeFileSync('test.pdf',  binary)
    } else {
      console.log('ERROR:' + JSON.stringify(err));
    }
  });
  */
  }

  async function reportRequest(mes) {
    try {
      // Подготовить запрос или запрос уже готов
      
      const sqlStr = client.prepareQuery(mes.filter);
      plugin.log('SQL: ' + sqlStr);

      // Выполнить запрос
      const arr = await client.query(sqlStr);
      console.log('arr = '+util.inspect(arr)+' LEN='+arr.length);

      // Обработать данные
      // const res = [];
      // const res = rollup(arr, 'hour',mes.columns );
      /*
      const readobj = {
        columns: [
          { col_type: 'date' }, 
          { col_type: 'value', calc_type: 'max', dn: 'VMETER001', prop: 'value'},
          { col_type: 'value', calc_type: 'max', dn: 'VMETER002', prop: 'value'},
          { col_type: 'value', calc_type: 'max', dn: 'VMETER001', prop: 'uptoMin'},
          { col_type: 'value', calc_type: 'max', dn: 'VMETER002', prop: 'uptoMin'}
      ],
        content: { discrete: 'day' }
      };
      */

     // const readobj = {};
     const res = reportutil.processReportResult(mes, arr);

      // const res = [];

      console.log('res = ' + util.inspect(res));

      const targetFolder = './';

      // Сформировать отчет, записать в csv
      const filename = await makecsv(mes.columns, res, targetFolder);

      // Сформировать отчет, записать в csv
      // const filename2 = await makepdf({blocks:[{block_type:'text', text:'Header'}, {block_type:'table'}]}, mes.columns, res, targetFolder);
      const filename2 = await makepdf(mes.content, mes.columns, res, targetFolder);
      // content, columns, tabledata


      // Отправить ответ

      plugin.send({ id: mes.id, type: 'command', filename, filename2, response: 1, payload: res });
      plugin.log('SEND RESPONSE ' + util.inspect({ id: mes.id, type: 'command', response: 1 }));
    } catch (e) {
      plugin.log('sqlclient error:' + util.inspect(e));
      console.log('sqlclient error:' + util.inspect(e));
    }
  }
  // const res = await client.query("SELECT * from records WHERE dn='DTP102_1' AND ts>1636040466773");
  // console.log('RES='+util.inspect(res))
};
