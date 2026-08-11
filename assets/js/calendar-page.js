/* =============================================================================
   Полный церковный календарь: сетка месяца и карточка выбранного дня.
   Данные считает assets/js/church-calendar.js — сети и сборки не нужно.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.getElementById('calendar');
  if (!root || !window.ChurchCalendar) return;

  var CC = window.ChurchCalendar;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var grid = root.querySelector('[data-grid]');
  var monthLabel = root.querySelector('[data-month-label]');
  var todayBtn = root.querySelector('[data-month-today]');
  var card = root.querySelector('[data-day-card]');

  var today = CC.today();

  // Адрес вида ?date=2026-08-28 открывает нужный месяц и выделяет день
  var fromUrl = /[?&]date=(\d{4})-(\d{2})-(\d{2})/.exec(window.location.search);
  var selected = fromUrl
    ? CC.utc(parseInt(fromUrl[1], 10), parseInt(fromUrl[2], 10), parseInt(fromUrl[3], 10))
    : today;

  var view = { year: selected.getUTCFullYear(), month: selected.getUTCMonth() + 1 };

  /* --- Сетка месяца ------------------------------------------------------- */

  function drawGrid() {
    var days = CC.month(view.year, view.month);
    var parts = [];

    // Неделя в сетке начинается с понедельника — как в гражданских календарях
    CC.WEEKDAYS_SHORT.slice(1).concat(CC.WEEKDAYS_SHORT[0]).forEach(function (w) {
      parts.push('<div class="calendar__weekday">' + w + '</div>');
    });

    var firstDow = days[0].date.getUTCDay();
    var lead = (firstDow + 6) % 7;
    for (var i = 0; i < lead; i++) parts.push('<div class="calendar__cell calendar__cell--empty"></div>');

    days.forEach(function (info) {
      var cls = ['calendar__cell'];
      if (info.date.getUTCDay() === 0) cls.push('calendar__cell--sunday');
      if (info.rank > 0) cls.push('calendar__cell--great');
      if (info.iso === CC.iso(today)) cls.push('calendar__cell--today');
      if (info.fast.level === 'strict') cls.push('calendar__cell--strict');
      else if (info.fast.level === 'fast' || info.fast.level === 'cheese') cls.push('calendar__cell--fast');

      parts.push(
        '<button class="' + cls.join(' ') + '" type="button" data-date="' + info.iso + '"' +
        ' aria-pressed="' + (info.iso === CC.iso(selected)) + '">' +
        '<span class="calendar__num">' + info.dayNum + '</span>' +
        (info.title ? '<span class="calendar__label">' + escapeHtml(info.title) + '</span>' : '') +
        '</button>'
      );
    });

    var tail = (7 - ((lead + days.length) % 7)) % 7;
    for (var j = 0; j < tail; j++) parts.push('<div class="calendar__cell calendar__cell--empty"></div>');

    grid.innerHTML = parts.join('');
    monthLabel.textContent = CC.MONTHS_NOM[view.month - 1] + ' ' + view.year;

    var atToday = view.year === today.getUTCFullYear() && view.month === today.getUTCMonth() + 1;
    if (todayBtn) todayBtn.hidden = atToday && CC.iso(selected) === CC.iso(today);
  }

  /* --- Карточка дня ------------------------------------------------------- */

  function drawCard(animate) {
    var info = CC.day(selected);
    var rest = info.items.slice(1);

    card.innerHTML =
      // Образ дня. Страница лежит в подпапке — путь идёт на уровень выше.
      // Картинки нет — фигура убирает себя, карточка остаётся целой.
      '<figure class="calendar__day-icon"><img src="../assets/img/feasts/' + info.image +
        '.jpg" alt="" loading="lazy" decoding="async" onerror="this.parentNode.hidden = true"></figure>' +
      '<p class="calendar__day-date"><b>' + info.dayNum + '</b><span>' +
        info.monthName + ' ' + info.year + '<br>' + info.weekday +
      '</span></p>' +
      '<p class="calendar__day-old">' + info.oldStyle + ' по старому стилю</p>' +
      '<p class="calendar__day-week">' + (info.tone ? info.week + ', ' + info.tone : info.week) + '</p>' +
      (info.title
        ? '<p class="calendar__day-feast' + (info.rank > 0 ? ' calendar__day-feast--great' : '') + '">' +
            escapeHtml(info.title) + '</p>'
        : '') +
      (rest.length
        ? '<ul class="calendar__day-saints">' +
            rest.map(function (t) { return '<li>' + escapeHtml(t) + '</li>'; }).join('') +
          '</ul>'
        : '') +
      '<p class="calendar__day-fast' + fastClass(info.fast.level) + '">' + info.fast.text + '</p>' +
      '<p class="calendar__day-links">' +
        '<a class="link" href="' + info.source + '" target="_blank" rel="noopener">Полный круг памятей дня</a>' +
      '</p>';

    if (animate && !reduceMotion) {
      card.classList.remove('is-entering');
      void card.offsetWidth;
      card.classList.add('is-entering');
    }

    // Адрес переживает перезагрузку и «поделиться ссылкой»
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('date', info.iso);
      window.history.replaceState(null, '', url);
    } catch (e) { /* на file:// адрес не трогаем */ }
  }

  function fastClass(level) {
    if (level === 'strict') return ' calendar__day-fast--strict';
    if (level === 'none' || level === 'solid') return ' calendar__day-fast--none';
    return '';
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* --- События ------------------------------------------------------------ */

  function step(n) {
    var m = view.month + n;
    var y = view.year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    view = { year: y, month: m };
    drawGrid();
  }

  root.addEventListener('click', function (e) {
    var arrow = e.target.closest('[data-month-step]');
    if (arrow) { step(parseInt(arrow.dataset.monthStep, 10)); return; }

    if (e.target.closest('[data-month-today]')) {
      view = { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 };
      selected = today;
      drawGrid();
      drawCard(true);
      return;
    }

    var cell = e.target.closest('[data-date]');
    if (!cell) return;

    var p = cell.dataset.date.split('-');
    selected = CC.utc(parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10));
    drawGrid();
    drawCard(true);
  });

  // Стрелками ходим по дням внутри сетки, не выходя из клавиатуры
  grid.addEventListener('keydown', function (e) {
    var map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in map) || !e.target.closest('[data-date]')) return;

    e.preventDefault();
    selected = CC.addDays(selected, map[e.key]);
    view = { year: selected.getUTCFullYear(), month: selected.getUTCMonth() + 1 };
    drawGrid();
    drawCard(true);

    var next = grid.querySelector('[data-date="' + CC.iso(selected) + '"]');
    if (next) next.focus();
  });

  drawGrid();
  drawCard(false);
})();
