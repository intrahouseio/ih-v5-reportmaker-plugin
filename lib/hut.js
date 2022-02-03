/**
 *
 */

const util = require('util');
const fs = require('fs');
// const path = require('path');

exports.trim = trim;
exports.getFileExt = getFileExt;
exports.byorder = byorder;
exports.loadOneDict = loadOneDict;
exports.calcArray = calcArray;
exports.rounding = rounding;

function trim(str) {
  return str.replace(/^\s+|\s+$/gm, '');
}

function getFileExt(filename) {
  let parts = filename.split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function loadOneDict(filename, textname = 'name') {
  try {
    const data = readJsonFileSync(filename, true);
    return Array.isArray(data) ? arrayToDict(data, 'id', textname) : data;

  } catch (e) {
    console.log('ERROR loadOneDict' + util.inspect(e));
    return {};
  }
}

function readJsonFileSync(filename, nothrow) {
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (e) {
    if (!nothrow) throw { message: 'readJsonFileSync:' + filename + '. ' + e.message };
    // console.log('WARN: Reading ' + filename + '. ' + e.message);
    return {};
  }
}

/** Функция сортировки используется в качестве вызываемой функции для сортировки массива ОБЪЕКТОВ
 *   arr.sort(hut.byorder('place,room','D')
 *   Возвращает функцию сравнения
 *
 *    @param {String}  ordernames - имена полей для сортировки через запятую
 *    @param {String}   direction: D-descending else ascending
 *    @return {function}
 *
 **/
function byorder(ordernames, direction, parsingInt) {
  let arrForSort = [];
  const dirflag = direction == 'D' ? -1 : 1; // ascending = 1, descending = -1;

  if (ordernames && typeof ordernames == 'string') arrForSort = ordernames.split(',');

  return function(o, p) {
    if (typeof o != 'object' || typeof p != 'object') return 0;
    if (arrForSort.length == 0) return 0;

    for (let i = 0; i < arrForSort.length; i++) {
      let a;
      let b;
      let name = arrForSort[i];

      a = o[name];
      b = p[name];
      if (a != b) {
        if (parsingInt) {
          let astr = String(a);
          let bstr = String(b);
          if (!isNaN(parseInt(astr, 10)) && !isNaN(parseInt(bstr, 10))) {
            return parseInt(astr, 10) < parseInt(bstr, 10) ? -1 * dirflag : 1 * dirflag;
          }
        }

        // сравним как числа
        if (!isNaN(Number(a)) && !isNaN(Number(b))) {
          return Number(a) < Number(b) ? -1 * dirflag : 1 * dirflag;
        }

        // одинаковый тип, не числа
        if (typeof a === typeof b) {
          return a < b ? -1 * dirflag : 1 * dirflag;
        }

        return typeof a < typeof b ? -1 * dirflag : 1 * dirflag;
      }
    }
    return 0;
  };
}

/**
 * Формирует из массива словарь (ключ-значение)
 * В качестве ключа выносится свойство keyprop
 *
 * [{id:xx, name:'XX'}, {id:yy, name:'YY'},{name:'ZZ'}]
 *   keyprop='id', valprop='name'
 *   => {xx:'XX', yy:'YY'}
 *
 *    @param  {Array} data - входной массив
 *    @param  {String} keyprop - имя свойства-ключа
 *    @param  {String} valprop - имя свойства-значения
 *    @return {Object} - результат
 */
function arrayToDict(data, keyprop, valprop) {
  const result = {};
  if (data && util.isArray(data)) {
    data.forEach(item => {
      if (item[keyprop] != undefined) {
        result[String(item[keyprop])] = item[valprop] || '';
      }
    });
  }
  return result;
}

function calcArray(fnStr, arr) {
  if (!arr || !arr.length) return '';
  switch (fnStr) {
    case 'sum':
      return calcSum(arr);
    case 'min':
      return calcMin(arr);
    case 'max':
      return calcMax(arr);
    case 'avg':
      return calcAvg(arr);
    case 'first':
      return arr[0];
    case 'last':
      return arr[arr.length - 1];
    default:
      return '';
  }
}

function calcSum(arr) {
  let res = 0;
  arr.forEach(el => {
    res += Number(el);
  });
  return res;
}

function calcMin(arr) {
  let res = arr[0];
  arr.forEach(el => {
    if (res > Number(el)) res = Number(el);
  });
  return res;
}

function calcMax(arr) {
  let res = arr[0];
  arr.forEach(el => {
    if (res < Number(el)) res = Number(el);
  });
  return res;
}

function calcAvg(arr) {
  let res = 0;
  let count = 0;
  arr.forEach(el => {
    res += Number(el);
    count += 1;
  });
  return count > 0 ? Math.round(res / count) : 0;
}

function rounding(value, decdig) {
  if (isNaN(decdig) || decdig <= 0) return Math.round(value);

  let factor = 1;
  for (let i = 0; i < decdig; i++) factor *= 10;
  return Math.round(value * factor) / factor;
}