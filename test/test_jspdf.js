
const fs = require("fs"); 
const { jsPDF } = require("jspdf"); // will automatically load the node version

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

doc.save("a4.pdf");