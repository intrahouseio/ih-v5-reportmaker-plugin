/**
 * makepdfjs.js
 *
 *  TODO:
 *    - вывод svg
 *    - выравнивание текстов, многострочные тексты
 *    - несколько таблиц
 *    - разные шрифты
 *    - ориентация - ландшафт
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const { jsPDF } = require('jspdf');
const { applyPlugin } = require('../node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.js');
const sizeOf = require('image-size');

const hut = require('./hut');
const rgbColors = require('../rgbColorTable.json');

const footFunc = ['sum', 'min', 'max', 'avg', 'first', 'last'];

global.window = {
  document: {
    createElementNS: () => ({})
  }
};
global.navigator = {};
global.html2pdf = {};
global.btoa = () => {};

module.exports = function(page_elements, tabledata, filename, mes) {
  let doc;
  let defaultFont;
  let tableFinalY;
  const reportVarsObj = mes.reportVars ? hut.arrayToObject(mes.reportVars, 'varname') : {};
  const show_pagenum = mes.show_pagenum || 0;

  try {
    applyPlugin(jsPDF); // jspdf-autotable

    if (!page_elements.length) throw { message: 'No pages!' };
    const { orientation, format } = getFormat(page_elements[0].landscape);

    doc = new jsPDF({
      orientation,
      format,
      unit: 'px',
      hotfixes: ['px_scaling']
    });

    defaultFont = addFont();


    page_elements.forEach((pageItem, i) => {
      tableFinalY = 0;
      if (i > 0) addPage(pageItem);
      build(pageItem.elements);
    });

    doc.setDocumentProperties({ title: hut.getFileNameFromPathName(filename) }); // имя файла без пути
    doc.save(filename);
    return filename;
  } catch (e) {
    console.log('ERROR: Makepdf ' + util.inspect(e));
    throw { message: util.inspect(e) };
  }

  function addPage(pageItem) {
    const { orientation, format } = getFormat(pageItem.landscape);
    doc.addPage(format, orientation);
  }

  function getFormat(landscape) {
    const orientation = landscape ? 'landscape' : 'portrait';
    const format = landscape ? [841.896, 595.28] : [595.28, 841.89];
    return { format, orientation };
  }

  function addFont() {
    doc.addFont(path.join(__dirname, '../fonts/Roboto-Regular.ttf'), 'Roboto', 'normal');
    doc.addFont(path.join(__dirname, '../fonts/Roboto-Medium.ttf'), 'Roboto', 'bold');
    doc.addFont(path.join(__dirname, '../fonts/Roboto-Italic.ttf'), 'Roboto', 'italics');
    doc.addFont(path.join(__dirname, '../fonts/Roboto-MediumItalic.ttf'), 'Roboto', 'bolditalics');
    return 'Roboto';
  }

  function build(elements) {
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
        case 'circle':
          addCircle(el);
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
      const style = setColorGetStyle(item);
      const lineWidth = doc.getLineWidth();
      const borderSize = item.borderSize || 1;
      doc.setLineWidth(borderSize);
      console.log('addRectangle doc.rect ' + util.inspect(item));
      doc.rect(item.x, item.y, item.w, item.h, style); // S - граница, F - закрашенный
      doc.setLineWidth(lineWidth);
    }

    function addCircle(item) {
      const style = setColorGetStyle(item);
      doc.setLineWidth(1);
      // x,y - нужен центр
      let xc = item.x + item.w / 2;
      let yc = item.y + item.h / 2;
      doc.ellipse(xc, yc, item.w / 2, item.h / 2, style);
    }

    function setColorGetStyle(item) {
      const fillColor = getColor(item.backgroundColor);
      const lineColor = getColor(item.borderColor);

      let style = 'S';
      if (fillColor && lineColor) {
        style = 'FD';
      } else if (fillColor) {
        style = 'F';
      }
      setFillColor(fillColor);
      setDrawColor(lineColor);
      return style;
    }

    function setFillColor(color) {
      if (color) {
        doc.setFillColor(...color);
      } else doc.setFillColor(1); // 1 - white
    }

    function setDrawColor(color) {
      if (color) {
        doc.setDrawColor(...color);
      } else doc.setDrawColor(0); // 0 - black
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
      const tableName = tableItem._label;
      // Массив в порядке размещения в таблице, остальные массивы тоже приходят так же, это делает сервер
      const cols = tableItem.columns.map(item => item.varname); // => ['meter1','meter2']

      const altCellStyles = {};

      // Преобразовать массив объектов в массив массивов, исходя из столбцов
      // const tab1 = tabledata.map(item => cols.map(varname => item[varname]));
      let tarr = [];
      if (Array.isArray(tabledata)) {
        tarr = tabledata;
      } else if (typeof tabledata == 'object' && Array.isArray(tabledata[tableName])) {
        tarr = tabledata[tableName];
      }

      const tab1 = tarr.map((item, ridx) => getRowValuesArray(item, ridx));
      // const tab1 = tabledata.map((item, ridx) => getRowValuesArray(item, ridx));

      // Сформировать массив для форматирования foot content в порядке cols - decdig брать из reportVars
      const footFormat = cols.map(varname =>
        reportVarsObj[varname] && reportVarsObj[varname].decdig ? reportVarsObj[varname].decdig : 0
      );

      const left = tableItem.x;
      const right = getPageWidth() - left - tableItem.w;

      // Рассчитать ширину каждого столбца Ширина задается в head (width) в процентах
      const colWidths = getColWidths();

      // Преобразовать стили
      const headArr = tableItem.head.map((item, idx) => ({
        content: item.content,
        styles: getStyles(item.styles, defaultFont, colWidths[idx])
      }));

      // Стили для каждого столбца
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
            data.cell.styles = getCellStyle(data.row.index, data.column.index, data.cell.styles);
          }
        },

        didDrawPage: data => {
          showPageNumber(data);
        }
      });
      tableFinalY = doc.lastAutoTable.finalY;

      function getRowValuesArray(ritem, rowIdx) {
        // return cols.map(varname => ritem[varname]);
        const valArr = [];
        altCellStyles[rowIdx] = {};
        cols.forEach((varname, colIdx) => {
          if (typeof ritem[varname] == 'object') {
            const val = ritem[varname].value != undefined ? ritem[varname].value : '';
            valArr.push(val);
            altCellStyles[rowIdx][colIdx] = { ...ritem[varname] };
          } else {
            valArr.push(ritem[varname]);
          }
        });
        return valArr;
      }

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

      function getCellStyle(rowIdx, colIdx, cellStyles) {
        const curStyle = Object.assign({}, cellStyles, bodyStylesArr[colIdx]);

        if (altCellStyles[rowIdx] && altCellStyles[rowIdx][colIdx]) {
          const aStyle = altCellStyles[rowIdx][colIdx];
          if (aStyle.textColor) curStyle.textColor = getColor(aStyle.textColor);
          if (aStyle.fillColor) curStyle.fillColor = getColor(aStyle.fillColor);
          // if (aStyle.lineColor) curStyle.lineColor = getColor(aStyle.lineColor);
          if (aStyle.halign) curStyle.halign = aStyle.halign;
          if (aStyle.fontStyle) curStyle.fontStyle = aStyle.fontStyle; // bold, italic, bolditalic
          if (aStyle.fontSize) curStyle.fontSize = aStyle.fontSize;
        }
        return curStyle;
      }

      function getFootContent(item, idx) {
        if (!item.content) return '';
        let funStr = getFunStr(item.content);
        return funStr
          ? hut.calcArray(
              funStr,
              tab1.map(arr => arr[idx]),
              footFormat[idx]
            )
          : item.content;
      }

      function showPageNumber(data) {
        if (!show_pagenum) return;
        // Footer
        var str = 'Страница ' + doc.internal.getNumberOfPages();
        // Total page number plugin only available in jspdf v1.0+
        // if (typeof doc.putTotalPages === 'function') {
        //  str = str + ' of ' + totalPagesExp
        // }
        const fstyle = mes.bold_pagenum ? 'bold' : 'normal';
        doc.setFont(defaultFont, fstyle);
        const fsize = mes.fontSize_pagenum > 0 && mes.fontSize_pagenum < 20 ? mes.fontSize_pagenum : 10;
        doc.setFontSize(fsize);
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
    if (rgbColors[val]) return rgbColors[val];
    // rgba(0,0,0,0) - альфа канал=0 ->transparent
    if (!val || val == 'transparent' || val == 'rgba(0,0,0,0)') return false;
    if (val.startsWith('rgba(')) {
      const arr = val.substr(5).split(',');
      if (arr.length >= 3) {
        const colors = arr.slice(0, 3).map(el => Number(el));
        return colors;
      }
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
