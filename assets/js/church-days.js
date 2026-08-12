/* =============================================================================
   Месяцеслов: полный круг памятей дня

   Своя таблица в church-calendar.js держит праздники и чтимые памяти — этого
   хватает на заголовок, но в обычный день сказать нечего. Здесь подхватывается
   выгрузка assets/data/days/<год>-<месяц>.json (её делает tools/fetch-days.js):
   месяц тянется один раз на весь сеанс, и только тот, который открыли.

   Файла нет или сеть молчит — страница остаётся на своей таблице, поэтому
   вызов ничего не ждёт и ничего не ломает.
   ========================================================================== */

window.ChurchDays = (function () {
  'use strict';

  var cache = {};

  /* Путь к папке приходит из разметки: страницы лежат на разной глубине */
  function base(el) {
    return (el && el.dataset && el.dataset.daysBase) || 'assets/data/days/';
  }

  function month(iso, dir) {
    var key = iso.slice(0, 7);

    if (!cache[key]) {
      cache[key] = fetch(dir + key + '.json')
        .then(function (res) { return res.ok ? res.json() : null; })
        .catch(function () { return null; });
    }

    return cache[key];
  }

  /* Отдаёт запись дня: { o, w, g, f, i: [[текст, знак], …] } */
  function load(iso, el) {
    return month(iso, base(el)).then(function (data) {
      if (!data) return null;
      return data[String(Number(iso.slice(8, 10)))] || null;
    });
  }

  /* Знак праздника у azbyka: 1 — двунадесятый, 2 — великий, 3 — полиелей,
     4 — славословие, 5 — шестеричный, дальше памяти без знака. В заголовок
     идёт самая высокая память дня, остальные — списком под ней. */
  function lead(day) {
    if (!day || !day.i || !day.i.length) return -1;

    var best = -1;
    var rank = 99;

    day.i.forEach(function (item, i) {
      if (item[1] < rank) { rank = item[1]; best = i; }
    });

    return rank <= 5 ? best : 0;
  }

  /* Весь месяц разом — для сетки календаря: файл один, запрос тоже один */
  function loadMonth(iso, el) {
    return month(iso, base(el));
  }

  return { load: load, loadMonth: loadMonth, lead: lead };
})();
