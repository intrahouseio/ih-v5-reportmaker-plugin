const child = require('child_process');
const util = require('util');

const options = {
  syspath: '/opt/ih-v5',

  logfile: '/opt/ih-v5/log/ih_reportmaker.log',
  dbagent: 'sqlite'
};

let ps = child.fork('./index.js', [JSON.stringify(options)]);

ps.on('message', msg => {
  console.log('MAIN GET message' + util.inspect(msg));
  if (msg.type == 'get') {
    const data = {
      agentName: 'sqlite',
      agentPath: '/var/lib/intrahouse-d/agents/sqlite',
      level: 2,
      dbPath: '/var/lib/intrahouse-d/projects/Yrus_fromBERRY/db/hist.db'
      // dbPath: '/var/lib/intrahouse-d/projects/miheev_ih_1634130787995/db/hist.db'
    };
    ps.send({ id: msg.id, uuid: msg.id, type: 'get', data, response: 1 });
  } else if (msg.type == 'command') {
    console.log('Get Command response!');
  }
});

setTimeout(() => {
  const end = Date.now();
  const start = new Date(2021, 11, 15, 11).getTime();

  // const msg = { type: 'command', command: 'report', id: 'main', uuid: 33, start, end, dn_prop:'VMETER001.value,VMETER002.value,VMETER001.uptoMin,VMETER002.uptoMin'  };
  const readobj = {
    columns: [
      { col_type: 'date', name: 'Дата', width: '20' },
      { col_type: 'value', calc_type: 'max', name: 'Счетчик 1 показания', dn: 'VMETER001', prop: 'value', width: '20' },
      { col_type: 'value', calc_type: 'max', name: 'Счетчик 2 показания', dn: 'VMETER002', prop: 'value', width: '20' },
      {
        col_type: 'value',
        calc_type: 'max',
        name: 'Счетчик 1 на начало',
        dn: 'VMETER001',
        prop: 'uptoMin',
        width: '20'
      },
      {
        col_type: 'value',
        calc_type: 'max',
        name: 'Счетчик 2 на начало',
        dn: 'VMETER002',
        prop: 'uptoMin',
        width: '20'
      }
    ],

    content: {
      discrete: 'day',
      blocks: [
        {
          block_type:'text',
          text: 'Отчет энергопотребления',
          fontSize:  16,
          bold: 0,
          italics: 0,
          align: 'center',
          marginLeft: 5,
          marginTop: 5, 
          marginRight: 5, 
          marginBottom:5
        },
        {
          block_type:'table',
          rowHeight: 14
        }
      ]
    },

    filter: { start, end, dn_prop: 'VMETER001.value,VMETER001.uptoMin,VMETER002.value,VMETER002.uptoMin' }
  };

  /*
  const msg = {
    type: 'command',
    command: 'report',
    id: 'main',
    uuid: 33,
    start,
    end,
    dn_prop: 'VMETER001.value,VMETER002.value,VMETER001.uptoMin,VMETER002.uptoMin'
  };
  */

  const msg = {
    type: 'command',
    command: 'report',
    id: 'main',
    repid: 'r001',
    ...readobj
  };

  console.log('MAIN send message' + util.inspect(msg));
  ps.send(msg);
}, 1000);

// select * from records  WHERE  (  ( dn = 'VMETER001' AND prop = 'value' ) OR  ( dn = 'VMETER002' AND prop = 'value' ) OR  ( dn = 'VMETER001' AND prop = 'uptoMin' ) OR  ( dn = 'VMETER002' AND prop = 'uptoMin' ) )  AND  ts >= 1639555200000 AND  ts <= 1639559922688 order by ts
// select * from records  WHERE  (  ( dn = 'VMETER001' AND prop = 'value' ) OR  ( dn = 'VMETER001' AND prop = 'uptoMin' ) OR  ( dn = 'VMETER002' AND prop = 'value' ) OR  ( dn = 'VMETER002' AND prop = 'uptoMin' ) )  AND  ts >= 1639555200000 AND  ts <= 1639563571320 order by ts
