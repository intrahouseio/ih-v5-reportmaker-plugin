/**
 *  Функции, которые можно напрямую использовать в обработчиках
 */


const hut = require('./hut');
const dateutils = require('./dateutils');
const customtable = require('./customtable');



module.exports = {
  
  customFolder:'',

  async getCustomData( name, filter, opt) {
    return customtable.getData(this.customFolder, name, filter, opt);
  },

  isTheSameDate(d1,d2) {
    return dateutils.isTheSameDate(d1,d2);
  },

  getDateTimeStr(adt, format) {
    let dt;
    if (hut.isTs(adt)) dt = new Date(adt);
    if (adt instanceof Date) dt = adt;

    return dt ? dateutils.getDateTimeFor(dt, format) : '';
  },

  addDiscreteToTs(ts, discrete) {
    switch (discrete) {
      case 'minute':
        return ts + 60 * 1000;
      case 'hour':
        return ts + 3600 * 1000;
      case 'day':
        return ts + 24 * 3600 * 1000;
      case 'month':
        return dateutils.getLastDayTimeOfNextMonth(ts);

      default:
        return ts;
    }
  }
};
