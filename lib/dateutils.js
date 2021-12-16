/**
 * dateutils.js
 *
 * Функции работы с датой и временем
 */

exports.isFirstDayOfMonth = isFirstDayOfMonth;
exports.isLastDayOfMonth = isLastDayOfMonth;
exports.isToday = isToday;
exports.isTimeZero = isTimeZero;
exports.getLastDayTimeOfMonth = getLastDayTimeOfMonth;
exports.getLastTimeOfDay = getLastTimeOfDay;
exports.getPeriodStr = getPeriodStr;
exports.wholeYear = wholeYear;
exports.wholeMonth = wholeMonth;

exports.getYear = getYear;
exports.getMonthAndYear = getMonthAndYear;
exports.getDateTimeFor = getDateTimeFor;

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
  const mon = dt.getMonth() + 1;
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
  console.log('getDateTimeFor '+ typeof dt)
  switch (format) {
    case 'dailyname': // YYMMDD
      return String(dt.getFullYear() - 2000) + pad(dt.getMonth() + 1) + pad(dt.getDate());

    case 'monthname': // YYMM
      return String(dt.getFullYear() - 2000) + pad(dt.getMonth() + 1);

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
