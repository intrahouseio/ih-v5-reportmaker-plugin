/**
 * aggutil.js
 *
 *  reportVars: {Array of Objects} - описание переменных отчета
 *    [{id, dn_prop, varname, calc_type (min,max,sum), col_type(value,date,sn?,rowcalc/itog-формула???) }, ]
 */

const util = require('util');

const dateutils = require('./dateutils');

exports.checkAggFunc = checkAggFunc;
exports.getAggFunc = getAggFunc;
exports.formDataForReport = formDataForReport;

const enableFunc = ['min', 'max', 'count', 'sum', 'avg'];
const dateFieldNames = ['year', 'month', 'day', 'hour', 'minute'];

function checkAggFunc(reportVars) {
  if (!reportVars || !Array.isArray(reportVars)) throw { message: 'No reportVars!' };
  reportVars.forEach(item => {
    if (item.calc_type) {
      if (!enableFunc.includes(item.calc_type))
        throw { message: 'No SQL aggregate function for ' + item.calc_type + '. Query without aggregation will be used.' };
    }
  });
}

function getAggFunc(reportVars) {
  if (!reportVars || !Array.isArray(reportVars)) return [];
  const fnSet = new Set();
  reportVars.forEach(item => {
    if (item.calc_type) {
      if (enableFunc.includes(item.calc_type)) fnSet.add(item.calc_type);
    }
  });
  return [...fnSet];
}

function formDataForReport(arr, mes, plugin) {
  if (!arr || !arr.length) return [];
  const reportVars = mes.reportVars;
  const discrete = mes.discrete;
  const reportDateformat = mes.reportDateformat || '';

  const mapIndex = getMapIndex(reportVars);

  const data = [];
  let period = '';
  let curperiod;
  let strObj = {};
  let rownumber = 0;
  arr.forEach(item => { 
    curperiod = getCurperiod(item); // Эта строка зависит дискреты

    if (!period) {
      period = curperiod;
    } else if (period != curperiod) {
      addRowObj(strObj);
      period = curperiod;
    }

    const dn_prop = item.dn + '.' + item.prop;
    if (mapIndex[dn_prop]) {
      const mapArr = mapIndex[dn_prop];
      for (const mapItem of mapArr) {
        if (mapItem.col_type == 'value') {
          strObj[mapItem.varname] = item[mapItem.calc_type];
        }
      }
    }
  });
  
  period = curperiod;
  addRowObj(strObj);
  return data;

  function getCurperiod(item) {
    let str = '';
    for (let fname of dateFieldNames) {
      str += item[fname] + ',';
      if (fname == discrete) return str;
    }
    return str;
  }

  function addRowObj(devObj) {
    rownumber += 1;
    const dateObj = getDateCols(...period.split(','));
    const oneRowObj = { ...dateObj, ...devObj };
    processCalcFields(oneRowObj);
    formatNumberFields(oneRowObj);
    data.push(oneRowObj);
  }

  function processCalcFields(obj) {
    // По формулам нужно считать когда есть все остальные значения
    reportVars.forEach(item => {
      if (item.col_type == 'calc') {
        try {
          obj[item.varname] = item.calcFn(strObj);
        } catch (e) {
          obj[item.varname] = '';
        }
      } else if (item.col_type == 'rownumber') {
        obj[item.varname] = rownumber;
      }
    });
  }

  function getDateCols(year, month = 1, day = 1, hour = 0, minute = 0 ) {
    const dt1 = new Date(year, month-1, day, hour, minute);
    const dt2 = getLastDt(dt1);
    const resObj = {};
    reportVars
      .filter(item => item.col_type == 'dt')
      .forEach(item => {
        resObj[item.varname] = dateFormat({ dt1, dt2 }, item.calc_row, reportDateformat);
      });
    return resObj;
  }

  function getLastDt(dt) {
    switch (discrete) {
      case 'year':
        return new Date(dt.getFullYear(), 11, 31, 23, 59, 59, 999); // 31.12
      case 'month':
        return new Date(dt.getFullYear(), dt.getMonth() + 1, 0, 23, 59, 59, 999);
      case 'day':
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);
      case 'hour':
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), 59, 59, 999);

      case 'min':
      case 'minute':
          return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), dt.getMinutes(), 59, 999);
      default:
        return dt;
    }
  }

  function formatNumberFields(one) {
    reportVars
      .filter(item => item.col_type == 'calc' || item.col_type == 'value')
      .forEach(item => {
        let val = one[item.varname];
        if (typeof val == 'number') {
          val = val.toFixed(item.decdig);
          one[item.varname] = val;
        }
      });
  }
}

// let mapIndex = {}; // {'VMETER1.val':[{varname:'meter1, col_type:'value,.. }, {}]}
function getMapIndex(reportVars) {
  const varnames = reportVars.map(item => item.varname).filter(el => el);

  let mapIndex = {};
  reportVars.forEach(item => {
    if (item.dn_prop && item.col_type == 'value') {
      if (!mapIndex[item.dn_prop]) mapIndex[item.dn_prop] = [];
      mapIndex[item.dn_prop].push(item);
    } else if (item.col_type == 'calc') {
      if (item.calc_row) {
        item.calcFn = new Function('{' + varnames.join(',') + '}', 'return ' + item.calc_row);
      }
    }
  });
  return mapIndex;
}

function dateFormat({ dt1, dt2 }, calc, reportDateformat) {
  try {
    switch (calc) {
      case '__dtstart_column':
        return dateutils.getDateTimeFor(dt1, reportDateformat);
      case '__dtend_column':
        return dateutils.getDateTimeFor(dt2, reportDateformat);
      case '__dtperiod_column':
        return dateutils.getDateTimeFor(dt1, reportDateformat) + ' - ' + dateutils.getDateTimeFor(dt2, reportDateformat);
      default:
        return '';
    }
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    return 'Ошибка даты!';
  }
}
