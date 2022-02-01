/**
 * makepdfjs.js
 *
 *  TODO:
 *    - вывод svg
 *    - выравнивание текстов, многострочные тексты
 *    - несколько таблиц
 *    - разные шрифты
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const { jsPDF } = require('jspdf');
const { applyPlugin } = require('../node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.js');
const sizeOf = require('image-size');

const hut = require('./hut');

const footFunc = ['sum', 'min', 'max', 'avg', 'first', 'last'];

global.window = {
  document: {
    createElementNS: () => ({})
  }
};
global.navigator = {};
global.html2pdf = {};
global.btoa = () => {};

module.exports = function(elements, tabledata, filename) {
  let doc;
  let defaultFont;
  let tableFinalY;

  try {
    applyPlugin(jsPDF); // jspdf-autotable

    doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [595.28, 841.89]
    });

    defaultFont = addFont();
    build();
    doc.save(filename);
    return filename;
  } catch (e) {
    console.log('Makepdf error: ' + util.inspect(e));
    throw { message: util.inspect(e) };
  }

  function addFont() {
    doc.addFont(path.join(__dirname, '../fonts/Roboto-Regular.ttf'), 'Roboto', 'normal');
    doc.addFont(path.join(__dirname, '../fonts/Roboto-Medium.ttf'), 'Roboto', 'bold');
    doc.addFont(path.join(__dirname, '../fonts/Roboto-Italic.ttf'), 'Roboto', 'italics');
    doc.addFont(path.join(__dirname, '../fonts/Roboto-MediumItalic.ttf'), 'Roboto', 'bolditalics');
    return 'Roboto';
  }

  function build() {
    for (const el of elements) {
      if (tableFinalY > 0) {
        el.y = tableFinalY + el.hgap;
      }
      switch (el.type) {
        case 'text':
          addText(el);
          break;
        case 'rectangle':
          addRectangle(el);
          break;
        case 'image':
          addImage(el);
          break;
        case 'table':
          addTable(el);
          break;
        default:
      }
    }

    function addText(item) {
      const fontStyle = getFontStyle(item);
      doc.setFont(defaultFont, fontStyle);
      doc.setFontSize(item.textSize * doc.internal.scaleFactor);
      doc.text(item.text, item.x, item.y, { baseline: 'top' });
    }

    function addRectangle(item) {
      const lineWidth = doc.getLineWidth();
      const borderSize = item.borderSize || 1;
      doc.setLineWidth(borderSize);
      doc.rect(item.x, item.y, item.w, item.h, 'S'); // S - граница, F - закрашенный
      doc.setLineWidth(lineWidth);
    }

    function addImage(item) {
      const imgFiles = ['png', 'jpg', 'jpeg']; // без SVG!!
      if (!item.filename || !fs.existsSync(item.filename)) return;

      const ext = hut.getFileExt(item.filename);
      if (!imgFiles.includes(ext)) return;

      const dimensions = sizeOf(item.filename);
      const ratio = getRatio(item.w, item.h, dimensions.width, dimensions.height);
      const centerShift_x = item.x + (item.w - dimensions.width * ratio) / 2;
      const centerShift_y = item.y + (item.h - dimensions.height * ratio) / 2;

      const imgData = fs.readFileSync(item.filename);
      doc.addImage(
        imgData,
        ext.toUpperCase(),
        centerShift_x,
        centerShift_y,
        dimensions.width * ratio,
        dimensions.height * ratio
      );
    }

    /**
     *
     * @param {Object} tableItem: {
     *        columns: [{ name: 'Счетчик 1', varname: 'meter1' }, { name: 'Счетчик 2', varname: 'meter2' }]
     */
    function addTable(tableItem) {
      // Массив в порядке размещения в таблице, остальные массивы тоже приходят так же, это делает сервер
      const cols = tableItem.columns.map(item => item.varname); // => ['meter1','meter2']

      // Преобразовать массив объектов в массив массивов, исходя из столбцов
      const tab1 = tabledata.map(item => cols.map(varname => item[varname] || ''));

      const left = tableItem.x;
      const right = getPageWidth() - left - tableItem.w;

      // Рассчитать ширину каждого столбца Ширина задается в head (width) в процентах
      const colWidths = getColWidths();

      // Преобразовать стили
      const headArr = tableItem.head.map((item, idx) => ({
        content: item.content,
        styles: getStyles(item.styles, defaultFont, colWidths[idx])
      }));

      const bodyStylesArr = tableItem.bodyStyle.map((item, idx) => getStyles(item, defaultFont, colWidths[idx]));

      // Преобразовать стили и рассчитать контент
      const footArr = tableItem.foot.map((item, idx) => ({
        content: getFootContent(item, idx),
        styles: getStyles(item.styles, defaultFont, colWidths[idx])
      }));

      doc.autoTable({
        startY: tableItem.y,
        margin: { top: 20, left, bottom: 20, right },
        head: [headArr],
        foot: [footArr],
        showFoot: 'lastPage',
        body: tab1,

        didParseCell: data => {
          if (data.section == 'body') {
            data.cell.styles = Object.assign(data.cell.styles, bodyStylesArr[data.column.index]);
          }
        },

        didDrawPage: data => {
          showPageNumber(data);
        }
      });
      tableFinalY = doc.lastAutoTable.finalY;

      function getColWidths() {
        if (!tableItem.w) return;

        const onePercent = tableItem.w / 100;
        let it = 0;
        return tableItem.head.map((item, idx) => {
          if (idx < tableItem.head.length - 1) {
            let x = Math.round(onePercent * Number(item.styles.width));
            it += x;
            return x;
          }
          return tableItem.w - it;
        });
      }

      function getFootContent(item, idx) {
        if (!item.content) return '';
        let funStr = getFunStr(item.content);
        return funStr
          ? hut.calcArray(
              funStr,
              tab1.map(arr => arr[idx])
            )
          : item.content;
      }

      function showPageNumber(data) {
        // Header
        /*
        doc.setFontSize(20)
        doc.setTextColor(40)
        doc.text('Report', data.settings.margin.left + 15, 22)
        */

        // Footer
        var str = 'Страница ' + doc.internal.getNumberOfPages();
        // Total page number plugin only available in jspdf v1.0+
        // if (typeof doc.putTotalPages === 'function') {
        //  str = str + ' of ' + totalPagesExp
        // }
        doc.setFontSize(10);
        doc.text(str, data.settings.margin.left, getPageHeight() - 10);
      }
    }
  }

  function getPageWidth() {
    // jsPDF 1.4+ uses getWidth, <1.4 uses .width
    const pageSize = doc.internal.pageSize;
    return pageSize.width ? pageSize.width : pageSize.getWidth();
  }

  function getPageHeight() {
    const pageSize = doc.internal.pageSize;
    return pageSize.height ? pageSize.height : pageSize.getHeight();
  }

  function getStyles(item, defFont, cellWidth) {
    const styles = { font: defFont };
    styles.fontSize = Number(item.fontSize);
    styles.halign = item.align || 'left';
    styles.cellPadding = item.cellPadding || 0;
    styles.fontStyle = getFontStyle(item);
    styles.textColor = getColor(item.textColor);
    styles.fillColor = getColor(item.fillColor);
    styles.lineColor = getColor(item.lineColor);
    styles.lineWidth = item.lineWidth * 0.1;
    // Ширину столбца брать из массива, если он есть
    if (cellWidth != undefined) styles.cellWidth = cellWidth;
    return styles;
  }

  function getColor(val) {
    if (!val || val == 'transparent') return false;
    if (val.startsWith('rgba(')) {
      const arr = val.substr(5).split(',');
      if (arr.length >= 3) return arr.slice(0, 3);
    }
    return false;
  }
};

// Частные функции модуля
function getFontStyle(item) {
  if (item.textBold && item.textItalic) return 'bolditalics';
  if (item.bold && item.italics) return 'bolditalics';
  if (item.textItalic || item.italics) return 'italics';
  if (item.textBold || item.bold) return 'bold';
  return 'normal';
}

function getRatio(rec_width, rec_height, img_width, img_height) {
  const hRatio = rec_width / img_width;
  const vRatio = rec_height / img_height;
  return Math.min(hRatio, vRatio);
}

function getFunStr(content) {
  let funStr = hut.trim(content);
  if (!funStr.startsWith('${')) return;

  funStr = funStr
    .substr(2)
    .split('}')
    .shift();
  return footFunc.includes(funStr) ? funStr : '';
}
