/**
 * makecsv.js
 */

// const util = require('util');
const fs = require('fs');

module.exports = async function(columns, data, filename) {
  try {
    const colNames = Array.isArray(columns) ? columns.map(item => item.varname) : [];
    await fs.promises.writeFile(filename, stringify(colNames, data), 'utf8');
    return filename;
    
  } catch (e) {
    throw { message: 'makecsv error: ' + e.message };
  }
};

function stringify(colNames, data) {
  let res = colNames.join(';') + '\n';
  data.forEach(doc => {
    const line = colNames.map(el => (doc[el] == undefined ? '' : '"' + doc[el] + '"'));
    res += line.join(';') + '\n';
  });
  return res;
}
