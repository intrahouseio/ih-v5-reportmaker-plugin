/**
 * rollup.js
 * Свертка массива, полученного из БД
 *
 * @param {*} arr
 * @param {*} discrete
 * @param {*} cols
 */

const util = require('util');

module.exports = function rollup(arr, discrete, cols) {
  console.log('rollup arr='+util.inspect(arr))
  console.log('rollup cols='+util.inspect(cols))
  if (!arr || !Array.isArray(arr) || !cols || !Array.isArray(cols)) return [];

  if (arr.length <= 0) return [];

  let result = []; // Результат - массив массивов

  // В зависимости от дискреты заполнить поле dtx из ts (YYMMDDHH)
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].ts) arr[i].dtx = discrete ? transform(arr[i].ts, discrete) : arr[i].ts;
  }

  let sn = 0;
  let j = 0;

  let vals = {};
  let index = {};

  cols.forEach((item, idx) => {
    if (item.dn && item.col_type == 'value') {
      // calcs[idx] = item.calc_type;
      const dn_prop = item.dn+'.'+item.prop;
      if (!index[dn_prop]) index[dn_prop] = [];
      index[dn_prop].push(idx);
    }
  });

  let curdtx = arr[j].dtx;
  let dn_prop;
  let curval;
  while (j < arr.length) {
    if (curdtx == arr[j].dtx) {
      dn_prop = arr[j].dn+'.'+arr[j].prop;
      curval = Number(arr[j].val);

      // Устройство участвует в отчете
      if (index[dn_prop]) {
        index[dn_prop].forEach(idx => {
          if (vals[idx] == undefined) initVal(idx, curval);
          calcVal(idx, curval);
        });
      }
      j++;
    } else {
      result.push(getOneRow());
      curdtx = arr[j].dtx;
      vals = {};
    }
  }
  result.push(getOneRow());
  return result;

  function initVal(idx, val) {
    let ival = val;
    if (cols[idx] && cols[idx].calc_type) {
      switch (cols[idx].calc_type) {
        case 'min':
        case 'max':
          ival = val;
          break;

        case 'sum':
          ival = 0;
          break;

        default:
          ival = val;
      }
    }
    vals[idx] = ival;
  }

  function calcVal(idx, val) {
    if (cols[idx] && cols[idx].calc_type) {
      switch (cols[idx].calc_type) {
        case 'sum':
          vals[idx] += val;
          break;

        case 'min':
          if (val < vals[idx]) vals[idx] = val;
          break;

        case 'max':
          if (val > vals[idx]) vals[idx] = val;
          break;

        default:
          vals[idx] = val;
      }
    } else {
      vals[idx] = val;
    }
  }

  function getOneRow() {
    let one = [];
    let val;

    cols.forEach((item, idx) => {
      switch (item.col_type) {
        case 'sn': // Номер по порядку
          sn += 1;
          val = String(sn);
          break;

        case 'value': // Значение
          val = vals[idx] || null;
          break;

        case 'date': // Дата-время
          if (discrete) {
            val = getTsFromDtx(curdtx, discrete);
          } else val = curdtx;
          break;

        default:
          val = '';
      }
      one.push(val);
    });
    return one;
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

function pad(val, width) {
  let numAsString = val + '';
  width = width || 2;
  while (numAsString.length < width) {
    numAsString = '0' + numAsString;
  }
  return numAsString;
}
