// ── APP.JS ────────────────────────────────────────
// UI rendering, screen switching, session flow.
// Depends on: words.js, storage.js, srs.js

// ── Runtime state ─────────────────────────────────
var curFilter  = 'all';
var curMode    = 'fc';
var selLessons = new Set(['all']);
var selTopics  = new Set(['all']);
var selLevels  = new Set(['all']);
var sWords = [], sIdx = 0, sOk = 0, sTotal = 0, fcFlipped = false;
var isDailySession  = false;
var sessionReviews  = 0;
var sessionCorrect  = 0;

// ── Display label maps ─────────────────────────────
// Display labels for topic keys found in WORDS. Formatter only — not a source of truth.
var TOPIC_LABELS = {
  // v3 topics
  'podstawy_komunikacji':           'Podstawy komunikacji',
  'zyczenia_i_okazje':              'Życzenia i okazje',
  'rodzina_i_relacje':              'Rodzina i relacje',
  'transport':                      'Transport',
  'miejsca_w_miescie':              'Miejsca w mieście',
  'codzienne_czynnosci':            'Codzienne czynności',
  'ubrania_rzeczy_osobiste':        'Ubrania i rzeczy',
  'jedzenie_i_picie':               'Jedzenie i picie',
  'dom_i_wyposazenie':              'Dom i wyposażenie',
  'zdrowie_i_samopoczucie':         'Zdrowie i samopoczucie',
  'zakupy_i_pieniadze':             'Zakupy i pieniądze',
  'ludzie_role_zawody':             'Ludzie, role, zawody',
  'nauka_i_rzeczy_szkolne':         'Nauka i szkoła',
  'czas_codzienny':                 'Czas codzienny',
  'technologia_i_urzadzenia':       'Technologia',
  'gramatyka_podstawowa':           'Gramatyka',
  'classifiery_i_liczenie':         'Classifiery',
  'przymiotniki_podstawowe':        'Przymiotniki',
  'czas_rozszerzony':               'Czas rozszerzony',
  'gotowe_frazy_codzienne':         'Frazy codzienne',
  'pogoda_i_warunki':               'Pogoda',
  'zwierzeta':                      'Zwierzęta',
  'nazwy_wlasne_i_geografia':       'Nazwy własne',
  'czasowniki_i_frazy_rozszerzone': 'Czasowniki rozszerzone',
  'kultura_nauka_rozrywka':         'Kultura i rozrywka',
  'liczby_i_ilosci':                'Liczby i ilości',
  'kraje_i_jezyki':                 'Kraje i języki',
  // legacy (backwards compat)
  'tozsamosc_i_ludzie':   'Tożsamość i ludzie',
  'cialo_i_zdrowie':      'Ciało i zdrowie',
  'dom_i_przestrzen':     'Dom i przestrzeń',
  'miasto_i_transport':   'Miasto i transport',
  'czas_i_kalendarz':     'Czas i kalendarz',
  'szkola_i_nauka':       'Szkoła i nauka',
  'praca_i_biuro':        'Praca i biuro',
  'wyglad_i_opisy':       'Wygląd i opisy',
  'emocje_i_oceny':       'Emocje i oceny',
  'rozmowa_i_frazy':      'Rozmowa i frazy',
  'nazwy_wlasne':         'Nazwy własne'
};

// Display labels for levelApprox keys found in WORDS. Formatter only — not a source of truth.
var LEVEL_LABELS = {
  'starter':      'Wstępny',
  'A1':           'A1',
  'A2':           'A2',
  'HSK1':         'HSK 1',
  'HSK2':         'HSK 2',
  'HSK3':         'HSK 3',
  'HSK3plus':     'HSK 3+',
  'proper_noun':  'Nazwa własna'
};

// ── STREAK ────────────────────────────────────────
function checkAndUpdateStreak() {
  const t = today();
  if (streakData.lastDate === t) return;
  const yesterday = addDays(t, -1);
  if (streakData.lastDate === yesterday) {
    streakData.current++;
  } else if (streakData.lastDate !== t) {
    streakData.current = 1;
  }
  streakData.lastDate = t;
  saveAll();
  renderStreakBadge();
}

function renderStreakBadge() {
  document.getElementById('streak-num').textContent = streakData.current || 0;
  document.getElementById('hs-streak').textContent  = streakData.current || 0;
}

// ── NAV ───────────────────────────────────────────
function updateNavMastered() {
  const m = WORDS.filter(w => SRS.isMastered(srsData[w.id])).length;
  document.getElementById('nm').textContent = m;
}

function go(name, btn) {
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.botnav-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('scr-' + name).classList.add('on');
  if (btn) btn.classList.add('on');
  if (name === 'home')   renderHomeScreen();
  if (name === 'stats')  renderStats();
  if (name === 'stages') renderStages();
  if (name === 'words')  renderWords();
  if (name === 'study')  { hideAll(); document.getElementById('sh').style.display = 'block'; updateSessionCount(); }
  window.scrollTo(0, 0);
}

// ── HOME SCREEN ───────────────────────────────────
function renderHomeScreen() {
  ensureDailyLog();
  const { due, newWords, total } = getDailyWords();
  const goal      = appConfig.dailyGoal;
  const done      = dailyLog.done;
  const remaining = Math.max(0, total - done);

  const h     = new Date().getHours();
  const greet = h < 6 ? 'Dobranoc! 🌙' : h < 12 ? 'Dzień dobry! ☀️' : h < 18 ? 'Dzień dobry! 🌤️' : 'Dobry wieczór! 🌙';
  document.getElementById('home-greeting').textContent = greet;

  let sub = '';
  if (remaining === 0 && done > 0) {
    sub = '✓ Dzienny cel osiągnięty! Świetna robota.';
  } else {
    sub = remaining > 0
      ? 'Masz ' + remaining + ' słówek do zrobienia dziś.'
      : 'Brak zaplanowanych powtórek — świetnie!';
  }
  document.getElementById('home-sub').textContent = sub;

  document.getElementById('hc-due-v').textContent  = due.length;
  document.getElementById('hc-new-v').textContent  = newWords.length;
  document.getElementById('hc-done-v').textContent = done;

  const pct = goal > 0 ? Math.min(100, Math.round(done / goal * 100)) : 0;
  document.getElementById('daily-prog-fill').style.width = pct + '%';
  document.getElementById('daily-prog-txt').textContent  = done + ' / ' + goal;

  const btn = document.getElementById('btn-start-day');
  if (remaining === 0 && done > 0) {
    btn.textContent = '✓ Cel osiągnięty — ćwicz więcej';
    btn.classList.add('done');
  } else {
    btn.textContent = remaining > 0 ? 'Rozpocznij dzisiejszą sesję →' : 'Powtórz słówka →';
    btn.classList.remove('done');
  }
  btn.disabled = false;

  const mastered = WORDS.filter(w => SRS.isMastered(srsData[w.id])).length;
  document.getElementById('hs-total').textContent    = WORDS.length;
  document.getElementById('hs-mastered').textContent = mastered;
  updateNavMastered();

  let totalR = 0, totalC = 0;
  WORDS.forEach(w => {
    const c = srsData[w.id];
    totalR += (c && c.reviews) || 0;
    totalC += (c && c.correct) || 0;
  });
  const acc = totalR > 0 ? Math.round(totalC / totalR * 100) : null;
  document.getElementById('hs-acc').textContent = acc !== null ? acc + '%' : '—';
}

function startDailySession() {
  const { due, newWords } = getDailyWords();
  const pool = shuffle([...due, ...newWords]);
  if (!pool.length) { showToast('Brak słówek na dziś! 🎉', false, 'good'); return; }

  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.botnav-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('scr-study').classList.add('on');
  var navBtn = document.getElementById('bn-study');
  if (navBtn) navBtn.classList.add('on');
  window.scrollTo(0, 0);

  isDailySession = true;
  beginSession(pool, 'fc');
}

// ── STATS ─────────────────────────────────────────
function renderStats() {
  const total    = WORDS.length;
  const mastered = WORDS.filter(w =>  SRS.isMastered(srsData[w.id])).length;
  const learning = WORDS.filter(w => { const c = srsData[w.id]; return !SRS.isNew(c) && !SRS.isMastered(c); }).length;
  const newW     = WORDS.filter(w =>  SRS.isNew(srsData[w.id])).length;

  document.getElementById('st-t').textContent = total;
  document.getElementById('st-m').textContent = mastered;
  document.getElementById('st-l').textContent = learning;
  document.getElementById('st-n').textContent = newW;
  document.getElementById('lg-m').textContent = mastered;
  document.getElementById('lg-l').textContent = learning;
  document.getElementById('lg-n').textContent = newW;

  const C  = 301.6;
  const mP = total ? mastered / total : 0;
  const lP = total ? learning / total : 0;
  document.getElementById('d-m').style.strokeDashoffset = C - mP * C;
  document.getElementById('d-l').style.strokeDashoffset = C - lP * C;
  document.getElementById('d-l').setAttribute('transform', 'rotate(' + (-90 + mP * 360) + ' 65 65)');
  document.getElementById('d-pct').textContent = Math.round(mP * 100) + '%';

  const weakEl     = document.getElementById('weak-list');
  const candidates = WORDS
    .map(w => ({ ...w, c: srsData[w.id] }))
    .filter(w => (w.c.reviews || 0) >= 2)
    .map(w => ({ ...w, acc: (w.c.correct || 0) / (w.c.reviews || 1) }))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 8);

  if (!candidates.length) {
    weakEl.innerHTML = '<div class="empty">Ucz się więcej, żeby zobaczyć statystyki!</div>';
  } else {
    weakEl.innerHTML = candidates.map(w => {
      const pct = Math.round(w.acc * 100);
      const cls = pct < 50 ? 'bad' : 'mid';
      return '<div class="weak-item">' +
        '<div><span class="weak-hz">' + w.hanzi + '</span> <span class="weak-pl">' + w.pl + '</span></div>' +
        '<div class="weak-acc ' + cls + '">' + pct + '%</div>' +
        '</div>';
    }).join('');
  }

  var chartLessons = getLessonItemsFromWords().slice(1).map(function(i) { return i.value; });
  document.getElementById('bchart').innerHTML = chartLessons.map(ls => {
    const lw = WORDS.filter(w => getNormalizedLessonKey(w) === ls);
    const lm = lw.filter(w => SRS.isMastered(srsData[w.id])).length;
    const p  = lw.length ? Math.round(lm / lw.length * 100) : 0;
    return '<div class="brow"><div class="blbl">' + ls + '</div>' +
      '<div class="btrack"><div class="bfill" style="width:' + p + '%"></div></div>' +
      '<div class="bpct">' + p + '%</div></div>';
  }).join('');
}

// ── WORDS BROWSER ─────────────────────────────────
var curFilter2 = 'all';
var curTopic2  = 'all';
var curLevel2  = 'all';

function filterWords(l, btn) {
  curFilter2 = l;
  document.querySelectorAll('#frow-lesson .chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderWords();
}

function filterTopic(t, btn) {
  curTopic2 = t;
  document.querySelectorAll('#frow-topic .chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderWords();
}

function filterLevel(lv, btn) {
  curLevel2 = lv;
  document.querySelectorAll('#frow-level .chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderWords();
}

function renderWords() {
  const q = (document.getElementById('srch').value || '').toLowerCase();
  let f = WORDS;
  if (curFilter2 !== 'all') f = f.filter(w => getNormalizedLessonKey(w) === curFilter2);
  if (curTopic2  !== 'all') f = f.filter(w => w.topic === curTopic2);
  if (curLevel2  !== 'all') f = f.filter(w => w.levelApprox === curLevel2);
  if (q) f = f.filter(w =>
    w.hanzi.includes(q) ||
    w.pinyin.toLowerCase().includes(q) ||
    w.pl.toLowerCase().includes(q)
  );

  document.getElementById('clbl').textContent = f.length + ' słówek';
  const g = document.getElementById('wgrid');

  if (!f.length) { g.innerHTML = '<div class="empty">Brak wyników…</div>'; return; }

  g.innerHTML = f.map(w => {
    const c    = srsData[w.id];
    const tag  = SRS.isNew(c)      ? '<span class="srs-tag new">Nowe</span>'
               : SRS.isMastered(c) ? '<span class="srs-tag ok">✓ Opanowane</span>'
               : SRS.isDue(c)      ? '<span class="srs-tag due">Do powtórki</span>'
               :                     '<span class="srs-tag learning">W nauce</span>';
    const mPct = Math.min(100, Math.round((c.interval || 0) / 21 * 100));
    const topicLbl = TOPIC_LABELS[w.topic] || w.topic || '';
    const levelLbl = LEVEL_LABELS[w.levelApprox] || w.levelApprox || '';
    const metaHtml = '<div class="wcard-meta">' +
      '<span class="ls">' + getNormalizedLessonKey(w) + '</span>' +
      (topicLbl ? '<span class="wtopic">' + topicLbl + '</span>' : '') +
      (levelLbl ? '<span class="wlevel">' + levelLbl + '</span>' : '') +
      '</div>';
    const tagsHtml = (w.tags && w.tags.length)
      ? '<div class="wtags">' + w.tags.map(t => '<span class="wtag">' + t + '</span>').join('') + '</div>'
      : '';
    const mwBadge = w.measureWord
      ? '<span class="mw-badge" title="Klasyfikator: ' + w.measureWord.hanzi + ' (' + w.measureWord.pinyin + ')">' + w.measureWord.hanzi + '</span>'
      : '';
    return '<div class="wcard">' +
      '<span class="hz">' + w.hanzi + '</span>' +
      mwBadge +
      '<div class="py">' + w.pinyin + '</div>' +
      '<div class="tr">' + w.pl + '</div>' +
      metaHtml +
      tag +
      tagsHtml +
      '<div class="mb"><div class="mbf" style="width:' + mPct + '%"></div></div>' +
      '</div>';
  }).join('');
}

// ── STUDY — MODE SELECT ───────────────────────────
function selMode(m) {
  curMode = m;
  document.querySelectorAll('.mcard').forEach(b => b.classList.remove('on'));
  document.getElementById('m-' + m).classList.add('on');
}

function toggleLesson(l, btn) {
  if (l === 'all') {
    selLessons = new Set(['all']);
    document.querySelectorAll('#slf .chip').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  } else {
    selLessons.delete('all');
    document.querySelector('#slf .chip').classList.remove('on');
    if (selLessons.has(l)) { selLessons.delete(l); btn.classList.remove('on'); }
    else                   { selLessons.add(l);    btn.classList.add('on');    }
    if (!selLessons.size) { selLessons.add('all'); document.querySelector('#slf .chip').classList.add('on'); }
  }
  updateSessionCount();
}

function toggleTopic(t, btn) {
  if (t === 'all') {
    selTopics = new Set(['all']);
    document.querySelectorAll('#stf .chip').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  } else {
    selTopics.delete('all');
    document.querySelector('#stf .chip').classList.remove('on');
    if (selTopics.has(t)) { selTopics.delete(t); btn.classList.remove('on'); }
    else                  { selTopics.add(t);    btn.classList.add('on');    }
    if (!selTopics.size) { selTopics.add('all'); document.querySelector('#stf .chip').classList.add('on'); }
  }
  updateSessionCount();
}

function toggleLevel(lv, btn) {
  if (lv === 'all') {
    selLevels = new Set(['all']);
    document.querySelectorAll('#slvl .chip').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  } else {
    selLevels.delete('all');
    document.querySelector('#slvl .chip').classList.remove('on');
    if (selLevels.has(lv)) { selLevels.delete(lv); btn.classList.remove('on'); }
    else                   { selLevels.add(lv);    btn.classList.add('on');    }
    if (!selLevels.size) { selLevels.add('all'); document.querySelector('#slvl .chip').classList.add('on'); }
  }
  updateSessionCount();
}

function getPool() {
  let pool = selLessons.has('all') ? WORDS : WORDS.filter(w => selLessons.has(getNormalizedLessonKey(w)));
  if (!selTopics.has('all')) pool = pool.filter(w => selTopics.has(w.topic));
  if (!selLevels.has('all')) pool = pool.filter(w => selLevels.has(w.levelApprox));
  return pool;
}

function updateSessionCount() {
  const scntEl = document.getElementById('scnt');
  if (!scntEl) return;
  const pool = getPool();
  scntEl.textContent = pool.length + ' słówek w puli';
}

function startCustomSession() {
  const basePool = getPool();
  const pool = shuffle([...basePool]);

  if (!pool.length) {
    showToast('Brak słówek!', true);
    updateSessionCount();
    return;
  }

  isDailySession = false;
  beginSession(pool, curMode);
}

// ── SESSION ENGINE ────────────────────────────────
function beginSession(pool, mode) {
  sWords = [...pool]; sIdx = 0; sOk = 0; sTotal = pool.length;
  sessionReviews = 0; sessionCorrect = 0; fcFlipped = false;
  curMode = mode;
  hideAll();
  if (mode === 'fc')      startFC();
  else if (mode === 'qz') startQZ();
  else                    startTP();
}

function restartSession() { beginSession(sWords.slice(0, sTotal), curMode); }

function hideAll() {
  ['sh','sfc','sqz','stp','sres'].forEach(id => document.getElementById(id).style.display = 'none');
}

function backHome() {
  hideAll();
  isDailySession = false;
  go('home', document.getElementById('bn-home'));
}

function sp(p, i, t) {
  const pc = t ? i / t * 100 : 0;
  document.getElementById(p + '-t').textContent   = i + '/' + t;
  document.getElementById(p + '-f').style.width   = pc + '%';
}

// wasNew: czy karta była new PRZED wywołaniem SRS.schedule() — przekazywane przez wywołującego
function recordAnswer(hanzi, correct, wasNew) {
  sessionReviews++;
  if (correct) sessionCorrect++;
  ensureDailyLog();
  dailyLog.done++;
  if (wasNew) dailyLog.newDone++;
  saveAll();
}

// ── FLASHCARD ─────────────────────────────────────
function startFC() {
  document.getElementById('sfc').style.display = 'block';
  document.getElementById('fc-mode-lbl').textContent = isDailySession ? 'DZIENNA SESJA' : 'FISZKI';
  fcFlipped = false;
  loadFC();
}

function loadFC() {
  if (!Array.isArray(sWords) || !sWords.length) {
    showResults();
    return;
  }

  if (sIdx >= sWords.length) {
    showResults();
    return;
  }

  const w = sWords[sIdx];
  if (!w) {
    showResults();
    return;
  }

  fcFlipped = false;

  const srsBtns = document.getElementById('srs-btns');
  if (srsBtns) srsBtns.style.display = 'none';

  const fcEl = document.getElementById('fc');
  if (!fcEl) return;

  const hzEl = document.getElementById('fc-hz');
  const pyEl = document.getElementById('fc-py');
  const trEl = document.getElementById('fc-tr');
  const bhEl = document.getElementById('fc-bh');
  const mwEl = document.getElementById('fc-mw');

  function applyContent() {
    if (hzEl) hzEl.textContent = w.hanzi || '—';
    if (pyEl) pyEl.textContent = w.pinyin || '—';
    if (trEl) trEl.textContent = w.pl || '—';
    if (bhEl) bhEl.textContent = w.hanzi || '—';

    if (mwEl) {
      var mw = w.measureWord;
      if (mw) {
        mwEl.innerHTML = '<span class="fc-mw-label">Klasyfikator:</span> ' +
          '<span class="fc-mw-hz">' + mw.hanzi + '</span> ' +
          '<span class="fc-mw-py">' + mw.pinyin + '</span>' +
          (mw.exampleHanzi ? '<div class="fc-mw-ex">' + mw.exampleHanzi + ' <span class="fc-mw-ex-py">' + mw.examplePinyin + '</span> — ' + mw.examplePolish + '</div>' : '');
        mwEl.style.display = '';
      } else {
        mwEl.style.display = 'none';
      }
    }

    sp('fc', sIdx + 1, sWords.length);
  }

  if (fcEl.classList.contains('flip')) {
    fcEl.style.transition = 'transform .45s cubic-bezier(.4,0,.2,1)';
    fcEl.classList.remove('flip');
    setTimeout(applyContent, 220);
  } else {
    applyContent();
  }
}

function flipCard() {
  if (fcFlipped) return;
  fcFlipped = true;
  document.getElementById('fc').classList.add('flip');
  const w         = sWords[sIdx];
  const intervals = SRS.previewIntervals(srsData[w.id]);
  ['srs-i0','srs-i1','srs-i2','srs-i3'].forEach((id, i) => {
    document.getElementById(id).textContent = intervals[i];
  });
  setTimeout(() => document.getElementById('srs-btns').style.display = 'block', 340);
}

function srsAns(rating) {
  const w      = sWords[sIdx];
  const card   = srsData[w.id];
  const wasNew = SRS.isNew(card);
  const correct = (rating >= 2);
  SRS.schedule(card, rating);
  srsData[w.id] = card;
  recordAnswer(w.id, correct, wasNew);
  if (correct) sOk++;
  if (rating === 0) sWords.push(w);
  sessionIdx_inc();
}

function sessionIdx_inc() {
  sIdx++;

  const srsBtns = document.getElementById('srs-btns');
  if (srsBtns) srsBtns.style.display = 'none';

  loadFC();
}

// ── QUIZ ──────────────────────────────────────────
function startQZ() { document.getElementById('sqz').style.display = 'block'; loadQZ(); }

function loadQZ() {
  if (!Array.isArray(sWords) || !sWords.length) {
    showResults();
    return;
  }

  if (sIdx >= sWords.length) {
    showResults();
    return;
  }

  const w = sWords[sIdx];
  if (!w) {
    showResults();
    return;
  }

  const hzEl = document.getElementById('qz-hz');
  const pyEl = document.getElementById('qz-py');
  const nextBtn = document.getElementById('qz-nx');
  const optsBox = document.getElementById('qz-opts');

  if (!hzEl || !pyEl || !nextBtn || !optsBox) {
    console.error('Quiz DOM missing');
    return;
  }

  hzEl.textContent = w.hanzi || '—';
  pyEl.textContent = w.pinyin || '—';
  nextBtn.classList.remove('on');

  sp('qz', sIdx + 1, sWords.length);

  const sameLsn = WORDS.filter(x => x.pl !== w.pl && getNormalizedLessonKey(x) === getNormalizedLessonKey(w));
  const other = WORDS.filter(x => x.pl !== w.pl && getNormalizedLessonKey(x) !== getNormalizedLessonKey(w));
  const pool = shuffle(sameLsn).concat(shuffle(other));

  let opts = [w.pl];
  pool.slice(0, 3).forEach(x => opts.push(x.pl));
  while (opts.length < 4) opts.push('—');
  opts = shuffle(opts);

  optsBox.innerHTML = '';
  opts.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'qopt';
    b.textContent = opt;
    b.onclick = function () {
      ansQZ(b, opt, w.pl);
    };
    optsBox.appendChild(b);
  });
}

function ansQZ(btn, ch, cor) {
  document.querySelectorAll('.qopt').forEach(b => b.disabled = true);
  const correct = (ch === cor);
  const w       = sWords[sIdx];
  const key     = w.id;
  const wasNew  = SRS.isNew(srsData[key]);
  if (correct) {
    btn.classList.add('ok'); sOk++;
    SRS.schedule(srsData[key], 2);
  } else {
    btn.classList.add('err');
    document.querySelectorAll('.qopt').forEach(b => { if (b.textContent === cor) b.classList.add('ok'); });
    SRS.schedule(srsData[key], 0);
  }
  recordAnswer(key, correct, wasNew);
  document.getElementById('qz-nx').classList.add('on');
}

function qzNext() {
  sIdx++;
  loadQZ();
}

// ── TYPING ────────────────────────────────────────
function startTP() { document.getElementById('stp').style.display = 'block'; loadTP(); }

function loadTP() {
  if (sIdx >= sWords.length) { showResults(); return; }
  const w = sWords[sIdx];
  document.getElementById('tp-hz').textContent = w.hanzi;
  document.getElementById('tp-py').textContent = w.pinyin;
  const inp = document.getElementById('tinp');
  inp.value = ''; inp.className = 'tinp'; inp.disabled = false;
  document.getElementById('tfb').textContent = '';
  document.getElementById('tfb').className   = 'tfb';
  document.getElementById('tp-nx').classList.remove('on');
  sp('tp', sIdx + 1, sWords.length);
  setTimeout(() => inp.focus(), 50);
}

function chkType() {
  const w        = sWords[sIdx];
  const inp      = document.getElementById('tinp');
  const val      = inp.value.trim().toLowerCase();
  const fb       = document.getElementById('tfb');
  inp.disabled   = true;

  const variants = w.pl.toLowerCase().split(/[;,]/).map(s => s.trim());
  const correct  = variants.some(v => v === val || levenshtein(v, val) <= 2 || (val.length > 3 && v.includes(val)));

  const wasNew = SRS.isNew(srsData[w.id]);
  if (correct) {
    inp.classList.add('ok');
    fb.textContent = '✓ Dobrze!'; fb.className = 'tfb ok'; sOk++;
    SRS.schedule(srsData[w.id], 2);
    recordAnswer(w.id, true, wasNew);
  } else {
    inp.classList.add('err');
    fb.innerHTML = '✕ Poprawna: <b>' + w.pl + '</b>'; fb.className = 'tfb err';
    SRS.schedule(srsData[w.id], 0);
    recordAnswer(w.id, false, wasNew);
  }
  document.getElementById('tp-nx').classList.add('on');
}

function tpNext() {
  sIdx++;
  loadTP();
}

// ── RESULTS ───────────────────────────────────────
function showResults() {
  hideAll();
  document.getElementById('sres').style.display = 'block';
  const t   = Math.min(sTotal, sIdx);
  const pct = t ? Math.round(sOk / t * 100) : 0;
  document.getElementById('rsc').textContent = sOk + '/' + t;
  const labels = ['Spróbuj jeszcze raz 💪','Nieźle! Ćwicz dalej 📚','Świetnie! 🌟','Doskonale! 完美🏆'];
  document.getElementById('rsl').textContent = labels[Math.min(3, Math.floor(pct / 26))];
  document.getElementById('res-detail').textContent =
    'Sesja: ' + sessionReviews + ' powtórek · Skuteczność: ' +
    (sessionReviews > 0 ? Math.round(sessionCorrect / sessionReviews * 100) : 0) + '%';

  // Daily session completion banner
  const banner = document.getElementById('res-daily-banner');
  if (banner) banner.style.display = isDailySession ? 'block' : 'none';

  // Update home button label based on context
  const menuBtn = document.getElementById('res-menu-btn');
  if (menuBtn) menuBtn.textContent = isDailySession ? '🏠 Wróć do domu' : '🏠 Menu główne';

  checkAndUpdateStreak();
  renderStreakBadge();
  updateNavMastered();
}

// ── BACK / DIALOG ─────────────────────────────────
function confirmBack() {
  if (sIdx === 0) { backHome(); return; }
  document.getElementById('dialog-msg').textContent =
    'Postępy tej sesji (' + sOk + '/' + sIdx + ') zostaną zapisane.';
  document.getElementById('dialog-overlay').classList.add('on');
}
function dialogCancel()  { document.getElementById('dialog-overlay').classList.remove('on'); }
function dialogConfirm() { document.getElementById('dialog-overlay').classList.remove('on'); backHome(); }

// ── TOAST ─────────────────────────────────────────
function showToast(m, err, type) {
  err  = err  || false;
  type = type || '';
  const t = document.getElementById('toast');
  t.textContent = m;
  t.className   = 'toast on' + (err ? ' err' : type === 'good' ? ' good' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = 'toast', 2500);
}

// ── UTILS ─────────────────────────────────────────
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── ONBOARDING ────────────────────────────────────
var _pendingGoal = 10;

function setGoal(n, btn) {
  _pendingGoal = n;
  document.querySelectorAll('.goal-opt').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

function finishOnboard() {
  appConfig.dailyGoal  = _pendingGoal;
  appConfig.onboarded  = true;
  saveAll();
  document.getElementById('onboard').style.display = 'none';
}

// ── AUTH STATE HANDLER ───────────────────────────
function handleAuthChange(user) {
  if (user) {
    showToast('Synchronizacja z chmurą...', false);
    fbLoadAll(function(loaded) {
      WORDS.forEach(w => {
        if (!srsData[w.id]) srsData[w.id] = SRS.defaultCard();
      });
      renderStreakBadge();
      updateNavMastered();
      renderHomeScreen();
      if (loaded) showToast('Zsynchronizowano ☁️', false, 'good');
    });
  } else {
    renderHomeScreen();
  }
}

// ── CHIP RENDERING HELPERS ────────────────────────

/**
 * Render a list of {value, label} items as chip buttons into a container.
 * isActiveFn(value) → bool   determines which chip gets class "on"
 * onClickFn(value, btn)      called when a chip is clicked
 */
function renderChipList(containerId, items, isActiveFn, onClickFn) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  items.forEach(function(item) {
    var btn = document.createElement('button');
    btn.className = 'chip' + (isActiveFn(item.value) ? ' on' : '');
    btn.textContent = item.label;
    btn.onclick = function() { onClickFn(item.value, btn); };
    el.appendChild(btn);
  });
}

// ── LESSON NORMALIZATION HELPERS ──────────────────

/** Convert Chinese ordinal string to integer, e.g. "十二" → 12 */
function chineseNumToInt(s) {
  var map = {
    '一':1,'二':2,'三':3,'四':4,'五':5,
    '六':6,'七':7,'八':8,'九':9,'十':10,
    '十一':11,'十二':12,'十三':13,'十四':14,'十五':15,
    '十六':16,'十七':17,'十八':18,'十九':19,'二十':20
  };
  return map[s] || (parseInt(s, 10) || 99);
}

/** Returns the raw lesson string from a word entry. */
function getRawWordLesson(w) {
  return (w.sourceLesson || w.lesson || '').trim();
}

/**
 * Extracts lesson number from various raw formats.
 * "第一课" → 1, "第十五课" → 15, "Lesson 16" → 16, "Lesson 99" → 99.
 * Returns null if format is unrecognized.
 */
function parseLessonNumber(raw) {
  if (!raw) return null;
  var ch = raw.match(/第(.+?)课/);
  if (ch) return chineseNumToInt(ch[1]);
  var en = raw.match(/[Ll]esson\s*(\d+)/);
  if (en) return parseInt(en[1], 10);
  return null;
}

/** Returns Polish UI label for a lesson number, e.g. formatLessonLabel(16) → "Lekcja 16". */
function formatLessonLabel(n) {
  return 'Lekcja ' + n;
}

/**
 * Returns the normalized lesson key for a word, e.g. "Lekcja 1", "Lekcja 16".
 * Falls back to the raw value if the number cannot be parsed (no crash).
 */
function getNormalizedLessonKey(w) {
  var raw = getRawWordLesson(w);
  var n = parseLessonNumber(raw);
  if (n === null) return raw || '?';
  return formatLessonLabel(n);
}

/**
 * Returns sorted array of unique normalized lesson keys derived from WORDS.
 * Sorting is purely numeric.
 */
function getAvailableLessons() {
  var seen = Object.create(null);
  var items = [];
  WORDS.forEach(function(w) {
    var key = getNormalizedLessonKey(w);
    if (!key || seen[key]) return;
    seen[key] = true;
    var m = key.match(/^Lekcja\s+(\d+)$/);
    items.push({ key: key, n: m ? parseInt(m[1], 10) : 9999 });
  });
  items.sort(function(a, b) { return a.n - b.n; });
  return items.map(function(i) { return i.key; });
}

/** Returns [{value, label}] with 'all' prepended — for chip rendering. */
function getLessonItemsFromWords() {
  return [{ value: 'all', label: 'Wszystkie' }].concat(
    getAvailableLessons().map(function(l) { return { value: l, label: l }; })
  );
}

/** [{value, label}] for topics actually present in WORDS, sorted alphabetically by key. */
function getTopicItems() {
  var seen = Object.create(null);
  var topics = [];
  WORDS.forEach(function(w) {
    var t = w.topic;
    if (!t || seen[t]) return;
    seen[t] = true;
    topics.push(t);
  });
  topics.sort();
  return [{ value: 'all', label: 'Wszystkie' }].concat(
    topics.map(function(t) { return { value: t, label: TOPIC_LABELS[t] || t }; })
  );
}

/** [{value, label}] for levelApprox values actually present in WORDS, sorted by HSK order. */
function getLevelItems() {
  var ORDER = ['starter', 'A1', 'A2', 'HSK1', 'HSK2', 'HSK3', 'HSK3plus', 'proper_noun'];
  var seen = Object.create(null);
  var levels = [];
  WORDS.forEach(function(w) {
    var lv = w.levelApprox;
    if (!lv || seen[lv]) return;
    seen[lv] = true;
    levels.push(lv);
  });
  levels.sort(function(a, b) {
    var ai = ORDER.indexOf(a), bi = ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return [{ value: 'all', label: 'Wszystkie' }].concat(
    levels.map(function(lv) { return { value: lv, label: LEVEL_LABELS[lv] || lv }; })
  );
}

/**
 * Populate all 6 chip containers from data.
 * Called once on init — and re-callable if data changes.
 */
function initChips() {
  var lessonItems = getLessonItemsFromWords();
  var topicItems  = getTopicItems();
  var levelItems  = getLevelItems();

  // Words browser — single-select filters
  renderChipList('frow-lesson', lessonItems,
    function(v) { return curFilter2 === v; },
    filterWords);
  renderChipList('frow-topic', topicItems,
    function(v) { return curTopic2 === v; },
    filterTopic);
  renderChipList('frow-level', levelItems,
    function(v) { return curLevel2 === v; },
    filterLevel);

  // Study screen — multi-select toggles
  renderChipList('slf', lessonItems,
    function(v) { return selLessons.has(v); },
    toggleLesson);
  renderChipList('stf', topicItems,
    function(v) { return selTopics.has(v); },
    toggleTopic);
  renderChipList('slvl', levelItems,
    function(v) { return selLevels.has(v); },
    toggleLevel);
}

// ── STAGES SCREEN ─────────────────────────────────

// Statusy lekcji:
//   'new'         — wszystkie słówka nierozpoczęte (reps = 0)
//   'in-progress' — część słówek zaczęta, część nowa
//   'done'        — wszystkie słówka przynajmniej raz przerobione (reps > 0)
//                   ≠ opanowane: opanowanie to interval >= 21 (SRS.isMastered)
function getLessonStatus(stageId, lessonId) {
  var lw       = getStageLessonWords(stageId, lessonId);
  if (!lw.length) return 'empty';
  var newCount = lw.filter(function(w) { return SRS.isNew(srsData[w.id]); }).length;
  if (newCount === lw.length) return 'new';
  if (newCount > 0)           return 'in-progress';
  return 'done'; // wszystkie słówka widziane przynajmniej raz
}

function startLessonSession(stageId, lessonId) {
  var words = getStageLessonWords(stageId, lessonId);
  if (!words.length) { showToast('Brak słówek w tej lekcji!', true); return; }
  document.querySelectorAll('.scr').forEach(function(s) { s.classList.remove('on'); });
  document.querySelectorAll('.botnav-btn').forEach(function(b) { b.classList.remove('on'); });
  document.getElementById('scr-study').classList.add('on');
  var navBtn = document.getElementById('bn-study');
  if (navBtn) navBtn.classList.add('on');
  window.scrollTo(0, 0);
  isDailySession = false;
  beginSession(shuffle([].concat(words)), curMode);
}

function renderStages() {
  document.getElementById('stages-list').style.display = 'block';
  document.getElementById('stage-detail').style.display = 'none';

  var html = COURSE_STAGES.map(function(stage) {
    var lessons   = stage.lessons;
    var statuses  = lessons.map(function(l) { return { lesson: l, status: getLessonStatus(stage.id, l.id) }; });
    var doneCount = statuses.filter(function(s) { return s.status === 'done'; }).length;
    var pct       = lessons.length ? Math.round(doneCount / lessons.length * 100) : 0;
    var allDone   = doneCount === lessons.length;

    // Następna lekcja = pierwsza nieprzerobiona
    var nextLesson = null;
    for (var i = 0; i < statuses.length; i++) {
      if (statuses[i].status !== 'done') { nextLesson = statuses[i].lesson; break; }
    }

    var nextHint = allDone
      ? '<div class="sc-next sc-next-done">✓ Wszystkie lekcje przerobione</div>'
      : nextLesson
        ? '<div class="sc-next">Następna: <strong>' + nextLesson.name + '</strong></div>'
        : '';

    return '<div class="stage-card" onclick="renderStageDetail(\'' + stage.id + '\')">' +
      '<div class="stage-card-head">' +
        '<span class="stage-icon">' + stage.icon + '</span>' +
        '<div class="stage-card-title">' +
          '<div class="stage-name">' + stage.name + '</div>' +
          '<div class="stage-desc">' + stage.description + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="stage-lesson-summary">' +
        '<span class="sls-count">' + lessons.length + ' lekcji</span>' +
        '<span class="sls-done">' + doneCount + '/' + lessons.length + ' przerobionych</span>' +
      '</div>' +
      '<div class="stage-prog-wrap">' +
        '<div class="stage-prog-track"><div class="stage-prog-fill" style="width:' + pct + '%"></div></div>' +
      '</div>' +
      nextHint +
    '</div>';
  }).join('');

  document.getElementById('stages-list').innerHTML = html;
}

function renderStageDetail(stageId) {
  var stage = getStageById(stageId);
  if (!stage) return;

  // Lesson statuses
  var lessonStatuses = stage.lessons.map(function(lesson) {
    return { lesson: lesson, status: getLessonStatus(stageId, lesson.id) };
  });
  var doneCount    = lessonStatuses.filter(function(ls) { return ls.status === 'done'; }).length;
  var totalLessons = stage.lessons.length;

  // Stage CTA: find first non-done lesson
  var firstActive = null;
  for (var i = 0; i < lessonStatuses.length; i++) {
    if (lessonStatuses[i].status !== 'done' && lessonStatuses[i].status !== 'empty') {
      firstActive = lessonStatuses[i]; break;
    }
  }
  var allNew  = lessonStatuses.every(function(ls) { return ls.status === 'new' || ls.status === 'empty'; });
  var allDone = lessonStatuses.every(function(ls) { return ls.status === 'done' || ls.status === 'empty'; });
  var ctaLesson = firstActive ? firstActive.lesson : stage.lessons[0];
  var ctaLabel;
  if (allDone)     ctaLabel = '↺ Powtórz etap';
  else if (allNew) ctaLabel = '▶ Zacznij etap';
  else             ctaLabel = '▶ Kontynuuj: ' + ctaLesson.name;

  // Word-level breakdown for stage header
  var stageWords   = getStageWords(stageId);
  var stageNew     = stageWords.filter(function(w) { return SRS.isNew(srsData[w.id]); }).length;
  var stageMastered= stageWords.filter(function(w) { return SRS.isMastered(srsData[w.id]); }).length;
  var stageLearning= stageWords.length - stageNew - stageMastered;

  // Lesson cards
  var lessonsHtml = lessonStatuses.map(function(ls) {
    var lesson = ls.lesson;
    var status = ls.status;
    var lw     = getStageLessonWords(stageId, lesson.id);
    var lNew   = lw.filter(function(w) { return SRS.isNew(srsData[w.id]); }).length;
    var lMast  = lw.filter(function(w) { return SRS.isMastered(srsData[w.id]); }).length;
    var lLearn = lw.length - lNew - lMast;
    var lpct   = lw.length ? Math.round(lMast / lw.length * 100) : 0;

    var badge, btnLabel;
    if (status === 'done') {
      // Przerobiona = wszystkie słówka widziane ≥1 raz; opanowanie to osobna metryka
      badge = '<span class="lesson-status ls-done">✓ Przerobiona</span>';
      btnLabel = 'Powtórz';
    } else if (status === 'in-progress') {
      badge = '<span class="lesson-status ls-progress">W trakcie</span>';
      btnLabel = 'Kontynuuj';
    } else {
      badge = '<span class="lesson-status ls-new">Nowa</span>';
      btnLabel = 'Zacznij';
    }

    // Word breakdown line — show only non-zero counts
    var parts = [];
    if (lNew   > 0) parts.push(lNew   + ' nowych');
    if (lLearn > 0) parts.push(lLearn + ' w nauce');
    if (lMast  > 0) parts.push(lMast  + ' opanowanych');
    var metaStr = lw.length + ' słów' + (parts.length ? ' · ' + parts.join(' · ') : '');

    return '<div class="lesson-card' + (status === 'done' ? ' lc-done' : '') + '">' +
      '<div class="lc-header">' +
        '<span class="lc-name">' + lesson.name + '</span>' +
        badge +
      '</div>' +
      '<div class="lc-summary">' + lesson.summary + '</div>' +
      '<div class="lc-footer">' +
        '<span class="lc-meta">' + metaStr + '</span>' +
        '<button class="btn-lesson" onclick="startLessonSession(\'' + stageId + '\',\'' + lesson.id + '\')">' + btnLabel + '</button>' +
      '</div>' +
      (status !== 'new' ? '<div class="lc-bar"><div class="lc-fill" style="width:' + lpct + '%"></div></div>' : '') +
    '</div>';
  }).join('');

  var candoHtml = stage.canDo.map(function(item) { return '<li>' + item + '</li>'; }).join('');

  // "Następna lekcja" callout for detail view
  var nextCallout = allDone
    ? '<div class="next-lesson-callout nlc-done">✓ Wszystkie lekcje przerobione — możesz powtórzyć dowolną</div>'
    : '<div class="next-lesson-callout">' +
        '<span class="nlc-label">Następna lekcja</span>' +
        '<span class="nlc-name">' + ctaLesson.name + '</span>' +
        '<span class="nlc-summary">' + ctaLesson.summary + '</span>' +
      '</div>';

  // Compact secondary word stats (small, not dominant)
  var wordStatsHtml =
    '<div class="stage-word-stats">' +
      (stageNew     ? '<span class="sws-item sws-new">' + stageNew     + ' nowych</span>' : '') +
      (stageLearning? '<span class="sws-item sws-learning">' + stageLearning + ' w nauce</span>' : '') +
      (stageMastered? '<span class="sws-item sws-ok">✓ ' + stageMastered + ' opanowanych</span>' : '') +
    '</div>';

  document.getElementById('stage-detail').innerHTML =
    '<button class="btn-back-stage" onclick="renderStages()">← Wszystkie etapy</button>' +
    '<div class="stage-detail-head">' +
      '<span class="stage-icon">' + stage.icon + '</span>' +
      '<h2 class="stage-detail-name">' + stage.name + '</h2>' +
    '</div>' +
    '<p class="stage-detail-desc">' + stage.description + '</p>' +
    '<div class="stage-lesson-summary">' +
      '<span class="sls-count">' + totalLessons + ' lekcji</span>' +
      '<span class="sls-done">' + doneCount + '/' + totalLessons + ' przerobionych</span>' +
    '</div>' +
    '<div class="stage-prog-wrap">' +
      '<div class="stage-prog-track"><div class="stage-prog-fill" style="width:' + Math.round(doneCount / totalLessons * 100) + '%"></div></div>' +
    '</div>' +
    nextCallout +
    '<button class="btn-stage-cta" onclick="startLessonSession(\'' + stageId + '\',\'' + ctaLesson.id + '\')">' + ctaLabel + '</button>' +
    wordStatsHtml +
    '<div class="divider"><span>Lekcje</span></div>' +
    '<div class="stage-lessons">' + lessonsHtml + '</div>' +
    '<div class="divider"><span>Co umiesz po tym etapie</span></div>' +
    '<ul class="cando-list">' + candoHtml + '</ul>' +
    '<div class="stage-next-hint">' + stage.nextStageText + '</div>';

  document.getElementById('stages-list').style.display = 'none';
  document.getElementById('stage-detail').style.display = 'block';
  window.scrollTo(0, 0);
}

// ── SRS MIGRATION — hanzi keys → id keys ──────────
function migrateSrsKeysToIds() {
  // Build set of known new-format ids
  var knownIds = Object.create(null);
  WORDS.forEach(function(w) { if (w.id) knownIds[w.id] = true; });

  // Find old hanzi-based keys (anything that's not a known id)
  var oldKeys = Object.keys(srsData).filter(function(k) { return !knownIds[k]; });
  if (!oldKeys.length) return;

  // Build hanzi → [id, …] map (first id = first word with that hanzi)
  var hanziToIds = Object.create(null);
  WORDS.forEach(function(w) {
    if (!w.id || !w.hanzi) return;
    if (!hanziToIds[w.hanzi]) hanziToIds[w.hanzi] = [];
    hanziToIds[w.hanzi].push(w.id);
  });

  var migrated = 0;
  oldKeys.forEach(function(key) {
    var oldCard = srsData[key];
    delete srsData[key];
    var ids = hanziToIds[key];
    if (!ids || !ids.length) return; // hanzi not in WORDS — drop stale entry
    // Assign progress to first word with this hanzi; don't overwrite if already migrated
    if (!srsData[ids[0]]) { srsData[ids[0]] = oldCard; migrated++; }
    // Duplicate words (ids[1]…) get a fresh defaultCard — old data can't be split
  });

  DB.save('cn_srs', srsData);
  console.log('[HanziPL] SRS migration: ' + migrated + ' entries → id keys (' + oldKeys.length + ' old keys removed)');
}

// ── INIT ──────────────────────────────────────────
function init() {
  if (!Array.isArray(WORDS)) {
    console.error('WORDS is missing or not an array');
    return;
  }

  migrateSrsKeysToIds();

  WORDS.forEach(w => {
    if (!srsData[w.id]) srsData[w.id] = SRS.defaultCard();
  });

  initChips();
  renderStreakBadge();
  updateNavMastered();
  renderHomeScreen();
  updateSessionCount();
  renderAuthUI();

  if (!appConfig.onboarded) {
    const onboard = document.getElementById('onboard');
    if (onboard) onboard.style.display = 'flex';
  }

  console.log('init ok', {
    words: WORDS.length,
    pool: getPool().length,
    mode: curMode
  });
}

window.renderStages = renderStages;
window.renderStageDetail = renderStageDetail;
window.startLessonSession = startLessonSession;
window.qzNext = qzNext;
window.startCustomSession = startCustomSession;
window.startDailySession = startDailySession;
window.restartSession = restartSession;
window.backHome = backHome;
window.confirmBack = confirmBack;
window.go = go;
window.flipCard = flipCard;
window.srsAns = srsAns;
window.chkType = chkType;
window.tpNext = tpNext;
window.toggleLesson = toggleLesson;
window.toggleTopic = toggleTopic;
window.toggleLevel = toggleLevel;
window.initChips = initChips;
window.selMode = selMode;
window.filterWords = filterWords;
window.filterTopic = filterTopic;
window.filterLevel = filterLevel;
window.renderWords = renderWords;
window.setGoal = setGoal;
window.finishOnboard = finishOnboard;
window.dialogCancel = dialogCancel;
window.dialogConfirm = dialogConfirm;
init();
