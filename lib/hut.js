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
exports.arrayToObject = arrayToObject;
exports.calcArray = calcArray;
exports.rounding = rounding;
exports.getShortErrStr = getShortErrStr;
exports.unrequire = unrequire;
exports.isTs = isTs;

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

/**
 * Преобразует массив в объект.
 * В качестве ключа выносится свойство pop, преобразованное в строку
 * Если prop undefined - подобъект не включается
 *
 *   [{id:xx, name:'XX'}, {id:yy, name:'YY'},{name:'ZZ'}]
 *   => {xx:{id:xx,name:'XX'}, yy:{id:yy,name:'YY'}}
 *
 *   Вложенные объекты клонируются, а не копируются по ссылке!!
 *   Поэтому деструктуризация не исп-ся
 *
 *    @param {Array} data - входной массив
 *    @param {String} prop - имя свойства-ключа
 *    @return  {Object} - результат
 */
function arrayToObject(data, prop = 'id') {
  let result = data;

  if (util.isArray(data)) {
    let id;
    result = {};
    data.forEach(item => {
      if (item[prop] != undefined) {
        id = String(item[prop]);
        result[id] = clone(item);
      }
    });
  }
  return result;
}

/**
 *  Полное (а не поверхностное) копирование объекта
 *   @param  {*}  parent  - исходный объект или массив (может быть scalar - тогда он и возвращается)
 *   @param  {Object | undefined} child - результирующий - может быть undefined - тогда создается заново
 *   @param  {Bool} mixin  true:добавляются только отстутствующие свойства
 *                         false: все совпадающие свойства будут перезаписаны
 *   @return {*}
 */
function clone(parent, child, mixin) {
  if (typeof parent != 'object') return parent;

  child = child || (util.isArray(parent) ? [] : {});
  if (parent) {
    Object.keys(parent).forEach(prop => {
      if (!mixin || child[prop] == undefined) {
        if (parent[prop] === null) {
          child[prop] = 0;
        } else if (typeof parent[prop] === 'object') {
          child[prop] = util.isArray(parent[prop]) ? [] : {};
          clone(parent[prop], child[prop]);
        } else if (typeof parent[prop] === 'function') {
          // Функции не переносятся
        } else {
          child[prop] = parent[prop];
        }
      }
    });
  }
  return child;
}

function calcArray(fnStr, arr, decdig = 0) {
  if (!arr || !arr.length) return '';
  switch (fnStr) {
    case 'sum':
      return calcSum(arr, decdig);
    case 'min':
      return calcMin(arr, decdig);
    case 'max':
      return calcMax(arr, decdig);
    case 'avg':
      return calcAvg(arr, decdig);
    case 'first':
      return arr[0];
    case 'last':
      return arr[arr.length - 1];
    default:
      return '';
  }
}

function calcSum(arr, decdig) {
  let res = 0;
  arr.forEach(el => {
    res += getNumberOrDefault(el, 0);
  });
  return res.toFixed(decdig);
}

function calcMin(arr, decdig) {
  let res = null;
  arr.forEach(el => {
    const num = getNumberOrDefault(el, null);
    if (num != null && (res == null || res > num)) res = num;
    // if (res > Number(el)) res = Number(el);
  });
  return res == null ? '' : res.toFixed(decdig); // Возможно что null
}

function calcMax(arr, decdig) {
  let res = null;
  arr.forEach(el => {
    const num = getNumberOrDefault(el, null);
    if (num != null && (res == null || res < num)) res = num;
    // if (res < Number(el)) res = Number(el);
  });
  return res == null ? '' : res.toFixed(decdig); // Возможно что null
}

function calcAvg(arr, decdig) {
  let res = 0;
  let count = 0;
  arr.forEach(el => {
    const num = getNumberOrDefault(el, null);
    if (num != null) {
      res += num;
      count += 1;
    }
  });
  if (!count) return '';
  res /= count;
  return res.toFixed(decdig);
}

function rounding(value, decdig) {
  if (isNaN(decdig) || decdig <= 0) return Math.round(value);

  let factor = 1;
  for (let i = 0; i < decdig; i++) factor *= 10;
  return Math.round(value * factor) / factor;
}

function getNumberOrDefault(val, defVal) {
  if (val == undefined || val == '') return defVal;
  return isNaN(val) ? defVal : Number(val);
}

function getShortErrStr(e) {
  if (typeof e == 'object') return e.message ? getErrTail(e.message) : JSON.stringify(e);
  if (typeof e == 'string') return e.indexOf('\n') ? e.split('\n').shift() : e;
  return String(e);

  function getErrTail(str) {
    let idx = str.lastIndexOf('error:');

    return idx > 0 ? str.substr(idx + 6) : getFirstStr(str);
  }

  function getFirstStr(str) {
    return str.indexOf('\n') ? str.split('\n').shift() : str;
  }
}

function unrequire(moduleName) {
  if (!moduleName) return;
  try {
    const fullPath = require.resolve(moduleName);
    delete require.cache[fullPath];
  } catch (e) {
    // Может и не быть
  }
}

function isTs(ts) {
  return !isNaN(ts) && ts > 946674000000; // 01-01-2000
}
