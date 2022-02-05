/**
 * reportutil.js
 */

// const util = require('util');

const hut = require('./hut');
const dateutils = require('./dateutils');

exports.processMakeupElements = processMakeupElements;
exports.getTableColumnsFromMakeup = getTableColumnsFromMakeup;

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
 * @param {Array of Arrays} data
 *
 * @return {Array of Objects} elements
 */
function processMakeupElements(makeup_elements, { start, end }, data) {
  // Сортировать по y
  const elements = makeup_elements.sort(hut.byorder('y'));

  let tableFinalY = 0;
  elements.forEach(el => {
    // Выполнить подстановки в текст
    if (el.text && el.text.indexOf('${') >= 0) {
      el.text = replaceMacro(el.text);
    }
    if (el.type == 'table') {
      tableFinalY = el.y + el.h;
    } else if (tableFinalY && el.y > tableFinalY) {
      // Вычислить hgap для элементов после таблицы
      el.hgap = el.y - tableFinalY;
    }
  });
  return elements;

  function replaceMacro(text) {
    return text.replace(/\${(\w*)}/g, (match, p1) => {
      switch (p1) {
        case 'period':
          return dateutils.getPeriodStr(start, end);
        default:
          return p1;
      }
    });
  }
}
