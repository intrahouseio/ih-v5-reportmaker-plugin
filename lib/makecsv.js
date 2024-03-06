/**
 * makecsv.js
 */

const util = require('util');
const fs = require('fs');

const reportutil = require('./reportutil');

module.exports = async function(tables, data, filename, mes) {
  const constVars = reportutil.getConstVarsObj(mes.reportVars);
  const colNamesArr = [];
  const colHeadsArr = [];

  try {
    // Названия переменных
    for (let one of tables) {
      const columns = one;
      // const colNames = Array.isArray(columns) ? columns.map(item => item.varname) : [];
      colNamesArr.push(Array.isArray(columns) ? columns.map(item => item.varname) : []);
    
      // Текстовые названия столбцов, могут включать макроподстановки
      // const colHeads = Array.isArray(columns) ? columns.map(item => replaceMacro(item.name)) : [];
      colHeadsArr.push(Array.isArray(columns) ? columns.map(item => replaceMacro(item.name)) : []);

    } 
    const str = stringify(colNamesArr, colHeadsArr, data);
    // await fs.promises.writeFile(filename, stringify(colNames, colHeads, data), 'utf8');
    await fs.promises.writeFile(filename, str, 'utf8');
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
    line += colHeads.map(el =>  '"' + el + '"').join(';');
    if (idx < colHeadsArr.length-1) line += ';"'+tabDelim+'";';
  });
  res += line+'\n';

  data.forEach(doc => {
    line = '';
    colNamesArr.forEach((colNames, idx) => {
      line += colNames.map(el => (doc[el] == undefined ? '' : '"' + doc[el] + '"')).join(';');
      if (idx < colNamesArr.length-1) line += ';"'+tabDelim+'";';
    });
    res += line + '\n';
  });
  return res;
}
