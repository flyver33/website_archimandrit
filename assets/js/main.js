/* =============================================================================
   Главная страница: шапка, меню, появление блоков, лента мероприятий
   Ванильный JS, без зависимостей.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Вступление первого экрана ----------------------------------------- */

  var hero = document.querySelector('.hero');

  if (hero) {
    var startHero = function () {
      requestAnimationFrame(function () { hero.classList.add('is-ready'); });
    };
    var img = hero.querySelector('img');
    if (img && !img.complete) img.addEventListener('load', startHero, { once: true });
    startHero();
  }

  /* --- Шапка: уплотнение при прокрутке ----------------------------------- */

  var header = document.getElementById('header');

  if (header) {
    // Шапка вынута из потока, место под неё держит padding у body. Берём
    // фактическую высоту, а не токен: она зависит от загрузившегося шрифта
    // и масштаба страницы, и если резерв окажется меньше — шапка накроет
    // первый экран. Резерв всегда под РАЗВЁРНУТУЮ шапку: если в момент
    // замера она уплотнена, на один кадр снимаем класс с отключёнными
    // переходами — чтение синхронное, поэтому уплотнение не мигает.
    var measureHeader = function () {
      var wasStuck = header.classList.contains('is-stuck');

      if (wasStuck) {
        header.classList.add('is-measuring');
        header.classList.remove('is-stuck');
      }

      var h = Math.ceil(header.getBoundingClientRect().height);

      if (wasStuck) {
        header.classList.add('is-stuck');
        void header.offsetWidth;
        header.classList.remove('is-measuring');
      }

      document.documentElement.style.setProperty('--header-space', h + 'px');
    };

    measureHeader();
    window.addEventListener('resize', measureHeader);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureHeader);

    // Пороги входа и выхода разнесены шире длины самого перехода: пока
    // шапка складывается, обратный порог остаётся далеко позади, и обычная
    // прокрутка колесом не успевает вернуть её в развёрнутое состояние.
    var ENTER = 80;
    var EXIT = 24;
    var stuck = false;

    var onScroll = function () {
      var y = window.scrollY;
      if (!stuck && y > ENTER) { stuck = true; header.classList.add('is-stuck'); }
      else if (stuck && y < EXIT) {
        stuck = false;
        // Ширину окна могли поменять, пока шапка была уплотнена. Замер идёт
        // до снятия класса: тогда высоту читает ветка с остановленными
        // переходами, а не середина начавшейся анимации разворота.
        measureHeader();
        header.classList.remove('is-stuck');
      }
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Полоса разделов стоит сразу под первым экраном, и он вычитает её высоту
  // из своей: полоса видна без прокрутки. Токен задаёт высоту одной строки —
  // фактических рядов бывает до четырёх, поэтому меряем по месту.
  var sitebar = document.querySelector('.sitebar');

  if (sitebar) {
    var measureSitebar = function () {
      var h = Math.ceil(sitebar.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--sitebar-space', h + 'px');
    };

    measureSitebar();
    window.addEventListener('resize', measureSitebar);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureSitebar);
  }

  /* Разделы живут в полосе-меню под шапкой — она видна на любой ширине,
     всплывающего меню и бургера на сайте нет. */

  /* --- Появление блоков при прокрутке ------------------------------------ */

  // Каскад: детям контейнера с data-stagger раздаются нарастающие задержки
  Array.prototype.forEach.call(document.querySelectorAll('[data-stagger]'), function (group) {
    var step = parseInt(group.dataset.stagger, 10) || 70;
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.classList.add('reveal');
      child.style.setProperty('--reveal-delay', Math.min(i, 5) * step + 'ms');
    });
  });

  var revealables = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
      // threshold 0 — иначе блоки выше экрана никогда не наберут нужную долю
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* --- Раздел: постраничный список --------------------------------------- */

  // Список отдаётся целиком, страницы нарезает скрипт. Без скрипта страница
  // остаётся рабочей: видны все элементы, просто без переключателя.
  var list = document.querySelector('[data-paginate]');

  if (list) {
    var per = parseInt(list.dataset.paginate, 10) || 15;
    var rows = Array.prototype.slice.call(list.children);
    var pageCount = Math.ceil(rows.length / per);

    if (pageCount > 1) {
      var pager = document.createElement('nav');
      pager.className = 'pager';
      pager.setAttribute('aria-label', 'Страницы раздела');
      list.parentNode.insertBefore(pager, list.nextSibling);

      var arrow = function (dir) {
        return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" ' +
          'stroke-width="1.4" aria-hidden="true"><path d="' +
          (dir < 0 ? 'M13 7H1M6 2 1 7l5 5' : 'M1 7h12M8 2l5 5-5 5') + '"/></svg>';
      };

      // Соседи текущей страницы, края и многоточия вместо длинного ряда
      var numbers = function (current) {
        var out = [];
        for (var n = 1; n <= pageCount; n++) {
          if (n === 1 || n === pageCount || Math.abs(n - current) <= 1) out.push(n);
          else if (out[out.length - 1] !== 0) out.push(0); // 0 — многоточие
        }
        return out;
      };

      var currentPage = 1;

      var draw = function () {
        var parts = [];

        parts.push('<button class="pager__btn" type="button" data-step="-1" aria-label="Предыдущая страница"' +
          (currentPage === 1 ? ' disabled' : '') + '>' + arrow(-1) + '</button>');

        numbers(currentPage).forEach(function (n) {
          if (!n) { parts.push('<span class="pager__gap" aria-hidden="true">…</span>'); return; }
          parts.push('<button class="pager__btn" type="button" data-page="' + n + '"' +
            (n === currentPage ? ' aria-current="page"' : '') +
            ' aria-label="Страница ' + n + '">' + n + '</button>');
        });

        parts.push('<button class="pager__btn" type="button" data-step="1" aria-label="Следующая страница"' +
          (currentPage === pageCount ? ' disabled' : '') + '>' + arrow(1) + '</button>');

        pager.innerHTML = parts.join('');
      };

      var show = function (n, moveView) {
        currentPage = Math.min(Math.max(n, 1), pageCount);

        rows.forEach(function (row, i) {
          row.hidden = Math.floor(i / per) + 1 !== currentPage;
        });

        draw();

        // Адрес переживает перезагрузку и «поделиться ссылкой». На file://
        // история недоступна — адрес просто остаётся прежним.
        try {
          var url = new URL(window.location.href);
          if (currentPage === 1) url.searchParams.delete('page');
          else url.searchParams.set('page', String(currentPage));
          window.history.replaceState(null, '', url);
        } catch (e) { /* адрес не трогаем */ }

        if (moveView) {
          var top = list.getBoundingClientRect().top + window.scrollY -
            (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-space')) || 120) - 24;
          window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
          list.focus({ preventScroll: true });
        }
      };

      pager.addEventListener('click', function (e) {
        var btn = e.target.closest('.pager__btn');
        if (!btn || btn.disabled) return;
        var to = btn.dataset.page ? parseInt(btn.dataset.page, 10) : currentPage + parseInt(btn.dataset.step, 10);
        show(to, true);
      });

      list.tabIndex = -1;

      var fromUrl = /[?&]page=(\d+)/.exec(window.location.search);
      show(fromUrl ? parseInt(fromUrl[1], 10) : 1, false);
    }
  }

  /* --- Мероприятия: список выбирает событие, оно показывается крупно ------ */

  var tablist = document.querySelector('.events__list');

  if (tablist) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));

    var select = function (tab, moveFocus) {
      tabs.forEach(function (t) {
        var current = t === tab;
        t.setAttribute('aria-selected', String(current));
        t.tabIndex = current ? 0 : -1;
        var p = document.getElementById(t.getAttribute('aria-controls'));
        p.hidden = !current;
        if (current && !reduceMotion) {
          p.classList.remove('is-entering');
          void p.offsetWidth; // перезапуск анимации
          p.classList.add('is-entering');
        }
      });

      if (moveFocus) tab.focus();

      // На узком экране крупная карточка стоит над списком — подводим её к глазам
      if (window.matchMedia('(max-width: 900px)').matches) {
        var panel = document.getElementById(tab.getAttribute('aria-controls'));
        var top = panel.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    };

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { select(tab, false); });
    });

    tablist.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i === -1) return;

      var next = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs[tabs.length - 1];

      if (next) {
        e.preventDefault();
        select(next, true);
      }
    });
  }

  /* --- Видеозаписи: карусель --------------------------------------------- */

  // Карусель не цикличная: ряд идёт от новых записей к старым и упирается
  // в края — стрелка на краю гаснет, а не перекидывает в начало.
  var carousel = document.querySelector('[data-carousel]');

  if (carousel) {
    var track = carousel.querySelector('.carousel__track');
    var thumb = carousel.querySelector('.carousel__thumb');
    var prevBtn = document.querySelector('[data-carousel-prev]');
    var nextBtn = document.querySelector('[data-carousel-next]');

    // Шаг равен ширине карточки с промежутком — прокрутка всегда ставит
    // следующую карточку к левому краю, как и scroll-snap
    var cardStep = function () {
      var card = track.querySelector('.video-card');
      if (!card) return track.clientWidth;
      var gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
      return card.getBoundingClientRect().width + gap;
    };

    var syncCarousel = function () {
      var max = track.scrollWidth - track.clientWidth;
      var x = track.scrollLeft;

      // Допуск 1px: дробная ширина карточек не даёт упереться в край ровно
      if (prevBtn) prevBtn.disabled = x <= 1;
      if (nextBtn) nextBtn.disabled = x >= max - 1;

      var ratio = track.scrollWidth ? track.clientWidth / track.scrollWidth : 1;
      var width = Math.min(ratio * 100, 100);
      thumb.style.width = width + '%';
      thumb.style.left = (max > 0 ? (x / max) * (100 - width) : 0) + '%';
    };

    var slide = function (dir) {
      track.scrollBy({ left: dir * cardStep(), behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    if (prevBtn) prevBtn.addEventListener('click', function () { slide(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { slide(1); });

    track.addEventListener('scroll', syncCarousel, { passive: true });
    window.addEventListener('resize', syncCarousel);
    syncCarousel();
  }

  /* --- Встроенный плеер: постер уступает место кадру ---------------------- */

  // До клика на месте плеера стоит превью: иначе страница передачи тянула бы
  // плеер RuTube ещё до того, как запись попросили. Клик подменяет превью
  // кадром с автозапуском — второго действия от человека не требуется.
  Array.prototype.forEach.call(document.querySelectorAll('[data-embed]'), function (embed) {
    var btn = embed.querySelector('.video-embed__play');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = 'https://rutube.ru/play/embed/' + embed.dataset.embed + '/?autoplay=1';
      frame.title = embed.dataset.title || 'Видеозапись';
      frame.setAttribute('allow', 'clipboard-write; autoplay; fullscreen');

      embed.replaceChildren(frame);
      embed.classList.add('is-playing');
      frame.focus();
    });
  });

})();
