/**
 * makecsv.js
 */

const util = require('util');
const fs = require('fs');

const reportutil = require('./reportutil');

module.exports = async function(columns, data, filename, mes) {
  const constVars = reportutil.getConstVarsObj(mes.reportVars);

  try {
    // Названия переменных
    const colNames = Array.isArray(columns) ? columns.map(item => item.varname) : [];
    
    // Текстовые названия столбцов, могут включать макроподстановки
    const colHeads = Array.isArray(columns) ? columns.map(item => replaceMacro(item.name)) : [];

    await fs.promises.writeFile(filename, stringify(colNames, colHeads, data), 'utf8');
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

function stringify(colNames, colHeads, data) {
  // let res = colNames.join(';') + '\n';
  let res = colHeads.map(el =>  '"' + el + '"').join(';') + '\n';
  data.forEach(doc => {
    const line = colNames.map(el => (doc[el] == undefined ? '' : '"' + doc[el] + '"'));
    res += line.join(';') + '\n';
  });
  return res;
}
