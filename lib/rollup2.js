/**
 * rollup2.js
 * Свертка массива, полученного из БД
 * Результат - массив объектов [{date:yy, meter1:xx, day_total:1000}]
 */
const util = require('util');

const dateutils = require('./dateutils');
const reportutil = require('./reportutil');

/**
 * @param {Array of arrays} arr - данные, полученные из БД, упорядочены по ts
 *        [[ts,dn,prop,val],...]
 * @param {Object} readobj:{
 *          discrete: дискрета для свертки
 *             ('month','day','hour','min','second')
 *          reportVars: {Array of Objects} - описание переменных отчета или графика
 *             [{id, dn_prop, varname, calc_type (min,max,sum), col_type(value,date,sn?,rowcalc/itog-формула???) - нужно добавить!!}, ]
 *         reportDateformat: строка формата для даты
 *             'reportdt'
 *         filter: {start, end<, end2>}
 *         trend: 1 - результат для графика - массив массивов
 *
 * @return {Array of Objects} - массив объектов, внутри объекта - переменные отчета со значениями
 *         + период (начало-конец?)
 *         [{ts, date:'', meter1:12, meter2:345}, ] или [[ts, val1, val2, ...], ]
 */
module.exports = function rollup(arr, readobj) {
  const discrete = readobj.discrete;
  const dkoeff = readobj.dkoeff || 1;
  const trend = readobj.trend || 0;
  const reportVars = readobj.reportVars;
  const reportDateformat = readobj.reportDateformat || '';

  const constVars = trend ? reportutil.getConstVarsObj(reportVars) : '';

  if (!arr || !Array.isArray(arr) || !arr.length || !reportVars || !Array.isArray(reportVars)) return [];

  // В зависимости от дискреты заполнить поле dtx из ts (YYMMDDHH)
  for (var ii = 0; ii < arr.length; ii++) {
    if (arr[ii].ts) arr[ii].dtx = discrete ? transform(arr[ii].ts, discrete) : arr[ii].ts;
  }

  let vals = {}; // {meter1:22} - накапливаются данные строки по формуле
  let counts = {}; // {meter1:1} - накапливается число записей в БД
  let rowNumber = 0;
  let mapIndex = {}; // {'VMETER1.val':[{varname:'meter1, col_type:'value,.. }, {}]}

  let diffIndex = {}; // Собрать имена переменных для рассчета diff

  const varnames = reportVars.map(item => item.varname).filter(el => el);

  reportVars.forEach(item => {
    if (item.dn_prop && item.col_type == 'value') {
      if (!mapIndex[item.dn_prop]) mapIndex[item.dn_prop] = [];
      mapIndex[item.dn_prop].push(item);
      if (item.calc_type == 'diff') {
        if (!diffIndex[item.dn_prop]) diffIndex[item.dn_prop] = item.varname;
      }
    } else if (item.col_type == 'calc') {
      if (item.calc_row) {
        item.calcFn = new Function('{' + varnames.join(',') + '}', 'return ' + item.calc_row);
      }
    }
  });

  // Если есть функция diff  для каких-то переменных?? - нужно собрать first по интервалам в
  const diffValsMap = new Map();
  if (Object.keys(diffIndex).length) {
    gatherDiffVals();
  }

  const shift = dkoeff > 1 ? dateutils.getDiscreteMs(discrete) * dkoeff : 0;
  return shift ? createResultWithBucket(shift) : createResult();

  function createResultWithBucket(ashift) {
    const result = [];
    let startBucket = readobj.filter.start;

    let j = 0;
    let curdtx = arr[j].dtx;
    let nextBucket = getNextBucketTs(startBucket, getEndTsFromDtx(arr[j].dtx, discrete), ashift);

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
        if (getEndTsFromDtx(arr[j].dtx, discrete) >= nextBucket) {
          const one = getOneRowObjWithBucket({ startTs: nextBucket - shift, endTs: nextBucket - 1 });

          result.push(one);
          nextBucket = getNextBucketTs(nextBucket, getEndTsFromDtx(arr[j].dtx, discrete), ashift);
          vals = {};
          counts = {};
        }

        curdtx = arr[j].dtx;
      }
    }

    const one = getOneRowObjWithBucket({ startTs: nextBucket - shift, endTs: nextBucket - 1 });
    result.push(one);
    return result;
  }

  function getNextBucketTs(sts, cts, ashift) {
    let next = sts;
    while (cts > next) {
      next += ashift;
    }
    return next;
  }

  function createResult() {
    const result = [];

    let j = 0;
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
        result.push(getOneRowObj(curdtx));
        vals = {};
        counts = {};

        curdtx = arr[j].dtx;
      }
    }
    result.push(getOneRowObj(curdtx));
    return result;
  }

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
        // vals[varname] = val;
      }
    } else {
      vals[varname] = val;
    }
  }

  function getOneRowObjWithBucket({ startTs, endTs }) {
    const one = { startTs, endTs };
    rowNumber += 1;
    let val = '';
    reportVars.forEach(item => {
      switch (item.col_type) {
        case 'rownumber': // Номер строки
          val = rowNumber;
          break;
        case 'value': // Значение
          if (item.calc_type == 'avg') {
            val = counts[item.varname] > 0 ? vals[item.varname] / counts[item.varname] : '';
          } else if (item.calc_type == 'diff') {
            // Нужно сложить все расходы за bucket из diffValsMap
            const startDtx = transform(startTs, discrete);
            const endDtx = transform(endTs, discrete);

            val = 0;
            for (const [dtx, dItem] of diffValsMap) {
              if (dtx >= startDtx && dtx <= endDtx) {
                val += dItem[item.varname];
              }
            }
          } else if (item.calc_type == 'count') {
            val = counts[item.varname];
          } else val = vals[item.varname] || '';
          break;

        case 'dt': // Значение
          val = dateFormat(one, item.calc_row, reportDateformat);
          break;

        case 'constant':
          if (constVars[item.varname] != undefined) {
            val = isNaN(constVars[item.varname]) ? constVars[item.varname] : Number(constVars[item.varname]);
          }
          break;

        default:
          val = '';
      }
      one[item.varname] = val;
    });

    // По формулам нужно считать когда есть все остальные значения
    fillCalcFields(one);
    formatFields(one);
    return one;
  }

  function getOneRowObj(curdtx) {
    // if (trend) return getOneRowArr(curdtx, diffItem);

    rowNumber += 1;
    let one = {};
    if (discrete) {
      one.startTs = getStartTsFromDtx(curdtx, discrete);
      one.endTs = getEndTsFromDtx(curdtx, discrete);
    } else one.startTs = curdtx;

    let val = '';
    reportVars.forEach(item => {
      switch (item.col_type) {
        case 'rownumber': // Номер строки
          val = rowNumber;
          break;
        case 'value': // Значение
          if (item.calc_type == 'avg') {
            val = counts[item.varname] > 0 ? vals[item.varname] / counts[item.varname] : '';
          } else if (item.calc_type == 'diff') {
            const diffItem = diffValsMap.get(curdtx);
            if (diffItem) val = diffItem[item.varname];
          } else if (item.calc_type == 'count') {
            val = counts[item.varname];
          } else val = vals[item.varname] || '';
          break;

        case 'dt': // Значение
          val = dateFormat(one, item.calc_row, reportDateformat);
          break;

        case 'constant':
          if (constVars[item.varname] != undefined) {
            val = isNaN(constVars[item.varname]) ? constVars[item.varname] : Number(constVars[item.varname]);
          }
          break;

        default:
          val = '';
      }
      one[item.varname] = val;
    });

    // По формулам нужно считать когда есть все остальные значения
    fillCalcFields(one);
    formatFields(one);
    return one;
  }

  function fillCalcFields(one) {
    reportVars
      .filter(item => item.col_type == 'calc')
      .forEach(item => {
        if (item.calcFn) {
          try {
            one[item.varname] = item.calcFn(one);
          } catch (e) {
            one[item.varname] = '';
          }
        }
      });
  }

  function formatFields(one) {
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

  function getOneRowArr(curdtx, diffItem) {
    let one = [];
    if (discrete) {
      one[0] = getStartTsFromDtx(curdtx, discrete);
    } else one[0] = curdtx;

    let val = '';
    reportVars.forEach(item => {
      switch (item.col_type) {
        case 'value': // Значение
          if (item.calc_type == 'avg') {
            val = counts[item.varname] > 0 ? vals[item.varname] / counts[item.varname] : '';
          } else if (item.calc_type == 'diff') {
            if (diffItem) val = diffItem[item.varname];
          } else if (item.calc_type == 'count') {
            val = counts[item.varname];
          } else val = vals[item.varname] != undefined ? vals[item.varname] : null;
          break;

        default:
          val = null;
      }
      one.push(val);
    });
    return one;
  }

  /**
   * Сформировать значения для calc_type = diff
   * Результат - diffValsMap = {<curdtx>:{:<varname>:xx, }}
   */
  function gatherDiffVals() {
    // diffIndex = {'VMETER1.value':'rmeter1', <dn_prop>:<varname>...}
    const varNames = Object.keys(diffIndex).map(dp => diffIndex[dp]);

    let prevObj = {};
    let lastObj = {};
    Object.keys(diffIndex).forEach(dp => {
      const varName = diffIndex[dp];
      prevObj[varName] = null;
      lastObj[varName] = null;
    });

    let j = 0;
    let curdtx = arr[0].dtx;

    // Выбрать первое значение в каждом интервале
    const upValsArray = []; // промежуточный массив
    let res = {};
    while (j < arr.length) {
      if (curdtx == arr[j].dtx) {
        let dp = arr[j].dn + '.' + arr[j].prop;

        if (diffIndex[dp]) {
          const varName = diffIndex[dp];

          // Нужно только первое значение!!
          if (!res[varName]) {
            res[varName] = Number(arr[j].val);
          }
          lastObj[varName] = Number(arr[j].val); // самое последнее значение по этому счетчику
        }
        j++;
      } else {
        // Если по счетчику не было показаний за период - нужно взять последнее за предыдущий
        varNames.forEach(vname => {
          if (res[vname] == undefined) res[vname] = lastObj[vname];
        });
        prevObj = { ...prevObj, ...res };
        upValsArray.push({ curdtx: String(curdtx), ...prevObj });
        res = {};

        let nextDtx = transform(getNextTsFromDtx(curdtx, discrete), discrete);
        // Если есть временной пробел - нужно вставить lastObj,
        // И первое значение, которое будет дальше, нужно взять из lastObj
        if (nextDtx < arr[j].dtx) {
          res = { ...lastObj };
          prevObj = { ...lastObj };
          while (nextDtx < arr[j].dtx) {
            // Повторить показания
            upValsArray.push({ curdtx: String(nextDtx), ...prevObj });
            nextDtx = transform(getNextTsFromDtx(nextDtx, discrete), discrete);
          }
        }

        curdtx = arr[j].dtx;
      }
    }
    // Обход окончен - записать последний штатный элемент
    prevObj = { ...prevObj, ...res };
    upValsArray.push({ curdtx: String(curdtx), ...prevObj });

    // Также есть последнее значение - для расчета последней разницы ?
    upValsArray.push({ curdtx: 'last', ...lastObj });

    // Из массива начальных значений upValsArray сформировать массив расхода
    return createDiffMap(upValsArray, varNames);
  }

  // Из массива начальных значений upValsArray сформировать массив расхода
  function createDiffMap(upValsArray, varNames) {
    // const varNames = Object.keys(diffIndex).map(dp => diffIndex[dp]);
    for (let i = 0; i < upValsArray.length - 1; i++) {
      const ucurdtx = upValsArray[i].curdtx;
      const res = { curdtx: ucurdtx };
      varNames.forEach(vname => {
        res[vname] = upValsArray[i + 1][vname] - upValsArray[i][vname];
      });
      diffValsMap.set(ucurdtx, res);
    }
  }
};

// Частные функции
function dateFormat(one, calc, reportDateformat) {
  try {
    const dt1 = new Date(one.startTs);
    const dt2 = new Date(one.endTs);
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
  if (discrete == 'min') return dtx;

  dtx += pad(dt.getSeconds());
  return dtx;
}

function getStartTsFromDtx(dtx, discrete) {
  let yy = Number(dtx.substr(0, 2)) + 2000;
  let mm = Number(dtx.substr(2, 2));
  let dd = 0;
  let hh = 0;
  let minutes = 0;
  let seconds = 0;

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
        if (discrete == 'min') {
          seconds = 0;
        } else {
          seconds = Number(dtx.substr(10, 2));
        }
      }
    }
  }

  return new Date(yy, mm, dd, hh, minutes, seconds).getTime();
}

function getNextTsFromDtx(dtx, discrete) {
  let yy = Number(dtx.substr(0, 2)) + 2000;
  let mm = Number(dtx.substr(2, 2));
  let dd = 0;
  let hh = 0;
  let minutes = 0;
  let seconds = 0;

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
        if (discrete == 'min') {
          seconds = 0;
          minutes += 1;
        } else {
          seconds = Number(dtx.substr(10, 2));
        }
      }
    }
  }
  return new Date(yy, mm, dd, hh, minutes, seconds).getTime();
}

function getEndTsFromDtx(dtx, discrete) {
  let yy = Number(dtx.substr(0, 2)) + 2000;
  let mm = Number(dtx.substr(2, 2));
  let dd = 0;
  let hh = 0;
  let minutes = 0;
  let seconds = 0;

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
        if (discrete == 'min') {
          seconds = 0;
          minutes += 1;
        } else {
          seconds = Number(dtx.substr(10, 2));
        }
      }
    }
  }
  return new Date(yy, mm, dd, hh, minutes, seconds).getTime() - 1000; // -1 сек
}

function pad(val, width) {
  let numAsString = val + '';
  width = width || 2;
  while (numAsString.length < width) {
    numAsString = '0' + numAsString;
  }
  return numAsString;
}
