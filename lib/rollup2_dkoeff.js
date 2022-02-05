/**
 * rollup2.js
 * Свертка массива, полученного из БД
 * Результат - массив объектов [{date:yy, meter1:xx, day_total:1000}]
 */

const util = require('util');

const hut = require('./hut');
const dateutils = require('./dateutils');

/**
 * @param {Array of arrays} arr - данные, полученные из БД, упорядочены по ts
 *        [[ts,dn,prop,val],...]
 * @param {Object} readobj:{
 *          discrete: дискрета для свертки
 *             ('month','day','hour','min')
 *          reportVars: {Array of Objects} - описание переменных отчета
 *             [{id, dn_prop, varname, calc_type (min,max,sum), col_type(value,date,sn?,rowcalc/itog-формула???) - нужно добавить!!}, ]
 *         reportDateformat: строка формата для даты
 *             'reportdt'
 *         filter: {start, end<, end2>}
 *
 * @return {Array of Objects} - массив объектов, внутри объекта - переменные отчета со значениями
 *         + период (начало-конец?)
 *         [{ts, date:'', meter1:12, meter2:345}, ]
 */
module.exports = function rollup(arr, readobj) {
  const discrete = readobj.discrete;
  const dkoeff = readobj.dkoeff; // Множитель дискреты
  const reportVars = readobj.reportVars;
  const reportDateformat = readobj.reportDateformat;
  const reportEnd = readobj.filter.end; // Для diff вытаскиваем на 1 дискрету больше

  if (!arr || !Array.isArray(arr) || !arr.length || !reportVars || !Array.isArray(reportVars)) return [];

  // В зависимости от дискреты заполнить поле dtx из ts (YYMMDDHH)
  for (var ii = 0; ii < arr.length; ii++) {
    if (arr[ii].ts) arr[ii].dtx = discrete ? transform(arr[ii].ts, discrete) : arr[ii].ts;
  }

  let vals = {}; // {meter1:22} - накапливаются данные строки по формуле
  let counts = {}; // {meter1:1} - накапливается число записей в БД

  let mapIndex = {}; // {'VMETER1.val':[{varname:'meter1, col_type:'value,.. }, {}]}

  let diffIndex = {}; // Собрать имена переменных для рассчета diff

  // Создать массив varname
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
        // Построить функцию и сохранить ее
        item.calcFn = new Function('{' + varnames.join(',') + '}', 'return ' + item.calc_row);
      }
    }
  });

  // Если есть функция diff  для каких-то переменных?? - нужно собрать first по интервалам в
  const diffValsMap = new Map();
  if (Object.keys(diffIndex).length) {
    gatherDiffVals();
  }

  return diffValsMap.size ? createDiffResult() : createResult();

  function createDiffResult() {
    const result = [];
    let j = 0;
    let curdtx = arr[0].dtx;

    let dn_prop;
    let curval;
    while (j < arr.length && arr[j].ts <= reportEnd) {
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
        result.push(getOneRowObj(curdtx, diffValsMap.get(curdtx)));
        curdtx = arr[j].dtx;
        vals = {};
        counts = {};
      }
    }
    result.push(getOneRowObj(curdtx, diffValsMap.get(curdtx)));
    return result;
  }

  function createResult() {
    const result = [];
    let subresult = [];

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
        if (dkoeff > 1) {
          // Нужно агрегировать несколько строк
          subresult.push(getOneRowObj(curdtx));
          vals = {};
          counts = {};

          let nextDtx = transform(getNextTsFromDtx(curdtx, discrete), discrete);
          // Если есть временной пробел - нужно вставить просто пустые (с датами)

          if (nextDtx < arr[j].dtx) {
            subresult.push(getOneRowObj(nextDtx));
            // console.log('subresult=' + util.inspect(subresult));
          }
          if (subresult.length >= dkoeff) {
            result.push(aggSubresult(subresult));
            // console.log('result=' + util.inspect(result));
            subresult = [];
          }
        } else {
          result.push(getOneRowObj(curdtx));
          vals = {};
          counts = {};
        }

        curdtx = arr[j].dtx;
      }
    }

    if (dkoeff > 1 && subresult.length) {
      result.push(aggSubresult(subresult));
      // console.log('result=' + util.inspect(result));
    } else result.push(getOneRowObj(curdtx));

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

  function aggSubresult(subarr) {
    const len = subarr.length;
    const one = {};
    one.startTs = subarr[0].startTs;
    if (discrete) one.endTs = subarr[len - 1].endTs;

    // Посчитать итоги по каждому полю - по правилу
    let val = '';
    reportVars.forEach(item => {
      switch (item.col_type) {
        case 'value': // Значение по массиву
          val = hut.calcArray(
            item.calc_type,
            subarr.map(sitem => sitem[item.varname])
          );
          break;

        case 'dt':
          val = dateFormat(one, item.calc_row, reportDateformat);
          break;
        default:
          val = '';
      }
      one[item.varname] = val;
    });

    fillCalcFields(one);
    return one;
  }

  function getOneRowObj(curdtx, diffItem) {
    // console.log('getOneRowObj START '+curdtx);
    let one = {};
    if (discrete) {
      one.startTs = getStartTsFromDtx(curdtx, discrete);
      one.endTs = getEndTsFromDtx(curdtx, discrete);
    } else one.startTs = curdtx;

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
          } else val = vals[item.varname] || '';

          // Вывести в виде строки с учетом decdig
          // console.log('val='+val+' typeof val='+typeof val);
          // if (typeof val == 'number') val = val.toFixed(item.decdig)
          break;

        case 'dt': // Значение
          val = dateFormat(one, item.calc_row, reportDateformat);
          break;
        default:
          val = '';
      }
      one[item.varname] = val;
    });

    // По формулам нужно считать когда есть все остальные значения
    /*
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
      */
    fillCalcFields(one);
    console.log('ONE BEFORE ' + util.inspect(one));
    formatFields(one)
    console.log('ONE AFTER' + util.inspect(one));
    return one;
  }

  function fillCalcFields(one) {
    reportVars
      .filter(item => item.col_type == 'calc')
      .forEach(item => {
        if (item.calcFn) {
          try {
            let val = item.calcFn(one);
            // if (typeof val == 'number') val = val.toFixed(item.decdig)
            // console.log('getOneRowObj item '+util.inspect(item));
            one[item.varname] = val;
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
          console.log('formatFields ' + item.varname + ' = ' + val);
          one[item.varname] = val;
        }
      });
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
        return (
          dateutils.getDateTimeFor(dt1, reportDateformat) + ' - ' + dateutils.getDateTimeFor(dt2, reportDateformat)
        );
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

function getNextTsFromDtx(dtx, discrete) {
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
