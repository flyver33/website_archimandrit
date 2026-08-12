/* =============================================================================
   Выгрузка месяцеслова в assets/data/days/<год>-<месяц>.json

   Своя таблица в assets/js/church-calendar.js держит только праздники и чтимые
   памяти — в обычный день карточке церковного дня нечего показать. Здесь
   разово выкачивается полный круг памятей с azbyka.ru и складывается рядом
   с сайтом: в рантайме чужой сервер не дёргается, страница работает и офлайн.

   Запуск:
     node tools/fetch-days.js               # текущий год и следующий
     node tools/fetch-days.js 2026-08 2027-08

   Готовые месяцы пропускаются — можно доливать выгрузку частями.
   ========================================================================== */

'use strict';

var fs = require('fs');
var path = require('path');

var OUT = path.join(__dirname, '..', 'assets', 'data', 'days');
var BASE = 'https://azbyka.ru/days/';

/* Страница дня весит около 160 КБ и отдаётся неспешно: тянем по нескольку
   штук сразу, но без напора — источник чужой */
var PARALLEL = 6;
var TIMEOUT = 45000;
var RETRIES = 3;

var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/* --- Разбор страницы --------------------------------------------------- */

function strip(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Ударения в именах святых стоят в тексте комбинирующим символом: на сайте
   они не нужны — заголовок с ними читается как опечатка */
function unstress(text) {
  return text.replace(/[̀́]/g, '');
}

function first(html, re) {
  var m = html.match(re);
  return m ? strip(m[1]) : '';
}

function parse(html) {
  var day = {};

  day.o = first(html, /class="oldstyle"[\s\S]*?<strong>([\s\S]*?)<\/strong>/);
  day.w = first(html, /class="shadow">([\s\S]*?)<\/div>\s*<\/div>/);

  // Первый абзац текста дня: пост и глас лежат в нём вперемешку со ссылками
  var head = first(html, /<div class="text day__text">([\s\S]*?)<\/p>/);
  var tone = head.match(/Глас\s+([^\s,.]+)/);
  day.g = tone ? 'глас ' + tone[1].replace(/-й$/, '') : '';

  var fast = head.match(/(Постный день|Сплошная седмица|Строгий пост|Поста нет)/);
  day.f = fast ? fast[1] : '';

  /* Памяти лежат списками: класс ideograph-N у строки — знак праздника,
     по нему потом видно, что выносить в заголовок дня */
  day.i = [];

  var body = html.match(/<div class="text day__text">([\s\S]*?)<\/div>/);
  if (body) {
    var re = /<li class="ideograph-(\d+)"[^>]*>([\s\S]*?)<\/li>/g;
    var m;
    while ((m = re.exec(body[1])) !== null) {
      var text = unstress(strip(m[2]));
      if (text) day.i.push([text, Number(m[1])]);
    }
  }

  return day;
}

/* --- Сеть -------------------------------------------------------------- */

function sleep(ms) {
  return new Promise(function (done) { setTimeout(done, ms); });
}

async function load(iso, attempt) {
  attempt = attempt || 1;

  try {
    var res = await fetch(BASE + iso, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'accept-language': 'ru,en;q=0.5'
      }
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);

    var html = await res.text();
    var day = parse(html);

    if (!day.i.length && !day.o) throw new Error('пустая страница');
    return day;
  } catch (err) {
    if (attempt > RETRIES) throw err;
    await sleep(4000 * attempt);
    return load(iso, attempt + 1);
  }
}

/* --- Месяц ------------------------------------------------------------- */

function pad(n) { return n < 10 ? '0' + n : String(n); }

async function month(year, mon) {
  var name = year + '-' + pad(mon);
  var file = path.join(OUT, name + '.json');

  if (fs.existsSync(file)) {
    console.log(name + ' — уже есть, пропускаю');
    return;
  }

  var last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  var dates = [];
  for (var d = 1; d <= last; d++) dates.push(d);

  var out = {};
  var failed = [];
  var queue = dates.slice();

  async function worker() {
    while (queue.length) {
      var d = queue.shift();
      var iso = name + '-' + pad(d);
      try {
        out[d] = await load(iso);
      } catch (err) {
        failed.push(iso + ': ' + err.message);
      }
    }
  }

  var pool = [];
  for (var i = 0; i < PARALLEL; i++) pool.push(worker());
  await Promise.all(pool);

  if (failed.length) {
    console.log(name + ' — не отдалось ' + failed.length + ' дн.: ' + failed.join('; '));
    return;
  }

  /* Ключи по возрастанию: файл потом читается глазами при правках */
  var sorted = {};
  dates.forEach(function (d) { if (out[d]) sorted[d] = out[d]; });

  fs.writeFileSync(file, JSON.stringify(sorted), 'utf8');
  console.log(name + ' — ' + Object.keys(sorted).length + ' дн., ' +
    Math.round(fs.statSync(file).size / 1024) + ' КБ');
}

/* --- Запуск ------------------------------------------------------------ */

function range(from, to) {
  var a = from.split('-').map(Number);
  var b = to.split('-').map(Number);
  var out = [];
  var y = a[0], m = a[1];

  while (y < b[0] || (y === b[0] && m <= b[1])) {
    out.push([y, m]);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  var args = process.argv.slice(2);
  var now = new Date();
  var from = args[0] || now.getUTCFullYear() + '-01';
  var to = args[1] || (now.getUTCFullYear() + 1) + '-12';

  var list = range(from, to);
  console.log('Месяцев к выгрузке: ' + list.length);

  for (var i = 0; i < list.length; i++) {
    await month(list[i][0], list[i][1]);
  }
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
