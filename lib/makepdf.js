/**
 * makepdf.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const PdfMakePrinter = require('pdfmake');

module.exports = function(content, columns, tabledata, targetFolder) {
  console.log('makePDF start');
  let docDefinition;
  try {
    checkInData();
    docDefinition = {
      content: content.blocks.map(item => block(item, { columns, tabledata }))
    };
  } catch (e) {
    return Promise.reject(e);
  }

  console.log('docDefinition = '+util.inspect(docDefinition, null, 4))
  return new Promise((resolve, reject) => {
    const options = {};
    const fontDescriptors = {
      Roboto: {
        normal: path.join(__dirname, '../fonts/Roboto-Regular.ttf'),
        bold: path.join(__dirname, '../fonts/Roboto-Medium.ttf'),
        italics: path.join(__dirname, '../fonts/Roboto-Italic.ttf'),
        bolditalics: path.join(__dirname, '../fonts/Roboto-MediumItalic.ttf')
      }
    };

    const printer = new PdfMakePrinter(fontDescriptors);


    // createPdfBinary(pdfDoc, binary => callback(null, binary));
    const pdfDoc = printer.createPdfKitDocument(docDefinition, options);
    const filename = 'document.pdf';
    const writeStream = fs.createWriteStream(filename);
    pdfDoc.pipe(writeStream);
    pdfDoc.on('end',  () => {
      resolve(filename);
    });

    pdfDoc.end();

    writeStream.on('error', err => {
      reject(err);
    });
  });

  function checkInData() {
    if (!tabledata) throw { message: 'Missing data array!' };
    if (!Array.isArray(tabledata)) throw { message: 'Expected data array!' };

    tabledata.forEach((item, index) => {
      if (!Array.isArray(item)) throw { message: 'Invalid data element with index ' + index + '! Expected array!' };
    });
  }

  function block(item, params) {
    switch (item.block_type) {
      case 'text':
        return blockText(item, params);
      case 'table':
        return blockTable(item, params);
      default:
        return {};
    }
  }

  function trim(str) {
    return str.replace(/^\s+|\s+$/gm, '');
  }

  function rgbaToHex(rgba) {
    const parts = rgba.substring(rgba.indexOf('(')).split(',');
    const r = parseInt(trim(parts[0].substring(1)), 10);
    const g = parseInt(trim(parts[1]), 10);
    const b = parseInt(trim(parts[2]), 10);
    //      a = parseFloat(trim(parts[3].substring(0, parts[3].length - 1))).toFixed(2);

    return '#' + r.toString(16) + g.toString(16) + b.toString(16);
  }

  /*
    function createPdfBinary(pdfDoc, cb) {
      console.log('createPdfBinary START');
      const doc = printer.createPdfKitDocument(pdfDoc);
      console.log('createPdfKitDocument OK');
      const chunks = [];

      doc.on('data', chunk => {
        chunks.push(chunk);
      });
      doc.on('end', () => {
        cb(Buffer.concat(chunks));
      });
      doc.end();
    }
    */

  function blockText(item) {
    return {
      text: item.text,
      fontSize: item.fontSize || 16,
      bold: item.bold,
      italics: item.italics,
      alignment: item.align,
      margin: [item.marginLeft || 5, item.marginTop || 5, item.marginRight || 5, item.marginBottom || 5]
    };
  }

  function styleHeader(row, style) {
    return row.map((value, key) => ({
      text: value,
      alignment: style.headerAlign,
      fontSize: style.headerFontSize || 14,
      bold: false,
      italics: false
    }));
  }

  function styleRow(row, columns) {
    return row.map((value, key) => ({
      text: value,
      alignment: columns[key].align,
      fontSize: columns[key].fontSize || 14,
      bold: columns[key].bold,
      italics: columns[key].italics
    }));
  }

  function blockTable(item, params) {
    // console.log('WARN: makePdf blockTable params =' + JSON.stringify(params));
    const header = params.columns.map(i => ({ text: i.name }));
    const widths = params.columns.map(i => `${i.width}%`);
    const color1 = item.rowColor ? rgbaToHex(item.rowColor1) : null;
    const color2 = item.rowColor ? rgbaToHex(item.rowColor2) : null;
    params.tabledata.unshift(header);
    return {
      table: {
        headerRows: 1,
        widths,
        heights: item.rowHeight || 16,
        body: [styleHeader(params.tabledata[0], item)].concat(
          params.tabledata.slice(1).map(row => styleRow(row, params.columns))
        )
      },
      layout: {
        fillColor(i) {
          return i % 2 === 0 ? color1 : color2;
        }
      }
    };
  }
};
