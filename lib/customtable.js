/**
 * customtable.js
 */
const util = require('util');

const Datastore = require('nedb');

const hut = require('./hut');

async function getData(folder, name, filter, opt) {
  const filename = folder + '/' + name + '.db';
  // console.log('CUSTOMTABLE '+filename)
  const db = await load(filename);
  return get(db, filter, opt);
}

function load(filename) {
  return new Promise((resolve, reject) => {
    const db = new Datastore({ filename, autoload: false });
    db.loadDatabase(err => {
      if (!err) {
        resolve(db);
      } else reject(err);
    });
  });
}

function get(db, filter = {}, opt = {}) {
  // if (!db) return Promise.reject({ error: 'SOFTERR', message: 'No collection! ' });

  if (opt.sort) {
    const { sort, fields } = opt;
    const projection = fields || {}; // Передается projection - список полей: {name:1, txt:1}
    return new Promise((resolve, reject) => {
      db.find(filter, projection)
        .sort(sort)
        .exec((err, data) => {
          if (!err) {
            resolve(data);
          } else reject(err);
        });
    });
  }

  const { order, fields } = opt;
  const projection = fields || {}; // Передается projection - список полей: {name:1, txt:1}
  return new Promise((resolve, reject) => {
    db.find(filter, projection, (err, data) => {
      // console.log('after find err=' + util.inspect(err)+' docs='+util.inspect(data));
      if (!err) {
        resolve(order ? data.sort(hut.byorder(order)) : data);
      } else reject(err);
    });
  });
}

module.exports = {
  getData
};
