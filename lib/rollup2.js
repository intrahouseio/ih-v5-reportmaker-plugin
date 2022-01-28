/**
 * rollup2.js
 * Свертка массива, полученного из БД
 * Результат - массив объектов [{date:yy, meter1:xx, day_total:1000}]
 */

const util = require('util');
const dateutils = require('./dateutils');

/**
 * @param {Array of arrays} arr - данные, полученные из БД, упорядочены по ts
 *        [[ts,dn,prop,val],...]
 * @param {String} discrete - дискрета для свертки
 *        'month','day','hour','min'
 * @param {Array of Objects} reportVars - описание переменных отчета
 *        [{id, dn_prop, varname, calc_type (min,max,sum), col_type(value,date,sn?,rowcalc/itog-формула???) - нужно добавить!!}, ]
 *
 * @return {Array of Objects} - массив объектов, внутри объекта - переменные отчета со значениями
 *         + период (начало-конец?)
 *         [{ts, date:'', meter1:12, meter2:345}]
 */
module.exports = function rollup(arr, discrete, reportVars, reportDateformat) {
  if (!arr || !Array.isArray(arr) || !arr.length || !reportVars || !Array.isArray(reportVars)) return [];

  const result = []; // Результат - массив объектов

  // В зависимости от дискреты заполнить поле dtx из ts (YYMMDDHH)
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].ts) arr[i].dtx = discrete ? transform(arr[i].ts, discrete) : arr[i].ts;
  }

  let sn = 0;
  let j = 0;

  let vals = {}; // {meter1:22} - накапливаются данные строки по формуле
  let counts = {}; // {meter1:1} - накапливается число записей в БД

  let mapIndex = {}; // {'VMETER1.val':[{varname:'meter1, col_type:'value,.. }, {}]}

  // Создать массив varname
  const varnames = reportVars.map(item => item.varname).filter(el => el);

  reportVars.forEach(item => {
    if (item.dn_prop && item.col_type == 'value') {
      if (!mapIndex[item.dn_prop]) mapIndex[item.dn_prop] = [];
      mapIndex[item.dn_prop].push(item);
    } else if (item.col_type == 'calc') {
      if (item.calc_row) {
        // Построить функцию и сохранить ее
        item.calcFn = new Function('{' + varnames.join(',') + '}', 'return ' + item.calc_row);
        console.log('FN=' + item.calcFn.toString());
      }
    }
  });

  let curdtx = arr[j].dtx;
  let dn_prop;
  let curval;
  while (j < arr.length) {
    if (curdtx == arr[j].dtx) {
      dn_prop = arr[j].dn + '.' + arr[j].prop;
      curval = Number(arr[j].val);

      // Устройство участвует в отчете
      if (mapIndex[dn_prop]) {
        const mapArr = mapIndex[dn_prop];
        for (const mapItem of mapArr) {
          const varName = mapItem.varname;
          if (vals[varName] == undefined) {
            initVal(mapItem, varName, curval);
            counts[varName] = 0;
          }
          calcVal(mapItem, varName, curval);
          counts[varName] += 1;
        }
      }
      j++;
    } else {
      result.push(getOneRowObj());
      curdtx = arr[j].dtx;
      vals = {};
      counts = {};
    }
  }
  result.push(getOneRowObj());
  return result;

  function initVal(item, varname, val) {
    let ival = val;
    if (item.calc_type) {
      switch (item.calc_type) {
        case 'min':
        case 'max':
        case 'first':
        case 'last':
          ival = val;
          break;

        case 'sum':
        case 'avg':
          ival = 0;
          break;

        default:
          ival = val;
      }
    }
    vals[varname] = ival;
  }

  function calcVal(item, varname, val) {
    if (item.calc_type) {
      switch (item.calc_type) {
        case 'sum':
        case 'avg':
          vals[varname] += val;
          break;

        case 'min':
          if (val < vals[varname]) vals[varname] = val;
          break;

        case 'max':
          if (val > vals[varname]) vals[varname] = val;
          break;

        case 'last': //  first - первое взяли, больше не присваиваем
          vals[varname] = val;
          break;

        default:
          vals[varname] = val;
      }
    } else {
      vals[varname] = val;
    }
  }

  function getOneRowObj() {
    let one = {};
    if (discrete) {
      one.startTs = getStartTsFromDtx(curdtx, discrete);
      one.endTs = getEndTsFromDtx(curdtx, discrete);
    } else one.startTs = curdtx;

    let val = '';
    reportVars.forEach(item => {
      switch (item.col_type) {
        case 'sn': // Номер по порядку
          sn += 1;
          val = String(sn);
          break;

        case 'value': // Значение
          if (item.calc_type == 'avg') {
            val = counts[item.varname] > 0 ? Math.round(vals[item.varname] / counts[item.varname]) : '';
          } else if (item.calc_type == 'count') {
            val = counts[item.varname];
          } else val = vals[item.varname] || '';
          break;

        case 'dt': // Значение
          val = dateFormat(one, item.calc_row);
          break;
        default:
          val = '';
      }
      one[item.varname] = val;
    });

    // По формулам нужно считать когда есть все остальные значения
    reportVars
      .filter(item => item.col_type == 'calc')
      .forEach(item => {
        if (item.calcFn) {
          one[item.varname] = item.calcFn(one);
        }
      });
    return one;
  }

  function dateFormat(one, calc) {
    try {
      const dt1 = new Date(one.startTs);
      const dt2 = new Date(one.endTs);
      switch (calc) {
        case '__dtstart_column':
          return dateutils.getDateTimeFor(dt1, reportDateformat);
        case '__dtend_column':
          return dateutils.getDateTimeFor(dt2, reportDateformat);
        case '__dtperiod_column':
          return (
            dateutils.getDateTimeFor(dt1, reportDateformat) + ' - ' + dateutils.getDateTimeFor(dt2, reportDateformat)
          );
      }
    } catch (e) {
      console.log('ERROR: ' + util.inspect(e));
      return 'Ошибка даты!';
    }
  }
};

// Преобразовать в зависимости от дискреты
function transform(ts, discrete) {
  let dt = new Date(ts);
  let dtx = String(dt.getFullYear() - 2000);
  dtx += pad(dt.getMonth());
  if (discrete == 'month') return dtx;

  dtx += pad(dt.getDate());
  if (discrete == 'day') return dtx;

  dtx += pad(dt.getHours());
  if (discrete == 'hour') return dtx;

  dtx += pad(dt.getMinutes());
  return dtx;
}

function getTsFromDtx(dtx, discrete) {
  let yy = Number(dtx.substr(0, 2)) + 2000;
  let mm = Number(dtx.substr(2, 2));
  let dd = 0;
  let hh = 0;
  let minutes = 0;

  if (discrete == 'month') {
    dd = 1;
    hh = 0;
  } else {
    dd = Number(dtx.substr(4, 2));
    if (discrete == 'day') {
      hh = 0;
    } else {
      hh = Number(dtx.substr(6, 2));
      if (discrete == 'hour') {
        minutes = 0;
      } else {
        minutes = Number(dtx.substr(8, 2));
      }
    }
  }

  return new Date(yy, mm, dd, hh, minutes).getTime();
}

function getStartTsFromDtx(dtx, discrete) {
  let yy = Number(dtx.substr(0, 2)) + 2000;
  let mm = Number(dtx.substr(2, 2));
  let dd = 0;
  let hh = 0;
  let minutes = 0;

  if (discrete == 'month') {
    dd = 1;
    hh = 0;
  } else {
    dd = Number(dtx.substr(4, 2));
    if (discrete == 'day') {
      hh = 0;
    } else {
      hh = Number(dtx.substr(6, 2));
      if (discrete == 'hour') {
        minutes = 0;
      } else {
        minutes = Number(dtx.substr(8, 2));
      }
    }
  }

  return new Date(yy, mm, dd, hh, minutes).getTime();
}

function getEndTsFromDtx(dtx, discrete) {
  let yy = Number(dtx.substr(0, 2)) + 2000;
  let mm = Number(dtx.substr(2, 2));
  let dd = 0;
  let hh = 0;
  let minutes = 0;

  if (discrete == 'month') {
    dd = 1;
    hh = 0;
    // След месяц
    mm += 1;
    if (mm > 11) {
      mm = 0;
      yy += 1;
    }
  } else {
    dd = Number(dtx.substr(4, 2));
    if (discrete == 'day') {
      hh = 0;
      dd += 1;
    } else {
      hh = Number(dtx.substr(6, 2));
      if (discrete == 'hour') {
        minutes = 0;
        hh += 1;
      } else {
        minutes = Number(dtx.substr(8, 2));
        minutes += 1;
      }
    }
  }
  return new Date(yy, mm, dd, hh, minutes).getTime() - 1000; // -1 сек
}

function pad(val, width) {
  let numAsString = val + '';
  width = width || 2;
  while (numAsString.length < width) {
    numAsString = '0' + numAsString;
  }
  return numAsString;
}
