/* =============================================================================
   Сборка страниц разделов и элементов.

     node tools/build-pages.js

   Пишет: events/, books/, texts/, video/, bio/ — страницу раздела и страницы
   элементов. Содержимое берётся из tools/content.js, расшифровки — из
   assets/docs/texts/besedy-s-batyushkoy.source.html (там их 63 подряд).

   Главная (index.html) собирается руками: она одна и живёт по своим правилам.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { SECTIONS, EVENTS, BOOKS, VIDEO, BIO } = require('./content.js');

const ROOT = path.join(__dirname, '..');
const UP = '../'; // все страницы лежат на один уровень ниже корня

/* --- Общие куски разметки -------------------------------------------------- */

const ARROW_RIGHT = '<svg class="entry-row__arrow" width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 7h17M13 1l6 6-6 6"/></svg>';

const ARROW_LEFT = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M13 7H1M6 2 1 7l5 5"/></svg>';

function head({ title, description, css }) {
  const sheets = ['fonts', 'tokens', 'base', 'components'].concat(css || []);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="theme-color" content="#FFFDF8">

<link rel="icon" href="${UP}assets/img/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${UP}assets/fonts/arsenal-400-normal-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${UP}assets/fonts/ptserif-400-normal-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
${sheets.map((name) => `<link rel="stylesheet" href="${UP}assets/css/${name}.css">`).join('\n')}
<script>document.documentElement.classList.add('js');</script>
</head>
<body>

<a class="skip-link" href="#main">Перейти к содержанию</a>
`;
}

/* aria-current="page" ставится только на самой странице раздела. На странице
   элемента пункт меню ведёт не сюда, поэтому пометки нет. */
function header(activeKey, isIndex) {
  const mark = (key) => (isIndex && key === activeKey ? ' aria-current="page"' : '');

  const links = SECTIONS.map((s) =>
    `      <div class="nav__item"><a class="nav__link" href="${UP}${s.dir}/index.html"${mark(s.key)}>${s.title}</a></div>`
  ).join('\n');

  const mobile = SECTIONS.map((s) =>
    `      <a href="${UP}${s.dir}/index.html"${mark(s.key)}>${s.title}</a>`
  ).join('\n');

  return `
<!-- ======================================================== Шапка -->
<header class="header" id="header">
  <div class="container header__inner">

    <a class="logo" href="${UP}index.html" aria-label="Архимандрит Мелхиседек — на главную">
      <span class="logo__line">Архимандрит</span>
      <span class="logo__line">Мелхиседек</span>
    </a>

    <nav class="nav" aria-label="Основное меню">
${links}
    </nav>

    <div class="header__actions">
      <button class="icon-btn burger" type="button" id="burger" aria-label="Открыть меню" aria-expanded="false" aria-controls="mobile-menu">
        <svg width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M0 1h22M0 7h22M0 13h22"/>
        </svg>
      </button>
    </div>

  </div>

  <div class="header-ornament" aria-hidden="true"><span class="header-ornament__strip"></span></div>
</header>

<!-- ================================================ Мобильное меню -->
<div class="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Меню сайта" hidden>
  <button class="icon-btn mobile-menu__close" type="button" id="menu-close" aria-label="Закрыть меню">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16"/></svg>
  </button>
  <div class="container">
    <nav aria-label="Разделы сайта">
${mobile}
    </nav>
  </div>
</div>
`;
}

function footer() {
  const links = SECTIONS.map((s) => `          <li><a href="${UP}${s.dir}/index.html">${s.title}</a></li>`).join('\n');

  return `
<!-- ================================================ Подвал -->
<footer class="footer">
  <div class="container">
    <div class="footer__inner">
      <div class="footer__brand">
        <h2>Архимандрит Мелхиседек (Артюхин)</h2>
        <p class="muted" style="font-size: var(--fs-small)">
          Пресс-секретарь Синодального отдела<br>по монастырям и монашеству
        </p>
        <p class="footer__contacts">
          <a class="link" href="tel:+79999999999">+7 (999) 999-99-99</a> ·
          <a class="link" href="mailto:pochta@mail.ru">pochta@mail.ru</a>
        </p>
        <p class="footer__place">Москва 2026</p>
      </div>

      <div class="footer__col">
        <ul>
${links}
        </ul>
      </div>
    </div>
  </div>
</footer>

<script src="${UP}assets/js/main.js" defer></script>
</body>
</html>
`;
}

/* --- Страница раздела: заголовок и список элементов ------------------------ */

function sectionPage({ key, title, description, items }) {
  const section = SECTIONS.find((s) => s.key === key);

  const rows = items.map((item) => {
    const inner = `        <span class="entry-row__meta">${item.meta}</span>
        <span class="entry-row__title">${item.title}</span>`;

    if (item.href) {
      return `      <li>
      <a class="entry-row" href="${item.href}">
${inner}
        ${ARROW_RIGHT}
      </a>
      </li>`;
    }
    // Элемента ещё нет — строка стоит в списке, но не открывается
    return `      <li>
      <span class="entry-row is-locked" aria-disabled="true">
${inner}
      </span>
      </li>`;
  }).join('\n');

  return head({
    title: `${title} — архимандрит Мелхиседек (Артюхин)`,
    description,
    css: ['reading', 'section'],
  }) + header(key, true) + `
<main id="main">

  <div class="container page-head">
    <h1 class="page-head__title">${title}</h1>
  </div>

  <div class="container section-page">
    <ul class="entry-list" data-paginate="15">
${rows}
    </ul>
  </div>

</main>
` + footer(section.key);
}

/* --- Раздел «Видео»: сетка записей с плеерами -------------------------------
   Список записей — не строки со стрелкой, а сами плееры: превью с кнопкой,
   которая по клику подменяется кадром RuTube с автозапуском. Пять плееров
   сразу страница не грузит. Без скрипта на месте превью стоит <noscript>
   с обычным кадром, страница остаётся рабочей. */

function videoPoster(id) {
  return `https://rutube.ru/api/video/${id}/thumbnail/?redirect=1`;
}

function videoSectionPage({ title, description, items }) {
  const cards = items.map((v) => `      <li class="video-grid__item">
        <div class="video-embed ph" data-embed="${v.id}" data-title="${v.title}">
          <img class="video-embed__img" alt="" loading="lazy" decoding="async"
               src="${videoPoster(v.id)}" onerror="this.remove()">
          <button class="video-embed__play" type="button">
            <span class="visually-hidden">Смотреть: ${v.title}</span>
            <span class="video-embed__icon" aria-hidden="true">
              <svg width="18" height="20" viewBox="0 0 16 18" fill="currentColor"><path d="M0 0l16 9-16 9z"/></svg>
            </span>
          </button>
          <span class="video-embed__time" aria-hidden="true">${v.length}</span>
          <noscript><iframe src="https://rutube.ru/play/embed/${v.id}/" title="${v.title}"
                            allow="clipboard-write; autoplay; fullscreen" loading="lazy"></iframe></noscript>
        </div>

        <div>
          <h2 class="video-grid__title"><a href="${v.slug}.html">${v.title}</a></h2>
          <p class="video-grid__meta">${v.dateText} · ${v.source} · ${v.length}</p>
        </div>
      </li>`).join('\n\n');

  return head({
    title: `${title} — архимандрит Мелхиседек (Артюхин)`,
    description,
    css: ['reading', 'section'],
  }) + header('video', true) + `
<main id="main">

  <div class="container page-head">
    <h1 class="page-head__title">${title}</h1>
  </div>

  <div class="container section-page">
    <ul class="video-grid" data-paginate="12">
${cards}
    </ul>
  </div>

</main>
` + footer('video');
}

/* --- Страница элемента ----------------------------------------------------- */

function entryPage({ key, title, description, lead, body, css, scripts, prev, next }) {
  const section = SECTIONS.find((s) => s.key === key);

  const nav = (prev || next) ? `
    <nav class="entry-nav" aria-label="Соседние материалы">
${prev ? `      <a class="link" href="${prev.href}">← ${prev.title}</a>` : ''}
${next ? `      <a class="link entry-nav__next" href="${next.href}">${next.title} →</a>` : ''}
    </nav>` : '';

  return head({
    title: `${title} — архимандрит Мелхиседек (Артюхин)`,
    description,
    css: ['reading'].concat(css || []),
  }) + header(key) + `
<main id="main">

  <div class="container page-head">
    <a class="back-link" href="${UP}${section.dir}/index.html">
      ${ARROW_LEFT}
      ${section.title}
    </a>
    <h1 class="page-head__title entry-head__title">${title}</h1>
${lead ? `    <p class="page-head__lead">${lead}</p>` : ''}
  </div>

  <div class="container entry-body">
${body}${nav}
  </div>

</main>
` + footer(section.key).replace(
    '</body>',
    (scripts || []).map((s) => `<script src="${UP}assets/js/${s.src}"${s.module ? ' type="module"' : ' defer'}></script>`).join('\n') + '\n</body>'
  );
}

/* --- Расшифровки: разбор общего исходника на отдельные эфиры ---------------- */

function readTranscripts() {
  const src = fs.readFileSync(path.join(ROOT, 'assets/docs/texts/besedy-s-batyushkoy.source.html'), 'utf8');
  const chunks = src.split(/<section class="part" id="t-\d+">/).slice(1);

  return chunks.map((chunk, i) => {
    const part = chunk.slice(0, chunk.indexOf('</section>'));

    const title = /<h2 class="part__title">([\s\S]*?)<\/h2>/.exec(part)[1].trim();
    const meta = /<p class="part__meta">([\s\S]*?)<\/p>/.exec(part)[1];
    const when = /datetime="([^"]+)"/.exec(meta);
    const dateText = /<time[^>]*>([\s\S]*?)<\/time>/.exec(meta)[1].trim();

    // Тело: всё после строки с датой, без ссылки «наверх, к содержанию»
    let body = part.slice(part.indexOf('</p>', part.indexOf('part__meta')) + 4);
    body = body.replace(/\s*<p class="part__up">[\s\S]*?<\/p>/g, '');

    return {
      n: i + 1,
      slug: `beseda-${String(i + 1).padStart(2, '0')}`,
      title,
      date: when ? when[1] : '',
      dateText,
      body: body.trim().split('\n').map((line) => '    ' + line.trim()).join('\n'),
    };
  });
}

/* --- Сборка ---------------------------------------------------------------- */

function write(file, html) {
  const full = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html, 'utf8');
  return file;
}

const written = [];

/* Мероприятия */

written.push(write('events/index.html', sectionPage({
  key: 'events',
  title: 'Мероприятия',
  description: 'Ближайшие беседы, лекции и богослужения архимандрита Мелхиседека (Артюхина).',
  items: EVENTS.map((e) => ({ meta: `${e.dateText} · ${e.time}`, title: e.title, href: `${e.slug}.html` })),
})));

EVENTS.forEach((e, i) => {
  const body = `    <div class="entry-facts">
      <p><b>Когда:</b> <time datetime="${e.date}">${e.dateText}, ${e.time}</time></p>
      <p><b>Что это:</b> ${e.kind}</p>
      <p><b>Где:</b> ${e.place}</p>
    </div>
    <p>Встреча открыта для всех желающих, запись не нужна. После беседы —
    ответы на вопросы из зала.</p>`;

  written.push(write(`events/${e.slug}.html`, entryPage({
    key: 'events',
    title: e.title,
    description: e.lead,
    lead: e.lead,
    body,
    prev: i > 0 ? { href: `${EVENTS[i - 1].slug}.html`, title: EVENTS[i - 1].title } : null,
    next: i < EVENTS.length - 1 ? { href: `${EVENTS[i + 1].slug}.html`, title: EVENTS[i + 1].title } : null,
  })));
});

/* Книги */

written.push(write('books/index.html', sectionPage({
  key: 'books',
  title: 'Книги',
  description: 'Книги архимандрита Мелхиседека (Артюхина): чтение прямо в браузере и загрузка файлов.',
  items: BOOKS.map((b) => ({ meta: b.meta, title: b.title, href: b.locked ? null : `${b.slug}.html` })),
})));

BOOKS.filter((b) => !b.locked).forEach((b) => {
  const body = `    <div class="pdf" id="book" data-src="${b.pdf}">
      <div class="pdf__stage">
        <button class="pdf__nav pdf__nav--prev" type="button" aria-label="Предыдущий разворот">
          ${ARROW_LEFT}
        </button>

        <div class="pdf__sheet" role="region" aria-label="Разворот книги">
          <p class="pdf__status" role="status">Книга загружается…</p>
        </div>

        <button class="pdf__nav pdf__nav--next" type="button" aria-label="Следующий разворот">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 7h12M8 2l5 5-5 5"/></svg>
        </button>
      </div>

      <p class="pdf__counter" aria-label="Текущий разворот">— / —</p>
    </div>

    <div class="book__actions pdf__downloads">
      <a class="btn btn--primary" href="${b.pdf}" download>Скачать PDF</a>
      <!-- TODO: подставить адрес файла EPUB и убрать класс is-disabled -->
      <a class="btn btn--secondary is-disabled" href="" aria-disabled="true" tabindex="-1" download>
        Скачать EPUB <span class="btn__note">скоро</span>
      </a>
    </div>`;

  written.push(write(`books/${b.slug}.html`, entryPage({
    key: 'books',
    title: b.title,
    description: b.lead,
    lead: b.lead,
    body,
    css: ['reader'],
    // pdf.js подключается динамическим import — файл обязан быть модулем
    scripts: [{ src: 'book-reader.js', module: true }],
  })));
});

/* Расшифровки */

const texts = readTranscripts();

written.push(write('texts/index.html', sectionPage({
  key: 'texts',
  title: 'Расшифровки',
  description: 'Расшифровки эфиров программы «Беседы с батюшкой» с участием архимандрита Мелхиседека (Артюхина), 2011–2021 годы.',
  items: texts.map((t) => ({ meta: t.dateText, title: t.title, href: `${t.slug}.html` })),
})));

texts.forEach((t, i) => {
  written.push(write(`texts/${t.slug}.html`, entryPage({
    key: 'texts',
    title: t.title,
    description: `Расшифровка эфира программы «Беседы с батюшкой» от ${t.dateText}: архимандрит Мелхиседек (Артюхин) отвечает на вопросы телезрителей.`,
    lead: `Эфир от <time datetime="${t.date}">${t.dateText}</time> · программа «Беседы с батюшкой», телеканал «Союз»`,
    body: t.body,
    prev: i > 0 ? { href: `${texts[i - 1].slug}.html`, title: texts[i - 1].title } : null,
    next: i < texts.length - 1 ? { href: `${texts[i + 1].slug}.html`, title: texts[i + 1].title } : null,
  })));
});

/* Видеозаписи */

written.push(write('video/index.html', videoSectionPage({
  title: 'Видео',
  description: 'Проповеди, беседы и лекции архимандрита Мелхиседека (Артюхина) в записи.',
  items: VIDEO,
})));

VIDEO.forEach((v, i) => {
  const body = `    <div class="entry-media">
      <iframe src="https://rutube.ru/play/embed/${v.id}/" title="${v.title}"
              allow="clipboard-write; autoplay; fullscreen" loading="lazy"></iframe>
    </div>

    <div class="entry-facts">
      <p><b>Запись:</b> ${v.dateText} · ${v.source}</p>
      <p><b>Длительность:</b> ${v.length}</p>
      <p><a class="link" href="https://rutube.ru/video/${v.id}/" target="_blank" rel="noopener">Смотреть на RuTube</a></p>
    </div>`;

  written.push(write(`video/${v.slug}.html`, entryPage({
    key: 'video',
    title: v.title,
    description: v.lead,
    lead: v.lead,
    body,
    prev: i > 0 ? { href: `${VIDEO[i - 1].slug}.html`, title: VIDEO[i - 1].title } : null,
    next: i < VIDEO.length - 1 ? { href: `${VIDEO[i + 1].slug}.html`, title: VIDEO[i + 1].title } : null,
  })));
});

/* Биография: раздел без списка — одна страница со сведениями */

written.push(write('bio/index.html',
  head({
    title: `${BIO.title} — архимандрит Мелхиседек (Артюхин)`,
    description: BIO.lead,
    css: ['reading'],
  }) + header('bio', true) + `
<main id="main">

  <div class="container page-head">
    <h1 class="page-head__title">${BIO.title}</h1>
    <p class="page-head__lead">${BIO.lead}</p>
  </div>

  <div class="container entry-body">
${BIO.paragraphs.map((p) => `    <p>${p}</p>`).join('\n')}
  </div>

</main>
` + footer('bio')));

console.log(`Собрано страниц: ${written.length}`);
console.log(`  расшифровок: ${texts.length}`);
