/* ==========================================================================
   Чтение книги: один разворот на бумажном фоне сайта, листается стрелками

   Встроенный просмотрщик браузера показывает книгу в чужой серой рамке со
   своей панелью. Здесь разворот рисует pdf.js в <canvas>: лист лежит на фоне
   страницы, а сама страница остаётся обычной — прокручивается как все.

   На экране всегда один разворот: соседний рисуется заранее, в память
   попадают два холста, а не 265.
   ========================================================================== */

const root = document.querySelector('.pdf');
if (root) start(root);

async function start(root) {
  const stage = root.querySelector('.pdf__stage');
  const sheet = root.querySelector('.pdf__sheet');
  const counter = root.querySelector('.pdf__counter');
  const prevBtn = root.querySelector('.pdf__nav--prev');
  const nextBtn = root.querySelector('.pdf__nav--next');
  const src = root.dataset.src;

  let pdfjs;
  try {
    pdfjs = await import('./vendor/pdf.min.mjs');
  } catch (err) {
    fallback(root, src);
    return;
  }

  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;

  let doc;
  try {
    doc = await pdfjs.getDocument({ url: src, enableXfa: false }).promise;
  } catch (err) {
    fallback(root, src);
    return;
  }

  const total = doc.numPages;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let page = 1;
  let task = null;
  const cache = new Map(); // номер разворота → готовый холст

  /* --- Размер листа --------------------------------------------------------
     Масштаб один на всю книгу и считается от сцены — от места, отведённого
     раскладкой, а не от уже нарисованного листа. Мерить лист собой же нельзя:
     каждый следующий разворот брал бы размер предыдущего и книга росла бы
     с каждым щелчком.

     Эталон — самый крупный разворот: первая и последняя страницы книги
     одиночные, и без общей меры кегль на них подскакивал бы вдвое. */
  let base = { width: 1, height: 1 };
  let scale = 1;

  async function measure() {
    const first = (await doc.getPage(1)).getViewport({ scale: 1 });
    const spread = total > 1 ? (await doc.getPage(2)).getViewport({ scale: 1 }) : first;
    base = {
      width: Math.max(first.width, spread.width),
      height: Math.max(first.height, spread.height),
    };
  }

  /* Предел высоты задан в таблице стилей; снимаем свою прошлую меру, чтобы
     прочитать его заново, и подгоняем сцену точно под лист. Тогда под книгой
     не остаётся пустой полосы, а стрелки стоят вровень с бумагой. */
  function setScale() {
    stage.style.height = '';
    const gap = parseFloat(getComputedStyle(stage).columnGap) || 0;
    const nav = prevBtn.offsetWidth + nextBtn.offsetWidth + 2 * gap;
    const maxW = Math.max(stage.clientWidth - nav, 200);
    const maxH = stage.clientHeight || Math.min(window.innerHeight * 0.8, 832);
    scale = Math.min(maxH / base.height, maxW / base.width);

    /* Сцена держит меру эталонного разворота, а не текущего листа: одиночная
       обложка уже разворота, и без этого стрелки прыгали бы вслед за ней */
    stage.style.height = `${Math.round(base.height * scale)}px`;
    stage.style.setProperty('--sheet-w', `${Math.round(base.width * scale)}px`);
  }

  /* --- Отрисовка ---------------------------------------------------------- */

  async function render(n, { silent = false } = {}) {
    if (n < 1 || n > total) return; // соседа за пределами книги не бывает

    const known = cache.get(n);
    if (known && !silent) {
      show(known);
      return;
    }
    if (known) return;

    const pdfPage = await doc.getPage(n);
    const viewport = pdfPage.getViewport({ scale: scale * dpr });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.round(viewport.height / dpr)}px`;

    const job = pdfPage.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport });
    if (!silent) task = job;

    try {
      await job.promise;
    } catch (err) {
      return; // отрисовку отменили: разворот успели пролистать
    }

    /* Кэш держим коротким: развороты тяжёлые, а нужны только соседние */
    cache.set(n, canvas);
    for (const [key, old] of cache) {
      if (Math.abs(key - page) > 2) {
        old.width = 0;
        old.height = 0;
        cache.delete(key);
      }
    }

    if (!silent) show(canvas);
  }

  function show(canvas) {
    sheet.replaceChildren(canvas);
    sheet.classList.add('is-drawn');
  }

  /* --- Листание ----------------------------------------------------------- */

  async function go(n) {
    const next = Math.min(Math.max(n, 1), total);
    if (next === page && sheet.classList.contains('is-drawn')) return;

    task?.cancel();
    page = next;
    setCounter();

    await render(page);
    /* Соседние развороты — заранее и молча: следующий щелчок уже без ожидания */
    render(page + 1, { silent: true });
    render(page - 1, { silent: true });
  }

  function setCounter() {
    counter.textContent = `${page} / ${total}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= total;
  }

  prevBtn.addEventListener('click', () => go(page - 1));
  nextBtn.addEventListener('click', () => go(page + 1));

  /* Клавиши работают, когда книга на экране: иначе стрелки отняли бы
     прокрутку у остальной страницы */
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    const box = root.getBoundingClientRect();
    if (box.bottom < 0 || box.top > window.innerHeight) return;

    e.preventDefault();
    go(e.key === 'ArrowLeft' ? page - 1 : page + 1);
  });

  /* Свайп по листу. Вертикальное движение отдаём странице — она прокручивается */
  let touchX = null;
  let touchY = null;
  stage.addEventListener(
    'touchstart',
    (e) => {
      touchX = e.changedTouches[0].clientX;
      touchY = e.changedTouches[0].clientY;
    },
    { passive: true }
  );

  stage.addEventListener(
    'touchend',
    (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      touchX = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? page + 1 : page - 1);
    },
    { passive: true }
  );

  /* Размер окна изменился — холсты нарисованы под старую меру листа */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const [, canvas] of cache) {
        canvas.width = 0;
        canvas.height = 0;
      }
      cache.clear();
      setScale();
      render(page);
    }, 250);
  });

  await measure();
  setScale();
  await go(1);
}

/* Модули, worker или сам pdf.js не поднялись — показываем книгу встроенным
   просмотрщиком браузера, лишь бы читатель её увидел. */
function fallback(root, src) {
  const frame = document.createElement('iframe');
  frame.src = `${src}#view=FitH&pagemode=none`;
  frame.title = 'Книга в формате PDF';
  frame.className = 'pdf__fallback';
  root.replaceChildren(frame);
  root.classList.add('is-fallback');
}
