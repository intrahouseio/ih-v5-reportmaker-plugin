/**
 * reportutil.js
 */

const util = require('util');

const rollup = require('./rollup2');
const dateutils = require('./dateutils');



/**
 * 
 * Сформировать результат как массив массивов в соответствии с columns
 * @param {*} readobj = {reportVars:[{}], discrete}
 * @param {*} arr
 */
function processReportResult(readobj, arr) {
  if (!arr || !util.isArray(arr) || !arr.length) return [];
  if (!readobj || !readobj.reportVars || !util.isArray(readobj.reportVars) || !readobj.reportVars.length) return [];

  let discrete = readobj.discrete;

  // let rollarr = readobj.diffconsumption ? calcDiff(readobj, arr, houser) : rollup(arr, discrete, readobj.columns);
  let rollarr = rollup(arr, discrete, readobj.reportVars, readobj.reportDateformat);
  return rollarr;
  // return finProcess(rollarr, readobj.columns, discrete);
}

// Применить форматирование, вычислить итоги
function finProcess(rarr, cols, discrete) {
  let total;
  let needtotal = cols.some(item => item.total);
  if (needtotal) total = cols.map(() => 0);

  for (let i = 0; i < rarr.length; i++) {
    for (let j = 0; j < cols.length; j++) {
      // if (readobj.columns[j].col_type == 'data' && readobj.columns[j].date_format) {
      switch (cols[j].col_type) {
        case 'date':
          try {
            rarr[i][j] = getDateStr(rarr[i][j], discrete);
          } catch (e) {
            console.log('ERR: '+util.inspect(e)+' Report finProcess: Invalid date:' + rarr[i][j]);
          }
          // 
          break;

        case 'value':
          if (total && cols[j].total && rarr[i][j] != null) {
            total[j] += rarr[i][j];
          }
          rarr[i][j] = getFormattedValue(rarr[i][j], cols[j].decdig);
          break;

        case 'rowtotal':
          rarr[i][j] = getFormattedValue(rowtotal(i), cols[j].decdig);

          if (total && cols[j].total) {
            total[j] += Number(rarr[i][j]);
          }
          break;
        default:
      }
    }
  }

  if (total) {
    let totalrow = ['Итого'];
    for (let j = 1; j < cols.length; j++) {
      // totalrow.push(cols[j].total ? String(total[j]) : '');
      totalrow.push(cols[j].total ? getFormattedValue(total[j], cols[j].decdig) : '');
    }
    rarr.push(totalrow);
  }
  return rarr;

  function rowtotal(rowidx) {
    let res = 0;
    cols.forEach((item, colidx) => {
      if (item.col_type == 'value' && !isNaN(rarr[rowidx][colidx])) res += Number(rarr[rowidx][colidx]);
    });
    return res;
  }
}

function getFormattedValue(val, decdig = 0) {
  return isNaN(val) ? '' : Number(val).toFixed(decdig);
}

function getDateStr(ts, discrete) {
  // console.log('getDateTimeFor '+ts+' discrete='+discrete+' new Date(ts)='+new Date(ts))
  let format;

  if (discrete == 'year') return dateutils.getYear(ts);
  if (discrete == 'month') return dateutils.getMonthAndYear(ts);
  switch (discrete) {
    case 'day':
      format = 'reportd';
      break;

    case 'hour':
    case 'min':
      format = 'reportdt';
      break;

    default:
      format = ''; // YY-MM-DD HH:MM:SS
  }
  return dateutils.getDateTimeFor(new Date(ts), format);
}

function calcDiff(readobj, arr) {
  let diffstart = readobj.diffstart;
  let dnarr = readobj.filter.dn.split(',');

  let val0 = {};
  dnarr.forEach(dn => {
    val0[dn] = 0;
  });

  let i = 0;
  while (i < arr.length && arr[i].ts < diffstart) {
    val0[arr[i].dn] = arr[i].val;
    i += 1;
  }

  // Удалить значения до diffstart
  arr.splice(0, i);

  // свернуть по max - показания на конец - часа, дня, месяца
  // Используем cols
  let cols = readobj.columns.map(item => {
    if (item.col_type == 'value') item.calc_type = 'max';
    return item;
  });

  let discrete = 'day';
  let rarr = rollup(arr, discrete, cols);

  // Посчитать diff
  let diff = rarr.map(larr =>
    larr.map((item, idx) => {
      if (cols[idx].col_type != 'value') {
        return item;
      }

      let diffval = 0;
      let dn = cols[idx].dn;
      if (item >= val0[dn]) {
        // diffval = Math.round(item - val0[dn]);
        diffval = rounding(item - val0[dn], cols[idx].decdig);

        val0[dn] = item;
      }
      return diffval;
    })
  );

  return diff;
}

function rounding(value, decdig) {
  if (isNaN(decdig) || decdig <= 0) return Math.round(value);

  let factor = 1;
  for (let i = 0; i < decdig; i++) factor *= 10;
  return Math.round(value * factor) / factor;
}


module.exports = {
  processReportResult
}