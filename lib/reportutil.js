/**
 * reportutil.js
 */

const util = require('util');

const hut = require('./hut');
const dateutils = require('./dateutils');

exports.processMakeupElements = processMakeupElements;
exports.getTableColumnsFromMakeup = getTableColumnsFromMakeup;
exports.getConstVarsObj = getConstVarsObj;

function getTableColumnsFromMakeup(makeup_elements) {
  for (const item of makeup_elements) {
    if (item.type == 'table' && item.columns) {
      return item.columns;
    }
  }
}

/**
 *
 * Обработать элементы макета отчета makeup_elements, выполнить макроподстановки
 * @param {*} makeup_elements = {reportVars:[{}], discrete}
 * @param {Array of Arrays} data - данные из БД
 * @param {Object} constVars - константные данные из списка переменных
 *
 * @return {Array of Objects} elements
 */
function processMakeupElements(makeup_elements, { start, end }, data, reportVars) {
  // Сортировать по y
  const elements = makeup_elements.sort(hut.byorder('y'));

  // Выбрать константные значения
  const constVars = reportVars ? getConstVarsObj(reportVars) : {};

  let tableFinalY = 0;
  elements.forEach(el => {
    // Выполнить подстановки в текст
    if (el.text && el.text.indexOf('${') >= 0) {
      el.text = replaceMacro(el.text);
    }
    
    el.hgap = 0;
    if (el.type == 'table') {
      // Обработать шапки столбцов на предмет макроподстановок
      el.head.forEach(item => {
        item.content = replaceMacro(item.content);
      });
      // Сдвиг элементов ниже таблицы
      tableFinalY = el.y + el.h;
    } else if (tableFinalY && el.y > tableFinalY) {
      // Вычислить hgap для элементов после таблицы
      el.hgap = el.y - tableFinalY;
    }
  });
  return elements;

  function replaceMacro(text) {
    return text.replace(/\${(\w*)}/g, (match, p1) => {
      if (p1 == 'period') return dateutils.getPeriodStr(start, end);
      if (p1 == 'now') return dateutils.getDateTimeFor(new Date(), 'reportdt');
      if (constVars[p1]) return String(constVars[p1]);
      return p1;
    });
  }
}

function getConstVarsObj(reportVars) {
  if (!reportVars) return {};

  const vObj = {};
  reportVars.forEach(item => {
    if (item.col_type == 'constant') vObj[item.varname] = item.value;
  });
  return vObj;
}
