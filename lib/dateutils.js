/**
 * dateutils.js
 *
 * Функции работы с датой и временем
 */

const dict = require('../dict');

exports.getDiscreteMs = getDiscreteMs;
exports.isFirstDayOfMonth = isFirstDayOfMonth;
exports.isLastDayOfMonth = isLastDayOfMonth;
exports.isToday = isToday;
exports.isTimeZero = isTimeZero;
exports.getLastDayTimeOfMonth = getLastDayTimeOfMonth;
exports.getLastTimeOfDay = getLastTimeOfDay;
exports.getLastDayTimeOfNextMonth = getLastDayTimeOfNextMonth;
exports.getPeriodStr = getPeriodStr;
exports.getPeriodDtStr = getPeriodDtStr;
exports.wholeYear = wholeYear;
exports.wholeMonth = wholeMonth;

exports.getYear = getYear;
exports.getMonthAndYear = getMonthAndYear;
exports.getDateTimeFor = getDateTimeFor;

exports.isTheSameDate = isTheSameDate;

function getDiscreteMs(discrete) {
  const oneMin = 60000;
  switch (discrete) {
    case 'min': return oneMin;
    case 'hour': return oneMin*60;
    case 'day': return oneMin*60*24;
    default: 
  }
}

function isFirstDayOfMonth(ts) {
  if (!ts) return false;
  let dt = new Date(Number(ts));
  return dt.getDate() == 1;
}

function isLastDayOfMonth(ts) {
  if (!ts) return false;
  let dt = new Date(Number(ts));
  let tsdate = dt.getDate();
  dt.setMonth(dt.getMonth() + 1, 0);
  return dt.getDate() == tsdate;
}

function isToday(ts) {
  if (!ts) return false;
  let dt = new Date(Number(ts));
  let today = new Date();

  return (
    dt.getFullYear() == today.getFullYear() && dt.getMonth() == today.getMonth() && dt.getDate() == today.getDate()
  );
}

function isTimeZero(ts) {
  if (!ts) return false;
  let dt = new Date(Number(ts));
  return dt.getHours() == 0 && dt.getMinutes() == 0 && dt.getSeconds() == 0 && dt.getMilliseconds() == 0;
}

function getLastDayTimeOfMonth(ts) {
  if (!ts) return false;
  let dt = new Date(Number(ts));
  return new Date(dt.getFullYear(), dt.getMonth() + 1, 0, 23, 59, 59).getTime();
}

function getLastTimeOfDay(ts) {
  let dt = new Date(Number(ts));
  let res = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);
  return res.getTime();
}

function getLastDayTimeOfNextMonth(ts) {
  if (!ts) return false;
  let dt = new Date(Number(ts));
  let year = dt.getFullYear();
  let nextMon =  dt.getMonth()+1;
  if (nextMon > 11) {
    nextMon = 0;
    year += 1;
  } 
  return new Date(year, nextMon + 1, 0, 23, 59, 59).getTime();
}

function getPeriodDtStr(fromTs, toTs) {
  let from = new Date(Number(fromTs));
  let to = new Date(Number(toTs));
  return getDateTimeFor(from, 'reportdt') + ' - ' + getDateTimeFor(to, 'reportdt');
}


function getPeriodStr(fromTs, toTs) {
  let from = new Date(Number(fromTs));
  let to = new Date(Number(toTs));

  if (wholeYear(from, to)) return getYear(fromTs);
  if (wholeMonth(from, to)) return getMonthAndYear(fromTs);

  return getDateTimeFor(from, 'reportd') + ' - ' + getDateTimeFor(to, 'reportd');
}

function wholeYear(from, to) {
  return (
    from.getYear() == to.getYear() &&
    from.getDate() == 1 &&
    from.getMonth() == 0 &&
    to.getDate() == 31 &&
    to.getMonth() == 11
  );
}

function wholeMonth(from, to) {
  let lastDateOfMonth = new Date(to.getYear(), to.getMonth() + 1, 0);
  return (
    from.getYear() == to.getYear() &&
    from.getMonth() == to.getMonth() &&
    from.getDate() == 1 &&
    to.getDate() == lastDateOfMonth.getDate()
  );
}

function getMonthAndYear(ts) {
  let dt = new Date(Number(ts));
 
  // let mon = jdb.find('months', dt.getMonth() + 1);
  let mon = dt.getMonth() + 1;
  const monStr = dict.get('months', mon);
  if (monStr) mon = monStr;
  return mon ? mon + ' ' + dt.getFullYear() : '';
}

function getYear(ts) {
  let dt = new Date(Number(ts));
  return dt ? +dt.getFullYear() : '';
}


/**  Дата [время] в виде строки  заданного формата
 *    @param  {Date} dt - дата
 *    @param  {String} format
 *    @return {String}
 */
function getDateTimeFor(dt, format) {
  
  switch (format) {
    case 'dailyname': // YYMMDD
      return String(dt.getFullYear() - 2000) + pad(dt.getMonth() + 1) + pad(dt.getDate());

    case 'monthname': // monthname
      return dict.get('months', dt.getMonth() + 1);

    case 'monthnameyyyy': // monthname YYyy
      return dict.get('months', dt.getMonth() + 1)+' '+ dt.getFullYear() ;


    case 'logname': // YYYYMMDD
      return String(dt.getFullYear()) + pad(dt.getMonth() + 1) + pad(dt.getDate());

    case 'id': // YYMMDDHHMMSSMMMM
      return (
        String(dt.getFullYear() - 2000) +
        pad(dt.getMonth() + 1) +
        pad(dt.getDate()) +
        pad(dt.getHours()) +
        pad(dt.getMinutes()) +
        pad(dt.getSeconds()) +
        pad(dt.getMilliseconds(), 3)
      );

     case 'created': // YYYY_MM_DD_HH_MM_SS_MMMM
      return (
        String(dt.getFullYear()) +'_'+
        pad(dt.getMonth() + 1) +'_'+
        pad(dt.getDate()) +'_'+
        pad(dt.getHours()) +'h_'+
        pad(dt.getMinutes()) +'m_'+
        pad(dt.getSeconds()) +'s_'+
        pad(dt.getMilliseconds(), 3)
      );

    case 'trendid': // YYMMDDHHMMSS
      return (
        String(dt.getFullYear() - 2000) +
        pad(dt.getMonth() + 1) +
        pad(dt.getDate()) +
        pad(dt.getHours()) +
        pad(dt.getMinutes()) +
        pad(dt.getSeconds())
      );

    case 'shortdt': // DD.MM HH.MM.SS
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes()) +
        ':' +
        pad(dt.getSeconds())
      );

    case 'onlytime': // HH.MM.SS
      return pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());

    case 'dtms': // DD.MM.YY HH:MM:SS.mmm
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        '.' +
        String(dt.getFullYear() - 2000) +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes()) +
        ':' +
        pad(dt.getSeconds()) +
        '.' +
        pad(dt.getMilliseconds(), 3)
      );

    case 'shortdtms': // DD.MM HH:MM:SS.mmm
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes()) +
        ':' +
        pad(dt.getSeconds()) +
        '.' +
        pad(dt.getMilliseconds(), 3)
      );

    case 'reportdt': // DD.MM.YYYY HH.MM
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        '.' +
        dt.getFullYear() +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes())
      );

    case 'reportd': // DD.MM.YYYY
      return pad(dt.getDate()) + '.' + pad(dt.getMonth() + 1) + '.' + dt.getFullYear();
  
    default:
      // DD.MM.YYYY HH.MM.SS
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        '.' +
        dt.getFullYear() +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes()) +
        ':' +
        pad(dt.getSeconds())
      );
  }
}

function pad(val, width = 2) {
  return String(val).padStart(width, '0');
}

/**  Сравнивает две даты на равенство (день, месяц, год)
 *   Можно передать Date или timestamp
 *    @param  {Date|timestamp} adt1 - дата
 *    @param  {Date|timestamp} adt2 - дата
 *    @return {Bool} true, если дата совпадает
 */
function isTheSameDate(adt1, adt2) {
  const dt1 = getDateObj(adt1);
  const dt2 = getDateObj(adt2);

  return dt1 && dt2
    ? dt1.getFullYear() == dt2.getFullYear() && dt1.getMonth() == dt2.getMonth() && dt1.getDate() == dt2.getDate()
    : false;
}

function getDateObj(dt) {
  if (dt instanceof Date) return dt;
  if (typeof dt == 'number') return new Date(dt);
}