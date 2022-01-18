const util = require('util');
// const fs = require("fs");
const path = require('path');
const { jsPDF } = require('jspdf'); // will automatically load the node version

const { applyPlugin } = require('../node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.js');

const elements = [{ type: 'table', x: 20, y: 20, w: 100, h: 300 }];
// const tabledata = [['1', '42','24', '66'], ['1', '44','26', '70']]
const tabledata = [];
  
makepdf(elements, tabledata);

function makepdf(elements, tabledata, targetFolder) {
  let doc;
  let defaultFont;
  let finalY;
  console.log('makepdfjs START');
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
    addText({ text: 'Утверждаю_____', textSize: 10, x: 400, y: finalY + 10 });
    doc.addPage();
    console.log('doc.internal.getCurrentPageInfo()=' + util.inspect(doc.internal.getCurrentPageInfo()));
    const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
    addText({ text: 'Последняя страница номер ' + pageNumber, textSize: 19, x: 10, y: 10 });
    */
    const filename = path.resolve('./', 'testreport1.pdf');
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

  function addTable(item) {
    const test_head = [
      { content: '1 столбец', styles: { font: defaultFont, fontSize: 8, halign: 'left', fillColor: [255, 0, 0] } },
      { content: '2 столбец', styles: { font: defaultFont, fontSize: 10, halign: 'left', fillColor: [80, 80, 80] } },
      { content: '3 столбец', styles: { font: defaultFont, fontSize: 12, halign: 'left', fillColor: [0, 0, 0] } },
      {
        content: '4 столбец',
        styles: { font: defaultFont, fontSize: 16, fontStyle: 'bold', halign: 'right', fillColor: false, textColor: 0, lineWidth: 0.1 }
      }
    ];
    /*
    const test_tabledata = [
      [
        { content: '1', styles: { font: defaultFont, fontSize: 8, halign: 'left', lineWidth: 0.1 } },
        { content: '42', styles: { font: defaultFont, font: defaultFont, fontSize: 10, halign: 'left', lineWidth: 0.1  } },
        { content: '24', styles: { font: defaultFont, fontSize: 12, halign: 'left', lineWidth: 0.1  } },
        { content: '66', styles: { font: defaultFont, fontSize: 16, fontStyle: 'bold', halign: 'right', lineWidth: 0.1  } }
      ]
    ];
    */
   const test_tabledata = [
    [
      { content: '1', styles: { font: defaultFont, fontSize: 8, halign: 'left', lineWidth: 0.1 } },
      { content: '42', styles: { font: defaultFont, font: defaultFont, fontSize: 10, halign: 'left', lineWidth: 0.1  } },
      { content: '24', styles: { font: defaultFont, fontSize: 12, halign: 'left', lineWidth: 0.1  } },
      { content: '66', styles: { font: defaultFont, fontSize: 16, fontStyle: 'bold', halign: 'right', lineWidth: 0.1  } }
    ]
  ];

  const body = [['1','22','33','55']];

    doc.autoTable({
      startY: item.y,
      // tableLineWidth: 2, // граница вокруг
      // theme: 'grid',
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      /*
      headStyles: {
        font: defaultFont,
        fontSize: 18,
        fillColor: [80, 80, 80]
      },
      */
      // head: [['Дата', 'Счетчик 1', 'Счетчик 2', 'Всего']],
      head: [test_head],
      body,

      /*
      footStyles: {
        font: defaultFont,
        fontSize: 18
      },
      bodyStyles: {
        font: defaultFont,
        fontSize: 15
      }
      */
      didDrawCell: data => {
        // console.log('didDrawCell data='+util.inspect(data))
        if (data.section == 'body') {
          console.log('didDrawCell cell=' + util.inspect(data.cell));
          console.log('didDrawCell column=' + util.inspect(data.column));
          Object.assign(data.cell.styles, {fontSize: data.cell.styles+data.column.index*2});
        }
      }
    });
    finalY = doc.lastAutoTable.finalY;
    console.log('finalY AFTER table=' + finalY);
  }
}

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

/*
const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'px',
  format: [595.28, 841.89]
});


doc.text("Hello world!", 0, 0);


const img = '/var/lib/intrahouse-d/plugins/reportmaker/ih.png';
if (fs.existsSync(img)) {
  console.log('addImage file='+img)
  const imgData = fs.readFileSync(img);
  // ФАЙЛ нужно ЗАГРУЗИТЬ!!
  doc.addImage(imgData, 'PNG', 15, 15, 141, 141); 
} else {
  console.log('Not found file '+img)
}



var generateData = function(amount) {
  var result = [];
  var data = {
    coin: "100",
    game_group: "GameGroup",
    game_name: "XPTO2",
    game_version: "25",
    machine: "20485861",
    vlt: "0"
  };
  for (var i = 0; i < amount; i += 1) {
    data.id = (i + 1).toString();
    result.push(Object.assign({}, data));
  }
  return result;
};

function createHeaders(keys) {
  var result = [];
  for (var i = 0; i < keys.length; i += 1) {
    result.push({
      id: keys[i],
      name: keys[i],
      prompt: keys[i],
      width: 65,
      align: "center",
      padding: 0
    });
  }
  return result;
}

var headers = createHeaders([
  "id",
  "coin",
  "game_group",
  "game_name",
  "game_version",
  "machine",
  "vlt"
]);

// console.log('doc.context2d.getHorizontalCoordinate='+ doc.context2d.getHorizontalCoordinate)
console.log('doc.context2d.getHorizontalCoordinate='+ doc.getHorizontalCoordinate)
doc.table(0, 200, generateData(20), headers, { autoSize: true });

// doc.text("Happy end!", 10, 100);

// var doc = new jsPDF({ putOnlyUsedFonts: true, orientation: "landscape" });
*/

/**
 * didDrawCell section=body
didDrawCell table=t {
  pageNumber: 1,
  pageCount: 1,
  id: undefined,
  settings: {
    includeHiddenHtml: false,
    useCss: false,
    theme: 'grid',
    startY: 20,
    margin: { left: 20, top: 20, right: 20, bottom: 20 },
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    tableWidth: 'auto',
    showHead: 'everyPage',
    showFoot: 'everyPage',
    tableLineWidth: 0,
    tableLineColor: 200,
    horizontalPageBreak: false,
    horizontalPageBreakRepeat: null
  },
  styles: {
    styles: {},
    headStyles: {},
    bodyStyles: {},
    footStyles: {},
    alternateRowStyles: {},
    columnStyles: {}
  },
  hooks: {
    didParseCell: [],
    willDrawCell: [],
    didDrawCell: [ [Function: didDrawCell] ],
    didDrawPage: []
  },
  columns: [
    t {
      wrappedWidth: 35.583984375,
      minReadableWidth: 30.6796875,
      minWidth: 7.5,
      width: 103.18975634758527,
      dataKey: 0,
      raw: [Object],
      index: 0
    },
    t {
      wrappedWidth: 42.60498046875,
      minReadableWidth: 36.474609375,
      minWidth: 7.5,
      width: 123.54989557753655,
      dataKey: 1,
      raw: [Object],
      index: 1
    },
    t {
      wrappedWidth: 49.6259765625,
      minReadableWidth: 42.26953125,
      minWidth: 7.5,
      width: 143.91003480748782,
      dataKey: 2,
      raw: [Object],
      index: 2
    },
    t {
      wrappedWidth: 63.66796875,
      minReadableWidth: 53.859375,
      minWidth: 7.5,
      width: 184.63031326739036,
      dataKey: 3,
      raw: [Object],
      index: 3
    }
  ],
  head: [
    t {
      height: 21.299999999999997,
      raw: [Array],
      index: 0,
      section: 'head',
      cells: [Object],
      spansMultiplePages: false
    }
  ],
  body: [
    t {
      height: 21.299999999999997,
      raw: [Array],
      index: 0,
      section: 'body',
      cells: [Object],
      spansMultiplePages: false
    }
  ],
  foot: [],
  startPageNumber: 1
}
didDrawCell settings={
  includeHiddenHtml: false,
  useCss: false,
  theme: 'grid',
  startY: 20,
  margin: { left: 20, top: 20, right: 20, bottom: 20 },
  pageBreak: 'auto',
  rowPageBreak: 'auto',
  tableWidth: 'auto',
  showHead: 'everyPage',
  showFoot: 'everyPage',
  tableLineWidth: 0,
  tableLineColor: 200,
  horizontalPageBreak: false,
  horizontalPageBreakRepeat: null
}

 */
/**
 * didDrawCell section=head
didDrawCell table=t {
  pageNumber: 1,
  pageCount: 1,
  id: undefined,
  settings: {
    includeHiddenHtml: false,
    useCss: false,
    theme: 'grid',
    startY: 20,
    margin: { left: 20, top: 20, right: 20, bottom: 20 },
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    tableWidth: 'auto',
    showHead: 'everyPage',
    showFoot: 'everyPage',
    tableLineWidth: 0,
    tableLineColor: 200,
    horizontalPageBreak: false,
    horizontalPageBreakRepeat: null
  },
  styles: {
    styles: {},
    headStyles: {},
    bodyStyles: {},
    footStyles: {},
    alternateRowStyles: {},
    columnStyles: {}
  },
  hooks: {
    didParseCell: [],
    willDrawCell: [],
    didDrawCell: [ [Function: didDrawCell] ],
    didDrawPage: []
  },
  columns: [
    t {
      wrappedWidth: 35.583984375,
      minReadableWidth: 30.6796875,
      minWidth: 7.5,
      width: 103.18975634758527,
      dataKey: 0,
      raw: [Object],
      index: 0
    },
    t {
      wrappedWidth: 42.60498046875,
      minReadableWidth: 36.474609375,
      minWidth: 7.5,
      width: 123.54989557753655,
      dataKey: 1,
      raw: [Object],
      index: 1
    },
    t {
      wrappedWidth: 49.6259765625,
      minReadableWidth: 42.26953125,
      minWidth: 7.5,
      width: 143.91003480748782,
      dataKey: 2,
      raw: [Object],
      index: 2
    },
    t {
      wrappedWidth: 63.66796875,
      minReadableWidth: 53.859375,
      minWidth: 7.5,
      width: 184.63031326739036,
      dataKey: 3,
      raw: [Object],
      index: 3
    }
  ],
  head: [
    t {
      height: 21.299999999999997,
      raw: [Array],
      index: 0,
      section: 'head',
      cells: [Object],
      spansMultiplePages: false
    }
  ],
  body: [
    t {
      height: 21.299999999999997,
      raw: [Array],
      index: 0,
      section: 'body',
      cells: [Object],
      spansMultiplePages: false
    }
  ],
  foot: [],
  startPageNumber: 1
}
didDrawCell settings={
  includeHiddenHtml: false,
  useCss: false,
  theme: 'grid',
  startY: 20,
  margin: { left: 20, top: 20, right: 20, bottom: 20 },
  pageBreak: 'auto',
  rowPageBreak: 'auto',
  tableWidth: 'auto',
  showHead: 'everyPage',
  showFoot: 'everyPage',
  tableLineWidth: 0,
  tableLineColor: 200,
  horizontalPageBreak: false,
  horizontalPageBreakRepeat: null
}

 */