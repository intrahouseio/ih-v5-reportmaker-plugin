/**
 * makecsv.js
 */

// const util = require('util');
const fs = require('fs');

const reportutil = require('./reportutil');

/**
 * Формирование  строки в формате csv из данных <data>, 
 * запись результата в файл <filename>
 *
 *  @param {Array of arrays} tables - массив описания столбцов таблиц
 *  @param {Array of objects} data - данные, полученные из БД, упорядочены по ts
 *  @param {Sting} filename - Полный путь к файлу результата
 *  @param {Object} mes - описание отчета, здесь исп-ся mes.reportVars
 *
 * @return {Sting} filename, если создан
 * @throw при ошибке
 */
module.exports = async function(tables, data, filename, mes) {
  const constVars = reportutil.getConstVarsObj(mes.reportVars);
  const colNamesArr = [];
  const colHeadsArr = [];

  try {
    for (let columns of tables) {
      colNamesArr.push(Array.isArray(columns) ? columns.map(item => item.varname) : []);

      // Текстовые названия столбцов, могут включать макроподстановки
      colHeadsArr.push(Array.isArray(columns) ? columns.map(item => replaceMacro(item.name)) : []);
    }
    const str = stringify(colNamesArr, colHeadsArr, data);
    // Добавление BOM - добавляется EF BB Bf
    await fs.promises.writeFile(filename, '\uFEFF' + str, 'utf8');
    return filename;
  } catch (e) {
    throw { message: 'makecsv error: ' + e.message };
  }

  function replaceMacro(text) {
    return text.replace(/\${(\w*)}/g, (match, p1) => {
      if (constVars[p1]) return String(constVars[p1]);
      return p1;
    });
  }
};

function stringify(colNamesArr, colHeadsArr, data) {
  const tabDelim = ' ';
  let res = '';
  let line = '';

  colHeadsArr.forEach((colHeads, idx) => {
    line += colHeads.map(el => '"' + el + '"').join(';');
    if (idx < colHeadsArr.length - 1) line += ';"' + tabDelim + '";';
  });
  res += line + '\n';

  data.forEach(doc => {
    line = '';
    colNamesArr.forEach((colNames, idx) => {
      line += colNames.map(el => (doc[el] == undefined ? '' : '"' + doc[el] + '"')).join(';');
      if (idx < colNamesArr.length - 1) line += ';"' + tabDelim + '";';
    });
    res += line + '\n';
  });
  return res;
}
