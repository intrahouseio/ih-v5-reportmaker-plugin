/**
 * 
 */

const util = require('util');
const path = require('path');
const fs = require('fs');

module.exports = async function (columns, data, targetFolder) {
  // const filename = path.join(appconfig.getTmpFolder(), 'report_' + Date.now() + '.csv');
  const filename = path.join(targetFolder, 'report_' + Date.now() + '.csv');

  const colNames = Array.isArray(columns) ? columns.map(item => '"' + item.name + '"') : [];
  await fs.promises.writeFile(filename, stringify(colNames, data), 'utf8');
  return filename;
  
  function stringify(cols, arr) {
    let res = cols.join(';') + '\n';
    arr.forEach(line => {
      res += line.join(';') + '\n';
    });
    return res;
  }
}