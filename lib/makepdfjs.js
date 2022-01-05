/**
 * makepdf.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
// const PdfMakePrinter = require('pdfmake');
const { jsPDF } = require('jspdf');
const sizeOf = require('image-size');

module.exports = function(elements, columns, tabledata, targetFolder) {
  console.log('makePDF_JS start');

  const keys = ['date', 'value1', 'value2', 'total'];
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [595.28, 841.89]
  });

  try {
    doc.addFont(path.join(__dirname, '../fonts/Roboto-Regular.ttf'), 'Roboto', 'normal');
    doc.addFont(path.join(__dirname, '../fonts/Roboto-Medium.ttf'), 'Roboto', 'bold');
    doc.addFont(path.join(__dirname, '../fonts/Roboto-Italic.ttf'), 'Roboto', 'italics');

    doc.setFont('Roboto'); // set font

    /*
    doc.setFontSize(10);
    doc.text('Отчет энергопотребления', 15, 15);

    // const data = getData();
    // doc.table(0, 20, getData(), getHeaders(), { autoSize: false });
    var headers = createHeaders(keys);
   const data = generate(5);
   console.log('headers = '+util.inspect(headers))
   console.log('data = '+util.inspect(data))

    doc.table(0, 20, data, headers, { autoSize: true });
    */
    elements.forEach(el => {
      switch (el.type) {
        case 'image':
          addImage(el);
          break;
        case 'text':
          addText(el);
          break;
        default:
      }
    });

    const filename = path.resolve('./', 'report1.pdf');
    console.log('MAKE PDF ' + filename);
    doc.save(filename);

    console.log('response:1');
    return { response: 1, filename };
  } catch (e) {
    console.log('response:0 error=' + util.inspect(e));
  }

  function addImage(item) {
    if (!item.filename) return;

    // const svg = loadBinaryResource("reference/piechart.svg");
    // await doc.addSvgAsImage(svg, 0, 0, 815, 481);

    if (fs.existsSync(item.filename)) {
      console.log('addImage file=' + item.filename);
      const dimensions = sizeOf(item.filename);
      console.log('SIZEOF = ' + util.inspect(dimensions));
      const ratio = getRatio(item.w, item.h, dimensions.width, dimensions.height);
      const centerShift_x = item.x + (item.w - dimensions.width * ratio) / 2;
      const centerShift_y = item.y + (item.h - dimensions.height * ratio) / 2;
      // centerShift_x,centerShift_y,img.width*ratio, img.height*ratio

      // ФАЙЛ нужно ЗАГРУЗИТЬ!!
      const imgData = fs.readFileSync(item.filename);
      doc.addImage(imgData, 'SVG', item.x, item.y, item.w, item.h);

      // doc.addImage(imgData, 'PNG', 15, 15, 141, 141);
      // doc.addImage(imgData, 'JPEG', item.x, item.y, dimensions.width, dimensions.height);
      // doc.addImage(imgData, 'JPEG', centerShift_x, centerShift_y, dimensions.width * ratio, dimensions.height * ratio);
    }
  }

  function getRatio(rec_width, rec_height, img_width, img_height) {
    const hRatio = rec_width / img_width;
    const vRatio = rec_height / img_height;
    return Math.min(hRatio, vRatio);
  }

  function addText(item) {
    doc.setFontSize(item.textSize);
    doc.text(item.text, item.x, item.y, {baseline:'top'});
  }

  function getData() {
    /*
    console.log('tabledata ='+util.inspect(tabledata))
      return tabledata.map((item,i) => {
        const one = {id:(i + 1).toString()};
        one[keys[0]] = item[0]
        one[keys[1]] = item[1]
        one[keys[2]] = item[2]
        one[keys[3]] = item[3]
        return one;
      })
      */
    const amount = 5;
    var result = [];
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
    console.log('DATA result=' + util.inspect(result));
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

  function createHeaders(keys) {
    var result = [];
    for (var i = 0; i < keys.length; i += 1) {
      result.push({
        id: keys[i],
        name: keys[i],
        prompt: keys[i],
        width: 65,
        align: 'center',
        padding: 0
      });
    }
    return result;
  }

  /*
  function getHeaders() {
 
  console.log('columns '+util.inspect(columns))
    return columns.map((item, i) => ({
      id:keys[i],
      name: item.name,
      prompt: item.name,
      width: 165,
      align: 'center',
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

  function trim(str) {
    return str.replace(/^\s+|\s+$/gm, '');
  }
};
