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

module.exports = function(elements, columns, tabledata) {
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

    addText({text:'Утверждаю_____', textSize:10, x:400, y: finalY+10});
    doc.addPage();
    console.log('doc.internal.getCurrentPageInfo()='+ util.inspect(doc.internal.getCurrentPageInfo()));
    const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
    addText({text:'Последняя страница номер '+pageNumber, textSize:19, x:10, y: 10});

    const filename = path.resolve('./', 'report1.pdf');
    console.log('MAKE PDF ' + filename);
    // info();
    doc.save(filename);

    return { response: 1, filename };
  } catch (e) {
    console.log('response:0 error=' + util.inspect(e));
    return { response: 0, error: e.message };
  }

  function addText(item) {
    const fontStyle = getFontStyle(item);
    doc.setFont(defaultFont, fontStyle);
    doc.setFontSize(item.textSize);
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

  function addTable(item) {
    doc.autoTable({
      startY: item.y,
      // tableLineWidth: 2, // граница вокруг
      theme: 'grid',
      margin: { top: 20, right: 20, bottom: 20, left: 20 },

      head: [['Дата', 'Счетчик 1', 'Счетчик 2', 'Всего']],
      body: tabledata,
     
      headStyles: {
        font: defaultFont,
        fontSize: 18,
        fillColor: [80, 80, 80]
      },
      footStyles: {
        font: defaultFont,
        fontSize: 18
      },
      bodyStyles: {
        font: defaultFont,
        fontSize: 15
      }
    });
    finalY = doc.lastAutoTable.finalY;
    console.log('finalY AFTER table='+finalY)
  }

  
  function info() {
    const x = doc.internal;

    console.log('DOC INTERNAL: scaleFactor = ' + util.inspect(x.scaleFactor));
    // console.log('pages = ' + util.inspect(x.pages));
    console.log('getCurrentPageInfo = ' + util.inspect(x.getCurrentPageInfo()));
  }
  
  /*
  function getData(rows, cols) {
    const amount = 5;
    const result = [];
    for (var i = 0; i < amount; i += 1) {
      const dataArr = rows[i];
      const one = { id: (i + 1).toString() };
      for (var j = 0; j < cols.length; j += 1) {
        const colItem = cols[j];
        one[colItem.id] = String(dataArr[j]);
      }
      result.push(one);
    }

    return result;
  }

  function generate(amount) {
    var result = [];
    //  { date: '100', value1: 'xx', value2: 'yy', total: '0', id: '1' },
    var data = {
      date: '100',
      value1: 'xx',
      value2: 'yy',
      total: '0'
    };
    for (var i = 0; i < amount; i += 1) {
      data.id = (i + 1).toString();
      result.push(Object.assign({}, data));
    }
    return result;
  }

  function createHeaders(cols) {
    // const keys = ['date','value1','value2','total','id']
    var result = [];
    for (var i = 0; i < cols.length; i += 1) {
      result.push({
        id: cols[i].id,
        name: cols[i].id,
        prompt: cols[i].name,
        width: Number(cols[i].width),
        align: cols[i].align,
        padding: 1
      });
    }
    return result;
  }

  function createHeaders(cols) {
    console.log('cols ' + util.inspect(columns));
    return cols.map((item, i) => ({
      id: item.id,
      name: item.name,
      prompt: item.name,
      width: Number(item.width),
      align: item.align || 'center',
      padding: 0
    }));
  }
  */

  function checkInData() {
    if (!tabledata) throw { message: 'Missing data array!' };
    if (!Array.isArray(tabledata)) throw { message: 'Expected data array!' };

    tabledata.forEach((item, index) => {
      if (!Array.isArray(item)) throw { message: 'Invalid data element with index ' + index + '! Expected array!' };
    });
  }
};

// Частные функции модуля
function getFontStyle(item) {
  if (item.textBold && item.textItalic) return 'bolditalics';
  if (item.textItalic) return 'italics';
  if (item.textBold) return 'bold';
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
