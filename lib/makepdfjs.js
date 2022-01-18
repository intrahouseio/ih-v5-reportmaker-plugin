/**
 * makepdfjs.js
 *
 *  TODO:
 *    - вывод svg
 *    - выравнивание текстов, многострочные тексты
 *    - текст под таблицей, несколько таблиц
 *    - разные шрифты
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

global.window = {
  document: {
    createElementNS: () => {
      return {};
    }
  }
};
global.navigator = {};
global.html2pdf = {};
global.btoa = () => {};

const { jsPDF } = require('jspdf');
const { applyPlugin } = require('../node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.js');
const sizeOf = require('image-size');

module.exports = function(elements, tabledata, filename) {
  let doc;
  let defaultFont;
  let finalY;

  try {
    applyPlugin(jsPDF); // jspdf-autotable

    doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [595.28, 841.89]
    });

    doc.addFont(path.join(__dirname, '../fonts/Roboto-Regular.ttf'), 'Roboto', 'normal');
    doc.addFont(path.join(__dirname, '../fonts/Roboto-Medium.ttf'), 'Roboto', 'bold');
    doc.addFont(path.join(__dirname, '../fonts/Roboto-Italic.ttf'), 'Roboto', 'italics');
    doc.addFont(path.join(__dirname, '../fonts/Roboto-MediumItalic.ttf'), 'Roboto', 'bolditalics');
    defaultFont = 'Roboto';

    elements.forEach(el => {
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
    });

    /*
    addText({text:'Утверждаю_____', textSize:10, x:400, y: finalY+10});
    doc.addPage();
    const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
    addText({text:'Последняя страница номер '+pageNumber, textSize:19, x:10, y: 10});
    */

    console.log('MAKE PDF ' + filename);
    doc.save(filename);
    return filename;
  } catch (e) {
    console.log('response:0 error=' + util.inspect(e));
    plugin.log('Makepdf error: ' + util.inspect(e));
    throw { message: util.inspect(e) };
  }

  function addText(item) {
    const fontStyle = getFontStyle(item);
    doc.setFont(defaultFont, fontStyle);
    doc.setFontSize(item.textSize * doc.internal.scaleFactor);
    doc.text(item.text, item.x, item.y, { baseline: 'top' });
    finalY = item.y + doc.getLineHeight(item.text);
  }

  function addRectangle(item) {
    const lineWidth = doc.getLineWidth();
    const borderSize = item.borderSize || 1;
    doc.setLineWidth(borderSize);

    doc.rect(item.x, item.y, item.w, item.h, 'S'); // S - граница, F - закрашенный
    doc.setLineWidth(lineWidth);
    finalY = item.y + item.h + borderSize * 2;
  }

  function addImage(item) {
    if (!item.filename || !fs.existsSync(item.filename)) return;

    const dimensions = sizeOf(item.filename);
    const ratio = getRatio(item.w, item.h, dimensions.width, dimensions.height);
    const centerShift_x = item.x + (item.w - dimensions.width * ratio) / 2;
    const centerShift_y = item.y + (item.h - dimensions.height * ratio) / 2;

    const imgData = fs.readFileSync(item.filename);
    doc.addImage(imgData, 'JPEG', centerShift_x, centerShift_y, dimensions.width * ratio, dimensions.height * ratio);
    finalY = centerShift_y + dimensions.height * ratio;
  }

  function addTable(tableItem) {
    const cols = tableItem.columns.map(item => item.dn_prop); // Будет varname!!
    /**
     *  tableItem.columns: [{ name: 'Счетчик 1', dn_prop: 'meter1' }, { name: 'Счетчик 2', dn_prop: 'meter2' }]
         => ['meter1','meter2']
     */
    // Преобразовать массив объектов в массив массивов, исходя из столбцов
    const tab1 = tabledata.map(item => cols.map(varname => item[varname] || ''));

    // Преобразовать стили
    const headArr = tableItem.head.map(item => ({ content: item.content, styles: getStyles(item.styles) }));
    const bodyStylesArr = tableItem.bodyStyle.map(item => getStyles(item));

    doc.autoTable({
      startY: tableItem.y,
      margin: { top: 20, right: 20, bottom: 20, left: 20 }, // ??
      head: [headArr],
      // foot: [tableItem.foot.map(item => getContentAndStyles(item))],
      body: tab1,

      didParseCell: data => {
        if (data.section == 'body') {
          data.cell.styles = Object.assign(data.cell.styles, bodyStylesArr[data.column.index]);
        }
      }
    });

    finalY = doc.lastAutoTable.finalY;
    console.log('finalY AFTER table=' + finalY);
  }

  function getStyles(item) {
    const styles = { font: defaultFont };
    styles.fontSize = Number(item.fontSize);
    styles.halign = item.align || 'left';
    styles.cellPadding = item.cellPadding || 0;
    styles.fontStyle = getFontStyle(item);
    styles.textColor = getColor(item.textColor);
    styles.fillColor = getColor(item.fillColor);
    styles.lineColor = getColor(item.lineColor);
    styles.lineWidth = item.lineWidth * 0.1;
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

  function info() {
    const x = doc.internal;

    console.log('DOC INTERNAL: scaleFactor = ' + util.inspect(x.scaleFactor));
    // console.log('pages = ' + util.inspect(x.pages));
    console.log('getCurrentPageInfo = ' + util.inspect(x.getCurrentPageInfo()));
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

function trim(str) {
  return str.replace(/^\s+|\s+$/gm, '');
}
