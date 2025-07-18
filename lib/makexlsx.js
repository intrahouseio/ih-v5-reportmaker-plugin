/**
 * makexlsx.js
 */

// const util = require('util');
const reportutil = require('./reportutil');
const ExcelJS = require('exceljs-minified');
const fs = require('fs');
/**
 * Формирование xlsx файла из данных <data>,
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
module.exports = async function(tables, indata, filename, mes) {
  const constVars = reportutil.getConstVarsObj(mes.reportVars);

  try {
    const workbook = transformToWorkbook();
    await saveWorkbookToFile(workbook, filename);

    return filename;
  } catch (e) {
    throw { message: 'makexlsx error: ' + e.message };
  }

  function replaceMacro(text) {
    return text.replace(/\${(\w*)}/g, (match, p1) => {
      if (constVars[p1]) return String(constVars[p1]);
      return p1;
    });
  }

  function transformToWorkbook() {
    const workbook = new ExcelJS.Workbook();

    for (const table of tables) {
      const worksheet = workbook.addWorksheet(`Лист ${tables.indexOf(table) + 1}`);
      const { columns, _label } = table;
      const headers = columns.map(col => replaceMacro(col.name));
      worksheet.addRow(headers);

      // Инициализируем максимальные длины с учетом заголовков
      const maxLengths = headers.map(header => header.length);
      const tdata = Array.isArray(indata) ? indata : indata[_label];
      addRows(worksheet, columns, tdata, maxLengths);
    }

    return workbook;
  }
};

function addRows(worksheet, table, data, maxLengths) {
  // Обработка данных
  for (const row of data) {
    const currentRow = table.map(col => {
      if (row[col.varname] == undefined) {
        return '';
      }
      let curVal = row[col.varname];
      if (typeof curVal == 'object') {
        curVal = curVal.value;
      }
      return curVal;
      // return getNumberAsNumber(curVal);
    });
    worksheet.addRow(currentRow);

    currentRow.forEach((value, colIndex) => {
      const length = value.length;
      if (length > maxLengths[colIndex]) {
        maxLengths[colIndex] = length;
      }
    });
  }

  // Стилизация ячеек
  worksheet.eachRow({ includeEmpty: true }, row => {
    row.eachCell(cell => {
      const cellValue = cell.value;

      // Установите формат для чисел и выравнивания для числовых значений
      if (!isNaN(cellValue)) {
        // cell.style.numFmt = '0.00'; // Числовой формат для чисел
        cell.style.alignment = { horizontal: 'right' }; // Выравнивание по правому краю
      }
    });
  });

  // Установка ширины столбцов
  maxLengths.forEach((length, colIndex) => {
    worksheet.getColumn(colIndex + 1).width = length < 10 ? 10 : length; // Минимальная ширина 10
  });
}

function getNumberAsNumber(astr) {
  return isNaN(+astr) ? astr : Number(astr);
}

// После минификации пакета ExcelJS не удалось использовать вcтроенный метод workbook.xlsx.writeFile
/*
async function saveWorkbookToFile(workbook, fileName) {
    await workbook.xlsx.writeBuffer().then((buffer) => fs.writeFile(fileName, buffer, (err) => {}));
}
*/
function saveWorkbookToFile(workbook, fileName) {
  return new Promise((resolve, reject) => {
    workbook.xlsx.writeBuffer().then(buffer => {
      fs.writeFile(fileName, buffer, err => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      }).catch(e => reject(e));
    });
  });
}
