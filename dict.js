/**
 * dict.js
 * Объект-словарь
 * 
 */

const path = require('path');

const hut = require('./lib/hut');

module.exports = {
  start(localePath, lang) {
   
    this.dict = {};
    let filename = path.resolve(localePath, lang, 'month.json'); 
    this.dict.months = hut.loadOneDict(filename);
  },
  // 
  get(dictName, key) {
    return this.dict[dictName] ? this.dict[dictName][key] : '';
  }
}