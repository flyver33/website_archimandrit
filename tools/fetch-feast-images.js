/* =============================================================================
   Иконы для церковного календаря: разовая выгрузка из Викисклада.

   Запуск:  node tools/fetch-feast-images.js
   Кладёт файлы в assets/img/feasts/<ключ>.jpg и пишет рядом SOURCES.md
   со ссылками на страницы файлов — там же указана лицензия.

   Берём готовые уменьшённые копии (thumbnail шириной 640): изображение
   уменьшает сервер Викисклада, локально ничего пережимать не нужно.

   Источник у каждой записи указан явно — либо файл Викисклада (file),
   либо заглавная иллюстрация статьи русской Википедии (page). Явный файл
   надёжнее: заглавная картинка статьи со временем меняется.
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

/* 640 — стандартная ширина превью Викисклада. Нестандартную (например 720)
   отдаёт не всякий файл: сервер отвечает 400 вместо картинки. */
const WIDTH = 640;
const OUT = path.join(__dirname, '..', 'assets', 'img', 'feasts');
const UA = 'melhisedek-site-image-fetch/1.0 (static site build script)';

/* Ключи совпадают с полем img в assets/js/church-calendar.js */
const LIST = [
  /* --- Пасха и двунадесятые ---------------------------------------------- */
  { key: 'pascha', file: 'Resurrection (Icon).jpg', page: 'Воскресение Иисуса Христа' },
  { key: 'rozhdestvo-hristovo', page: 'Рождество Христово' },
  { key: 'bogoyavlenie', page: 'Крещение Господне' },
  { key: 'sretenie', page: 'Сретение Господне' },
  { key: 'blagoveschenie', page: 'Благовещение' },
  { key: 'vhod-v-ierusalim', page: 'Вход Господень в Иерусалим' },
  { key: 'voznesenie', page: 'Вознесение Господне' },
  { key: 'troica', file: 'Angelsatmamre-trinity-rublev-1410.jpg' },
  { key: 'preobrazhenie', page: 'Преображение Господне' },
  { key: 'uspenie', page: 'Успение Пресвятой Богородицы' },
  { key: 'rozhdestvo-bogorodicy', page: 'Рождество Пресвятой Богородицы' },
  { key: 'vozdvizhenie', file: 'Exaltation of the Cross - Palekh icon (19 c, priv.coll).jpg' },
  { key: 'vvedenie', page: 'Введение во храм Пресвятой Богородицы' },

  /* --- Великие праздники --------------------------------------------------- */
  { key: 'obrezanie', page: 'Обрезание Господне' },
  { key: 'rozhdestvo-predtechi', page: 'Рождество Иоанна Предтечи' },
  { key: 'petr-i-pavel', file: 'Peter and Paul icon Belozersk.jpg' },
  { key: 'usekovenie', page: 'Усекновение главы Иоанна Предтечи' },
  { key: 'pokrov', page: 'Покров Пресвятой Богородицы' },
  { key: 'obretenie-glavy', page: 'Иоанн Креститель' },

  /* --- Богородичные иконы -------------------------------------------------- */
  { key: 'kazanskaya', page: 'Казанская икона Божией Матери' },
  { key: 'vladimirskaya', page: 'Владимирская икона Божией Матери' },
  { key: 'iverskaya', page: 'Иверская икона Божией Матери' },
  { key: 'tihvinskaya', page: 'Тихвинская икона Божией Матери' },
  { key: 'smolenskaya', page: 'Смоленская икона Божией Матери' },
  { key: 'znamenie', page: 'Знамение (икона)' },
  { key: 'derzhavnaya', page: 'Державная икона Божией Матери' },
  { key: 'vseh-skorbyaschih', page: 'Всех скорбящих Радость' },

  /* --- Святые -------------------------------------------------------------- */
  { key: 'nikolay', page: 'Николай Чудотворец' },
  { key: 'serafim', file: 'Seraphim of Sarov (after 1903, priv.coll).jpg' },
  { key: 'sergiy', file: 'Sergius of Radonezh vita icon (17 c., Yaroslavl museum).jpg' },
  { key: 'ksenia', page: 'Ксения Петербургская' },
  { key: 'georgiy', page: 'Георгий Победоносец' },
  { key: 'panteleimon', page: 'Пантелеимон' },
  { key: 'ioann-bogoslov', page: 'Иоанн Богослов' },
  { key: 'ioann-zlatoust', page: 'Иоанн Златоуст' },
  { key: 'vasiliy-velikiy', page: 'Василий Великий' },
  { key: 'tri-svyatitelya', file: 'Three Holy Hierarchs (Novgorod).jpg' },
  { key: 'ilia-prorok', page: 'Илия (пророк)' },
  { key: 'arhangel-mihail', page: 'Михаил (архангел)' },
  { key: 'andrey-pervozvanny', page: 'Андрей Первозванный' },
  { key: 'varvara', page: 'Варвара Илиопольская' },
  { key: 'ekaterina', page: 'Екатерина Александрийская' },
  { key: 'vladimir', file: 'Icon of saint Vladimir (c. 1900, Russia, priv. coll.).jpg' },
  { key: 'olga', file: 'Olgaofkiev.jpeg' },
  { key: 'aleksandr-nevskiy', page: 'Александр Невский' },
  { key: 'boris-i-gleb', page: 'Борис и Глеб' },
  { key: 'petr-i-fevronia', page: 'Пётр и Феврония Муромские' },
  { key: 'kirill-i-mefodiy', file: 'Cyril and Methodius Icon in Saint Paraskeva Church in Popitsa.JPG',
    page: 'Кирилл и Мефодий' },
  /* Иконы прав. Иоанна Кронштадтского на Викискладе только под свободной
     лицензией с оговорками — берём его прижизненный снимок, он в общественном
     достоянии */
  { key: 'ioann-kronshtadtskiy', file: 'Johannes von Kronstadt.jpg' },
  { key: 'maria-egipetskaya', page: 'Мария Египетская' },
  { key: 'ioann-lestvichnik', page: 'Иоанн Лествичник' },
  { key: 'antoniy-velikiy', page: 'Антоний Великий' },
  { key: 'sorok-muchenikov', page: 'Сорок Севастийских мучеников' },

  /* --- Запасные образы: седмичный круг и время года ------------------------ */
  { key: 'spas', file: 'Spas vsederzhitel sinay.jpg' },          /* будни, четверг */
  { key: 'krest', file: 'Crucifixion of Jesus, Russian icon by Dionisius, 1500.jpg' }, /* среда и пятница */
  { key: 'velikiy-post', file: 'The Ladder of Divine Ascent Monastery of St Catherine Sinai 12th century.jpg' },
  { key: 'vse-svyatye', file: 'Собор святых в земле русской просиявших (10587577546).jpg' },
  { key: 'bogorodica', page: 'Богородица' }                       /* суббота */
];

/* --- Сеть -----------------------------------------------------------------
   Викимедиа отвечает 429, если бить в неё подряд без пауз: запросы идут
   пачками по 50 заглавий, между обращениями — пауза, на 429 — повтор
   с нарастающим ожиданием. */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Раздача картинок (upload.wikimedia.org) отвечает 429 заметно раньше, чем
   API, и отпускает не сразу: ждать приходится десятками секунд. */
async function get(url, asJson) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return asJson ? res.json() : Buffer.from(await res.arrayBuffer());
    if (res.status !== 429 && res.status < 500) throw new Error('HTTP ' + res.status);
    await sleep(15000 * (attempt + 1));
  }
  throw new Error('не отвечает после шести попыток');
}

function apiUrl(host, params) {
  return 'https://' + host + '/w/api.php?' + new URLSearchParams(
    Object.assign({ format: 'json', formatversion: '2' }, params)
  );
}

/* Викисклад нормализует подчёркивания в пробелы: имя файла из Википедии
   приходит с подчёркиваниями, а в ответе возвращается с пробелами. Ключи
   таблицы приводим к одному виду, иначе поиск промахивается. */
function norm(name) { return String(name).replace(/_/g, ' '); }

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/* Уменьшенные копии файлов Викисклада: ключ — заглавие File:…

   Качать оригиналы нельзя: раздача отвечает 429 и просит брать превью
   стандартных размеров (см. w.wiki/GHai). Поэтому если файл уже, чем 640,
   спрашиваем превью в 320 — тоже стандартный размер. */
async function resolveFiles(names) {
  const found = new Map();

  for (const part of chunk(names, 50)) {
    for (const width of [WIDTH, 320]) {
      const rest = part.filter((n) => !found.has(norm(n)));
      if (!rest.length) break;

      const data = await get(apiUrl('commons.wikimedia.org', {
        action: 'query',
        prop: 'imageinfo',
        iiprop: 'url|size',
        iiurlwidth: String(width),
        titles: rest.map((n) => 'File:' + n).join('|')
      }), true);

      (data.query.pages || []).forEach((page) => {
        if (page.missing || !page.imageinfo) return;

        const info = page.imageinfo[0];
        // Превью шире оригинала не бывает: тогда вместо него отдаётся сам
        // оригинал, а его качать нельзя — пробуем размер поменьше
        if (!info.thumburl || info.thumburl.indexOf('/thumb/') === -1) return;

        found.set(norm(page.title.replace(/^File:/, '')), {
          url: info.thumburl,
          credit: info.descriptionurl
        });
      });

      await sleep(1200);
    }
  }

  return found;
}

/* Заглавие статьи русской Википедии → имя её заглавной иллюстрации.
   Саму копию потом берём у Викисклада, как и для явно указанных файлов.

   Перенаправления меняют заглавие — сопоставляем по таблице redirects.
   Имена отдаются не всем заглавиям сразу: остаток приходит по picontinue,
   а что не пришло и после этого — добираем по одному. */
async function resolvePageFiles(titles) {
  const found = new Map();

  const take = (data) => {
    const alias = new Map();
    (data.query.redirects || []).forEach((r) => alias.set(r.to, r.from));
    (data.query.normalized || []).forEach((n) => alias.set(n.to, n.from));

    (data.query.pages || []).forEach((page) => {
      if (page.missing || !page.pageimage) return;
      found.set(page.title, page.pageimage);
      if (alias.has(page.title)) found.set(alias.get(page.title), page.pageimage);
    });
  };

  for (const part of chunk(titles, 20)) {
    let cont = null;

    do {
      const params = {
        action: 'query',
        prop: 'pageimages',
        piprop: 'name',
        pilimit: '50',
        redirects: '1',
        titles: part.join('|')
      };
      if (cont) Object.assign(params, cont);

      const data = await get(apiUrl('ru.wikipedia.org', params), true);
      take(data);

      cont = data.continue || null;
      await sleep(1200);
    } while (cont);

    for (const title of part) {
      if (found.has(title)) continue;

      take(await get(apiUrl('ru.wikipedia.org', {
        action: 'query',
        prop: 'pageimages',
        piprop: 'name',
        redirects: '1',
        titles: title
      }), true));

      await sleep(1200);
    }
  }

  return found;
}

/* --- Ход работы ----------------------------------------------------------- */

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const pageFiles = await resolvePageFiles(LIST.filter((i) => i.page).map((i) => i.page));

  const names = LIST
    .map((i) => i.file)
    .concat(Array.from(pageFiles.values()))
    .filter(Boolean);

  const files = await resolveFiles(Array.from(new Set(names)));

  const rows = [];
  const missing = [];

  for (const item of LIST) {
    const found = (item.file && files.get(norm(item.file))) ||
      (item.page && files.get(norm(pageFiles.get(item.page) || '')));

    if (!found) {
      missing.push(item.key);
      console.log('—  ' + item.key + ' — не нашлось');
      continue;
    }

    const dest = path.join(OUT, item.key + '.jpg');

    // Уже скачанное не трогаем: повторный запуск добирает недостающее,
    // а заменённые вручную картинки остаются на месте
    if (fs.existsSync(dest)) {
      rows.push('| `' + item.key + '` | ' + (item.file || item.page) + ' | ' + found.credit + ' |');
      continue;
    }

    try {
      const buf = await get(found.url, false);
      fs.writeFileSync(dest, buf);
      rows.push('| `' + item.key + '` | ' + (item.file || item.page) + ' | ' + found.credit + ' |');
      console.log('+  ' + item.key + ' — ' + Math.round(buf.length / 1024) + ' КБ');
    } catch (e) {
      missing.push(item.key);
      console.log('!  ' + item.key + ' — ' + e.message);
    }

    await sleep(3000);
  }

  fs.writeFileSync(path.join(OUT, 'SOURCES.md'),
    '# Источники изображений\n\n' +
    'Иконы взяты с Викисклада (Wikimedia Commons) скриптом `tools/fetch-feast-images.js`.\n' +
    'Сами изображения — древние произведения в общественном достоянии; лицензия\n' +
    'конкретного файла указана на его странице по ссылке.\n\n' +
    '| Ключ | Запрос | Страница файла |\n| --- | --- | --- |\n' +
    rows.join('\n') + '\n');

  console.log('\nГотово: ' + rows.length + ' шт., не нашлось: ' + (missing.join(', ') || '—'));
})();
