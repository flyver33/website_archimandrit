<#
  Собирает страницу текстового материала из .docx.

  Из документа берутся: заголовок (стиль Title), оглавление (стиль List Paragraph)
  и тело. Абзацы, совпавшие с записью оглавления, становятся заголовками частей
  с якорями t-1…t-N; жирные реплики — репликами ведущего (.is-host); курсив
  сохраняется как <em>.

  Пример:
    powershell -ExecutionPolicy Bypass -File tools/docx-to-page.ps1 `
      -Source "assets/docs/texts/БЕСЕДЫ С БАТЮШКОЙ 23.09..docx" `
      -Out "texts/besedy-s-batyushkoy.html" `
      -Title "Беседы с батюшкой на телеканале «Союз»" `
      -Lead "Расшифровки эфиров программы «Беседы с батюшкой»."
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Out,
  [Parameter(Mandatory = $true)][string]$Title,
  [string]$Lead = ''
)

$ErrorActionPreference = 'Stop'
$W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

$SourcePath = (Resolve-Path $Source).Path
$OutPath = if ([System.IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path (Get-Location) $Out }

# --- Распаковка document.xml -------------------------------------------------

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($SourcePath)
try {
  $entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
  if (-not $entry) { throw "В $Source нет word/document.xml" }
  $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
  $xmlText = $reader.ReadToEnd()
  $reader.Close()
} finally { $zip.Dispose() }

$doc = New-Object System.Xml.XmlDocument
$doc.PreserveWhitespace = $true
$doc.LoadXml($xmlText)
$ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
$ns.AddNamespace('w', $W)

$paras = @($doc.SelectNodes('//w:body/w:p', $ns))

# --- Вспомогательное ---------------------------------------------------------

$months = @{
  'января' = 1; 'февраля' = 2; 'марта' = 3; 'апреля' = 4; 'мая' = 5; 'июня' = 6
  'июля' = 7; 'августа' = 8; 'сентября' = 9; 'октября' = 10; 'ноября' = 11; 'декабря' = 12
}
$monthNames = @('', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря')

function Get-ParaStyle($p) {
  $n = $p.SelectSingleNode('w:pPr/w:pStyle/@w:val', $ns)
  if ($n) { $n.Value } else { '' }
}

function Get-ParaText($p) {
  (($p.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join '') -replace '\s+', ' '
}

function Get-Norm($s) {
  ($s.ToLower() -replace '[^\p{L}\p{Nd}]', '')
}

function Get-DateKey($s) {
  # «8 февраля 2013», «24.08. 11 г.», «22.04.2018» → 2013-02-08
  if ($s -match '(\d{1,2})\s+([а-яё]+)\s+(\d{4})' -and $months.ContainsKey($matches[2])) {
    return ('{0:d4}-{1:d2}-{2:d2}' -f [int]$matches[3], $months[$matches[2]], [int]$matches[1])
  }
  if ($s -match '(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2,4})') {
    $y = [int]$matches[3]
    if ($y -lt 100) { $y += 2000 }
    return ('{0:d4}-{1:d2}-{2:d2}' -f $y, [int]$matches[2], [int]$matches[1])
  }
  return ''
}

function Format-DateRu($key) {
  if (-not $key) { return '' }
  $parts = $key.Split('-')
  '{0} {1} {2}' -f [int]$parts[2], $monthNames[[int]$parts[1]], $parts[0]
}

function Get-CommonPrefixLen($a, $b) {
  $n = [Math]::Min($a.Length, $b.Length)
  $i = 0
  while ($i -lt $n -and $a[$i] -eq $b[$i]) { $i++ }
  $i
}

function Test-TitleMatch($bodyNorm, $tocNorm, $bodyRaw, $tocRaw) {
  if ($bodyNorm.Length -lt 6) { return $false }
  if ((Get-CommonPrefixLen $bodyNorm $tocNorm) -ge 12) { return $true }
  if ($bodyNorm.Length -ge 12 -and $tocNorm.Contains($bodyNorm)) { return $true }
  if ($tocNorm.Length -ge 12 -and $bodyNorm.Contains($tocNorm)) { return $true }
  # запись оглавления могла быть переписана — тогда роднит дата эфира
  $bd = Get-DateKey $bodyRaw
  if ($bd -and $bd -eq (Get-DateKey $tocRaw)) { return $true }
  $false
}

function Get-CleanTitle($raw) {
  $t = $raw.Trim()
  $t = $t -replace '^(Студия\s*«?СОЮЗ»?\s*\.?\s*(Беседа\s*[:.]?)?\s*)', ''
  $t = $t -replace '^(Беседы\s+с\s+батюшкой\s*[.:]?\s*)', ''
  $t = $t -replace '^(Беседа\s+(о|об)\s+)', 'О '
  $t = $t -replace '\s*(Эфир\s+от\s+)?\d{1,2}\s+[а-яё]+\s+\d{4}\s*(г\.?|года)?\s*\.?\s*$', ''
  $t = $t -replace '\s*(Эфир\s+от\s+)?\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}\s*(г\.?)?\s*\.?\s*$', ''
  $t = $t -replace '\s*Эфир\s+от\s*$', ''
  $t = $t.Trim(' ', '.', ',', '—', '-', ':')
  # после снятия приставки «Студия „Союз“. Беседа…» заголовок мог начаться со строчной
  if ($t -and [char]::IsLower($t[0])) { $t = $t.Substring(0, 1).ToUpper() + $t.Substring(1) }
  $t
}

function Convert-Escape($s) {
  $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;')
}

function Test-RunFlag($run, $name) {
  $n = $run.SelectSingleNode("w:rPr/w:$name", $ns)
  if (-not $n) { return $false }
  $v = $n.GetAttribute('val', $W)
  if ($v -in @('0', 'false', 'none')) { return $false }
  $true
}

# Абзац → html: вернёт @{ Html; Text; AllBold }
function Convert-Para($p) {
  $sb = New-Object System.Text.StringBuilder
  $plain = New-Object System.Text.StringBuilder
  $hasText = $false
  $allBold = $true

  foreach ($run in $p.SelectNodes('.//w:r', $ns)) {
    $text = ''
    foreach ($child in $run.ChildNodes) {
      switch ($child.LocalName) {
        't' { $text += $child.InnerText }
        'tab' { $text += ' ' }
        'br' { $text += "`n" }
        'noBreakHyphen' { $text += '-' }
        'softHyphen' { }
      }
    }
    if ($text -eq '') { continue }

    $bold = Test-RunFlag $run 'b'
    $italic = Test-RunFlag $run 'i'
    if ($text.Trim() -ne '') {
      $hasText = $true
      if (-not $bold) { $allBold = $false }
    }

    [void]$plain.Append($text)
    # Word нередко сшивает неразрывным пробелом всю фразу — такая строка не
    # переносится и рвёт вёрстку. Оставляем его только после коротких слов
    # (предлоги, инициалы), где он и нужен.
    $text = [regex]::Replace($text, '(?<=\S{3}) ', ' ')
    $html = (Convert-Escape $text).Replace("`n", '<br>')
    if ($italic) { $html = "<em>$html</em>" }
    if ($bold) { $html = "<b>$html</b>" }
    [void]$sb.Append($html)
  }

  @{
    Html    = $sb.ToString()
    Text    = $plain.ToString()
    AllBold = ($hasText -and $allBold)
    HasText = $hasText
  }
}

# --- Оглавление --------------------------------------------------------------

$toc = @()
$lastTocIdx = -1
$docTitle = $Title
for ($i = 0; $i -lt $paras.Count; $i++) {
  $style = Get-ParaStyle $paras[$i]
  if ($style -eq 'a5' -or $style -eq 'ListParagraph') {
    $t = (Get-ParaText $paras[$i]).Trim()
    if ($t) { $toc += $t; $lastTocIdx = $i }
  }
}
if ($toc.Count -eq 0) { throw 'Оглавление не найдено: нет абзацев со стилем List Paragraph' }
Write-Host "Записей в оглавлении: $($toc.Count)"

$tocNorm = $toc | ForEach-Object { Get-Norm $_ }

# --- Разбор тела -------------------------------------------------------------

$parts = @()   # @{ Id; Title; DateKey; DateRu; Html (StringBuilder) }
$cur = $null
$j = 0

for ($i = $lastTocIdx + 1; $i -lt $paras.Count; $i++) {
  $p = $paras[$i]
  $raw = (Get-ParaText $p).Trim()
  if ($raw -eq '') { continue }

  # заголовок очередной части
  if ($j -lt $toc.Count -and $raw.Length -le 160) {
    if (Test-TitleMatch (Get-Norm $raw) $tocNorm[$j] $raw $toc[$j]) {
      $dateKey = Get-DateKey $raw
      if (-not $dateKey) { $dateKey = Get-DateKey $toc[$j] }
      $clean = Get-CleanTitle $raw
      if (-not $clean) { $clean = Get-CleanTitle $toc[$j] }
      if (-not $clean) { $clean = 'Беседа с батюшкой' }

      $cur = @{
        Id      = 't-' + ($j + 1)
        Num     = $j + 1
        Title   = $clean
        DateKey = $dateKey
        DateRu  = Format-DateRu $dateKey
        Body    = (New-Object System.Text.StringBuilder)
      }
      $parts += $cur
      $j++
      continue
    }
  }

  if (-not $cur) { continue }   # текст до первой части (шапка документа) пропускаем

  # строка-дата сразу под заголовком дублирует подпись части
  if ($cur.Body.Length -eq 0 -and $raw.Length -le 40 -and (Get-DateKey $raw) -eq $cur.DateKey -and $raw -match '^\s*(Эфир\s+от\s+)?\d') {
    continue
  }

  $conv = Convert-Para $p
  if (-not $conv.HasText) { continue }
  $cls = if ($conv.AllBold) { ' class="is-host"' } else { '' }
  $html = $conv.Html
  if ($conv.AllBold) { $html = $html -replace '</?b>', '' }
  [void]$cur.Body.Append("        <p$cls>$html</p>`r`n")
}

Write-Host "Найдено частей: $($parts.Count) из $($toc.Count)"
if ($parts.Count -ne $toc.Count) { Write-Warning 'Часть записей оглавления не сопоставлена с телом документа' }

# --- Сборка страницы ---------------------------------------------------------

$rel = '../'
$titleEsc = Convert-Escape $Title
$leadEsc = Convert-Escape $Lead

$tocHtml = New-Object System.Text.StringBuilder
foreach ($part in $parts) {
  $meta = if ($part.DateRu) { "<span class=`"toc__date`">$($part.DateRu)</span>" } else { '' }
  [void]$tocHtml.Append("          <li><a href=`"#$($part.Id)`">$(Convert-Escape $part.Title)$meta</a></li>`r`n")
}

$body = New-Object System.Text.StringBuilder
foreach ($part in $parts) {
  $meta = "эфир $($part.Num) из $($parts.Count)"
  if ($part.DateRu) {
    $meta = "<time datetime=`"$($part.DateKey)`">$($part.DateRu)</time> · $meta"
  }
  [void]$body.Append(@"
      <section class="part" id="$($part.Id)">
        <h2 class="part__title">$(Convert-Escape $part.Title)</h2>
        <p class="part__meta">$meta</p>
$($part.Body.ToString())        <p class="part__up"><a class="link" href="#toc">Наверх, к содержанию</a></p>
      </section>

"@)
}

$header = @"
<a class="skip-link" href="#main">Перейти к содержанию</a>

<header class="header" id="header">
  <div class="container header__inner">

    <a class="logo" href="${rel}index.html" aria-label="Архимандрит Мелхиседек — на главную">
      <span class="logo__line">Архимандрит</span>
      <span class="logo__line">Мелхиседек</span>
    </a>

    <nav class="nav" aria-label="Основное меню">
      <div class="nav__item">
        <a class="nav__link" href="${rel}index.html#slovo" aria-haspopup="true">
          Слово
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg>
        </a>
        <div class="nav__menu">
          <a href="${rel}index.html#slovo">Проповеди</a>
          <a href="${rel}index.html#slovo">Беседы и встречи</a>
          <a href="${rel}index.html#slovo">Толкование Библии</a>
          <a href="${rel}index.html#slovo">Ответы от Писания</a>
        </div>
      </div>

      <div class="nav__item">
        <a class="nav__link" href="${rel}index.html#media" aria-haspopup="true">
          Медиа
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg>
        </a>
        <div class="nav__menu">
          <a href="${rel}index.html#media">Телепередачи</a>
          <a href="${rel}index.html#media">Радиопередачи</a>
          <a href="${rel}index.html#media">Фотогалерея</a>
        </div>
      </div>

      <div class="nav__item">
        <a class="nav__link" href="${rel}index.html#posts" aria-haspopup="true">
          Тексты
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg>
        </a>
        <div class="nav__menu">
          <a href="${rel}books/index.html">Книги</a>
          <a href="${rel}index.html#posts">Статьи</a>
          <a href="${rel}index.html#posts">Новости</a>
        </div>
      </div>

      <div class="nav__item"><a class="nav__link" href="${rel}index.html#events">Мероприятия</a></div>
      <div class="nav__item"><a class="nav__link" href="${rel}index.html#bio">Биография</a></div>
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

<div class="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Меню сайта" hidden>
  <button class="icon-btn mobile-menu__close" type="button" id="menu-close" aria-label="Закрыть меню">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16"/></svg>
  </button>
  <div class="container">
    <section>
      <h2>Слово</h2>
      <a href="${rel}index.html#slovo">Проповеди</a>
      <a href="${rel}index.html#slovo">Беседы и встречи</a>
      <a href="${rel}index.html#slovo">Толкование Библии</a>
      <a href="${rel}index.html#slovo">Ответы от Писания</a>
    </section>
    <section>
      <h2>Медиа</h2>
      <a href="${rel}index.html#media">Телепередачи</a>
      <a href="${rel}index.html#media">Радиопередачи</a>
      <a href="${rel}index.html#media">Фотогалерея</a>
    </section>
    <section>
      <h2>Тексты</h2>
      <a href="${rel}books/index.html">Книги</a>
      <a href="${rel}index.html#posts">Статьи</a>
      <a href="${rel}index.html#posts">Новости</a>
    </section>
    <section>
      <h2>Ещё</h2>
      <a href="${rel}index.html#events">Мероприятия</a>
      <a href="${rel}index.html#bio">Биография</a>
    </section>
  </div>
</div>
"@

$footer = @"
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
        <h3>Разделы</h3>
        <ul>
          <li><a href="${rel}news/index.html">Новости</a></li>
          <li><a href="${rel}propovedi/index.html">Проповеди</a></li>
          <li><a href="${rel}besedy/index.html">Беседы и встречи</a></li>
          <li><a href="${rel}video/index.html">Телепередачи</a></li>
          <li><a href="${rel}radio/index.html">Радиопередачи</a></li>
          <li><a href="${rel}books/index.html">Книги</a></li>
          <li><a href="${rel}stati/index.html">Статьи</a></li>
          <li><a href="${rel}foto/index.html">Фото</a></li>
          <li><a href="${rel}events/index.html">Мероприятия</a></li>
          <li><a href="${rel}bio/index.html">Автобиография</a></li>
        </ul>
      </div>

      <div class="footer__col footer__col--contacts">
        <h3>Контакты</h3>
        <ul>
          <li>
            <a class="footer__contact" href="https://hrampokrov.ru/" target="_blank" rel="noopener">
              Храм Покрова Пресвятой Богородицы
              <span class="footer__contact-note">hrampokrov.ru</span>
            </a>
          </li>
          <li>
            <a class="footer__contact" href="http://optina-msk.ru/" target="_blank" rel="noopener">
              Подворье Оптиной пустыни в Москве
              <span class="footer__contact-note">optina-msk.ru</span>
            </a>
          </li>
          <li>
            <a class="footer__contact" href="https://max.ru/melkhisedek_artyukhin_official" target="_blank" rel="noopener">
              MAX
              <span class="footer__contact-note">melkhisedek_artyukhin_official</span>
            </a>
          </li>
          <li>
            <a class="footer__contact" href="https://t.me/melkhisedek_artyukhin_official" target="_blank" rel="noopener">
              Telegram
              <span class="footer__contact-note">@melkhisedek_artyukhin_official</span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  </div>
</footer>
"@

$page = @"
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$titleEsc — архимандрит Мелхиседек (Артюхин)</title>
<meta name="description" content="$leadEsc">
<meta name="theme-color" content="#FFFDF8">

<link rel="icon" href="${rel}assets/img/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${rel}assets/fonts/arsenal-400-normal-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${rel}assets/fonts/ptserif-400-normal-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${rel}assets/css/fonts.css">
<link rel="stylesheet" href="${rel}assets/css/tokens.css">
<link rel="stylesheet" href="${rel}assets/css/base.css">
<link rel="stylesheet" href="${rel}assets/css/components.css">
<link rel="stylesheet" href="${rel}assets/css/reading.css">
<script>document.documentElement.classList.add('js');</script>
</head>
<body>

$header

<main id="main">

  <div class="container page-head">
    <nav class="crumbs" aria-label="Хлебные крошки">
      <a class="link" href="${rel}index.html#posts">Текстовые материалы</a>
      <span aria-hidden="true">·</span>
      <span class="crumbs__current">$titleEsc</span>
    </nav>
    <h1 class="page-head__title">$titleEsc</h1>
    <p class="page-head__lead">$leadEsc</p>
  </div>

  <div class="container reading">

    <details class="toc" id="toc" open>
      <summary class="toc__summary">Содержание · $($parts.Count) эфиров</summary>
      <nav aria-label="Содержание">
        <ol class="toc__list">
$($tocHtml.ToString())        </ol>
      </nav>
    </details>

    <article class="reading__body">
$($body.ToString())    </article>

  </div>

</main>

$footer

<script src="${rel}assets/js/main.js" defer></script>
<script src="${rel}assets/js/reading.js" defer></script>
</body>
</html>
"@

$dir = Split-Path -Parent $OutPath
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
[System.IO.File]::WriteAllText($OutPath, $page, (New-Object System.Text.UTF8Encoding($false)))

$kb = [Math]::Round((Get-Item $OutPath).Length / 1KB)
Write-Host "Готово: $OutPath ($kb КБ)"
