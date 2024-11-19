/**
 * makexlsx.js
 */

// const util = require('util');
const reportutil = require('./reportutil');
const XLSX = require('xlsx');

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
module.exports = async function(tables, data, filename, mes) {
  const constVars = reportutil.getConstVarsObj(mes.reportVars);

  try {
    const workbook = transformToWorkbook(tables, data);
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

  function transformToWorkbook(tables, data) {
    const workbook = XLSX.utils.book_new();

    for (const table of tables) {
        const tableArray = []; 
        // Добавляем заголовки из `tables`
        const headers = table.map(col => replaceMacro(col.name));
        tableArray.push(headers);

        // Ищем строки данных для текущей таблицы
        const tableData = data.map(row => table.map(col => row[col.varname] || ''))

        // Собираем данные по строкам
        for (const row of tableData) {
            tableArray.push(Object.values(row))
        }
         // Создаем рабочий лист из массива массивов
         const worksheet = XLSX.utils.aoa_to_sheet(tableArray);
         // Добавляем лист в книгу с именем таблицы
         XLSX.utils.book_append_sheet(workbook, worksheet, `Лист ${tables.indexOf(table) + 1}`);
    }

    return workbook;
  }
};

async function saveWorkbookToFile(workbook, fileName) {
    const writeFilePromise = () => {
        return new Promise((res) => {
            XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', type: 'binary' });
            res();
        });
    };

    await writeFilePromise();
}
