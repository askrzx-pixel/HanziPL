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
var sessionMeta     = null;
var dailySessionFlow = null;
var dailySessionState = 'no_content_available';
var todayPrimaryAction = { type: 'none' };
var todaySecondaryAction = { type: 'none' };
var resultsPrimaryAction = { type: 'restart_session' };
var resultsSecondaryAction = { type: 'back_home' };

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
  const el = document.getElementById('nm');
  if (el) el.textContent = m;
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
  const flow      = createDailySessionFlow();
  const due       = flow.dueWords;
  const newWords  = flow.lessonWords;
  const total     = flow.remainingCount;
  const goal      = appConfig.dailyGoal;
  const done      = dailyLog.done;
  const remaining = flow.remainingCount;
  const plan      = buildDailyPlan(flow, done, remaining);
  dailySessionState = flow.state;
  todayPrimaryAction = plan.action;
  todaySecondaryAction = plan.secondaryAction || { type: 'none' };

  const h     = new Date().getHours();
  const greet = h < 6 ? 'Dobranoc! 🌙' : h < 12 ? 'Dzień dobry! ☀️' : h < 18 ? 'Dzień dobry! 🌤️' : 'Dobry wieczór! 🌙';
  document.getElementById('home-greeting').textContent = greet;

  document.getElementById('home-sub').textContent = plan.summary;

  document.getElementById('hc-due-v').textContent  = due.length;
  document.getElementById('hc-new-v').textContent  = newWords.length;
  document.getElementById('hc-done-v').textContent = done;
  document.getElementById('home-plan-head').textContent    = plan.headline;
  document.getElementById('home-session-counts').textContent =
    newWords.length + ' ' + pluralizeWords(newWords.length, 'nowe słowo', 'nowe słowa', 'nowych słów') +
    ' · ' + due.length + ' ' + pluralizeWords(due.length, 'powtórka', 'powtórki', 'powtórek');
  document.getElementById('home-plan-reviews').textContent = plan.reviewsLine;
  document.getElementById('home-plan-new').textContent     = plan.newLine;

  const pct = goal > 0 ? Math.min(100, Math.round(done / goal * 100)) : 0;
  document.getElementById('daily-prog-fill').style.width = pct + '%';
  document.getElementById('daily-prog-txt').textContent  = done + ' / ' + goal;

  const btn = document.getElementById('btn-start-day');
  const secondaryBtn = document.getElementById('btn-start-lesson');
  if (todayPrimaryAction.type === 'none') {
    btn.textContent = plan.cta;
    btn.classList.add('done');
    btn.disabled = true;
  } else {
    btn.textContent = plan.cta;
    btn.classList.toggle('done', dailySessionState === 'session_complete');
    btn.disabled = false;
  }

  if (todaySecondaryAction.type === 'course_lesson' && plan.secondaryCta) {
    secondaryBtn.textContent = plan.secondaryCta;
    secondaryBtn.hidden = false;
    secondaryBtn.disabled = false;
  } else {
    secondaryBtn.hidden = true;
    secondaryBtn.disabled = true;
  }

  const mastered = WORDS.filter(w => SRS.isMastered(srsData[w.id])).length;
  const courseStats = getCourseProgressStats();
  document.getElementById('hs-total').textContent    = courseStats.completedLessons;
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

function handleTodayPrimaryAction() {
  if (todayPrimaryAction.type === 'daily_session') {
    startDailySession();
    return;
  }
  if (todayPrimaryAction.type === 'course_lesson' && todayPrimaryAction.lessonKey) {
    startLessonSessionByKey(todayPrimaryAction.lessonKey);
    return;
  }
  if (todayPrimaryAction.type === 'back_home') {
    go('home', document.getElementById('bn-home'));
  }
}

function handleTodaySecondaryAction() {
  if (todaySecondaryAction.type === 'course_lesson' && todaySecondaryAction.lessonKey) {
    startLessonSessionByKey(todaySecondaryAction.lessonKey);
  }
}

function startDailySession() {
  var flow = createDailySessionFlow();
  if (!flow.phases.length) {
    dailySessionState = flow.state;
    todayPrimaryAction = flow.nextLesson ? { type: 'course_lesson', lessonKey: flow.nextLesson.key } : { type: 'none' };
    renderHomeScreen();
    showToast(flow.state === 'session_complete' ? 'Dzisiejsza sesja jest już gotowa.' : 'Brak materiału na dziś.', false, 'good');
    return;
  }

  dailySessionFlow = flow;
  dailySessionFlow.currentPhaseIndex = 0;
  dailySessionFlow.countedIds = Object.create(null);
  dailySessionFlow.totalReviews = 0;
  dailySessionFlow.totalCorrect = 0;
  dailySessionState = flow.state;

  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.botnav-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('scr-study').classList.add('on');
  var navBtn = document.getElementById('bn-study');
  if (navBtn) navBtn.classList.add('on');
  window.scrollTo(0, 0);

  isDailySession = true;
  startDailyPhase(0);
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
function beginSession(pool, mode, meta) {
  sWords = [...pool]; sIdx = 0; sOk = 0; sTotal = pool.length;
  sessionReviews = 0; sessionCorrect = 0; fcFlipped = false;
  curMode = mode;
  sessionMeta = meta || null;
  hideAll();
  if (mode === 'fc')      startFC();
  else if (mode === 'qz') startQZ();
  else                    startTP();
}

function restartSession() { beginSession(sWords.slice(0, sTotal), curMode, sessionMeta); }

function hideAll() {
  ['sh','sfc','sqz','stp','sres'].forEach(id => document.getElementById(id).style.display = 'none');
}

function backHome() {
  hideAll();
  isDailySession = false;
  dailySessionFlow = null;
  dailySessionState = 'no_content_available';
  sessionMeta = null;
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

  if (isDailySession && dailySessionFlow && sessionMeta && sessionMeta.countsToGoal) {
    ensureDailyLog();
    if (!dailySessionFlow.countedIds[hanzi]) {
      dailySessionFlow.countedIds[hanzi] = true;
      dailyLog.done++;
      if (wasNew) dailyLog.newDone++;
      saveAll();
    }
  }
}

// ── FLASHCARD ─────────────────────────────────────
function startFC() {
  document.getElementById('sfc').style.display = 'block';
  document.getElementById('fc-mode-lbl').textContent = sessionMeta && sessionMeta.modeLabel
    ? sessionMeta.modeLabel
    : isDailySession ? 'DZIENNA SESJA' : 'FISZKI';
  renderSessionStageCard();
  fcFlipped = false;
  loadFC();
}

function loadFC() {
  if (!Array.isArray(sWords) || !sWords.length) {
    handleSessionEnd();
    return;
  }

  if (sIdx >= sWords.length) {
    handleSessionEnd();
    return;
  }

  const w = sWords[sIdx];
  if (!w) {
    handleSessionEnd();
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
  const srcEl = document.getElementById('fc-source');
  const mwEl = document.getElementById('fc-mw');

  function applyContent() {
    if (hzEl) hzEl.textContent = w.hanzi || '—';
    if (pyEl) pyEl.textContent = w.pinyin || '—';
    if (trEl) trEl.textContent = w.pl || '—';
    if (bhEl) bhEl.textContent = w.hanzi || '—';
    if (srcEl) {
      var sourceLabel = getWordSourceLabel(w);
      if (sourceLabel) {
        srcEl.textContent = sourceLabel;
        srcEl.style.display = '';
      } else {
        srcEl.style.display = 'none';
      }
    }

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

function renderSessionStageCard() {
  var cardEl = document.getElementById('session-stage-card');
  if (!cardEl) return;

  if (!isDailySession || !sessionMeta) {
    cardEl.style.display = 'none';
    return;
  }

  document.getElementById('session-stage-kicker').textContent = sessionMeta.kicker || 'Teraz';
  document.getElementById('session-stage-title').textContent  = sessionMeta.title || 'Sesja';
  document.getElementById('session-stage-sub').textContent    = sessionMeta.sub || '';
  document.getElementById('session-stage-next').textContent   = sessionMeta.next || '';
  var compact = sessionMeta.kind === 'daily' && sessionMeta.phaseKey === 'lesson' && sIdx > 0;
  cardEl.classList.toggle('compact', compact);
  cardEl.style.display = 'block';
}

function handleSessionEnd() {
  if (isDailySession && dailySessionFlow) {
    handleDailySessionPhaseEnd();
    return;
  }
  showResults();
}

function handleDailySessionPhaseEnd() {
  if (!dailySessionFlow) {
    showResults();
    return;
  }

  dailySessionFlow.totalReviews += sessionReviews;
  dailySessionFlow.totalCorrect += sessionCorrect;

  var nextIndex = dailySessionFlow.currentPhaseIndex + 1;
  if (nextIndex < dailySessionFlow.phases.length) {
    dailySessionFlow.currentPhaseIndex = nextIndex;
    dailySessionState = dailySessionFlow.phases[nextIndex].state;
    showDailyTransitionScreen(dailySessionFlow.phases[nextIndex]);
    return;
  }

  dailySessionState = dailySessionFlow.reinforcementAction ? 'reinforcement_ready' : 'session_complete';
  showDailyCompletionScreen();
}

function startDailyPhase(index) {
  if (!dailySessionFlow || !dailySessionFlow.phases[index]) {
    showDailyCompletionScreen();
    return;
  }

  var phase = dailySessionFlow.phases[index];
  dailySessionFlow.currentPhaseIndex = index;
  dailySessionState = phase.state;
  beginSession(phase.words, 'fc', {
    kind: 'daily',
    phaseKey: phase.key,
    modeLabel: phase.modeLabel,
    kicker: phase.kicker,
    title: phase.title,
    sub: phase.sub,
    next: phase.next,
    countsToGoal: phase.countsToGoal
  });
}

function showDailyTransitionScreen(nextPhase) {
  var prevPhase = dailySessionFlow.phases[dailySessionFlow.currentPhaseIndex - 1] || null;
  var transitionPhase = prevPhase || nextPhase;
  hideAll();
  document.getElementById('sres').style.display = 'block';

  var banner = document.getElementById('res-daily-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = '✓ Etap ukończony';
  }

  document.getElementById('rsc').textContent = 'Krok ' + nextPhase.stepNumber + ' z ' + nextPhase.totalSteps;
  document.getElementById('rsl').textContent = transitionPhase.transitionTitle || nextPhase.transitionTitle;
  document.getElementById('res-detail').textContent = transitionPhase.transitionDetail || nextPhase.transitionDetail;

  var courseEl = document.getElementById('res-course');
  if (courseEl) {
    var courseLine = nextPhase.courseLine || transitionPhase.courseLine || '';
    if (courseLine) {
      courseEl.style.display = 'block';
      courseEl.textContent = courseLine;
    } else {
      courseEl.style.display = 'none';
      courseEl.textContent = '';
    }
  }

  var planEl = document.getElementById('res-plan');
  if (planEl) {
    planEl.style.display = 'block';
    planEl.innerHTML = buildTransitionPlanMarkup(prevPhase, nextPhase);
  }

  var nextEl = document.getElementById('res-next');
  if (nextEl) {
    nextEl.style.display = 'block';
    nextEl.textContent = nextPhase.key === 'lesson'
      ? 'Teraz: ' + nextPhase.title
      : (transitionPhase.transitionNext || nextPhase.transitionNext);
  }

  resultsPrimaryAction = { type: 'daily_next_phase', phaseIndex: dailySessionFlow.currentPhaseIndex };
  resultsSecondaryAction = { type: 'back_home' };
  updateResultsButtons(
    nextPhase.key === 'lesson'
      ? ('Rozpocznij lekcję ' + (dailySessionFlow.lessonMeta ? dailySessionFlow.lessonMeta.lessonCode : '') + ' →')
      : (transitionPhase.primaryCta || transitionPhase.transitionCta || nextPhase.primaryCta || nextPhase.transitionCta),
    '🏠 Wróć do domu'
  );
}

function showDailyCompletionScreen() {
  hideAll();
  document.getElementById('sres').style.display = 'block';

  var summary = getDailyCompletionSummary();
  var banner = document.getElementById('res-daily-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = summary.banner;
  }

  document.getElementById('rsc').textContent = summary.score;
  document.getElementById('rsl').textContent = summary.title;
  document.getElementById('res-detail').textContent = summary.detail;

  var courseEl = document.getElementById('res-course');
  if (courseEl) {
    if (summary.course) {
      courseEl.style.display = 'block';
      courseEl.textContent = summary.course;
    } else {
      courseEl.style.display = 'none';
      courseEl.textContent = '';
    }
  }

  var planEl = document.getElementById('res-plan');
  if (planEl) {
    planEl.style.display = 'none';
    planEl.innerHTML = '';
  }

  var nextEl = document.getElementById('res-next');
  if (nextEl) {
    if (summary.next) {
      nextEl.style.display = 'block';
      nextEl.textContent = summary.next;
    } else {
      nextEl.style.display = 'none';
      nextEl.textContent = '';
    }
  }

  resultsPrimaryAction = summary.primaryAction;
  resultsSecondaryAction = { type: 'back_home' };
  updateResultsButtons(summary.primaryLabel, '🏠 Wróć do domu');

  checkAndUpdateStreak();
  renderStreakBadge();
  updateNavMastered();
}

function updateResultsButtons(primaryLabel, secondaryLabel) {
  var primaryBtn = document.getElementById('res-primary-btn');
  var secondaryBtn = document.getElementById('res-secondary-btn');
  if (primaryBtn) {
    if (primaryLabel) {
      primaryBtn.style.display = 'inline-block';
      primaryBtn.textContent = primaryLabel;
    } else {
      primaryBtn.style.display = 'none';
    }
  }
  if (secondaryBtn) secondaryBtn.textContent = secondaryLabel || '🏠 Wróć do domu';
}

function handleResultsPrimaryAction() {
  if (resultsPrimaryAction.type === 'daily_next_phase') {
    startDailyPhase(resultsPrimaryAction.phaseIndex);
    return;
  }
  if (resultsPrimaryAction.type === 'course_lesson' && resultsPrimaryAction.lessonKey) {
    isDailySession = false;
    dailySessionFlow = null;
    startLessonSessionByKey(resultsPrimaryAction.lessonKey);
    return;
  }
  if (resultsPrimaryAction.type === 'restart_session') {
    restartSession();
    return;
  }
  if (resultsPrimaryAction.type === 'back_home') {
    backHome();
  }
}

function handleResultsSecondaryAction() {
  if (resultsSecondaryAction.type === 'back_home') {
    backHome();
    return;
  }
  if (resultsSecondaryAction.type === 'restart_session') {
    restartSession();
  }
}

function buildDailyPlan(flow, done, remaining) {
  var due = flow.dueWords;
  var newWords = flow.lessonWords;
  var newLesson = flow.lessonMeta;
  var nextLesson = flow.nextLesson;
  var summary = '';
  var headline = 'Dziś nie ma już nic pilnego.';
  var action = { type: 'none' };
  var secondaryAction = { type: 'none' };

  if (flow.state === 'session_complete') {
    headline = 'Dzisiejsza sesja jest już skończona.';
    summary = nextLesson ? nextLesson.shortLabel : 'Plan na dziś gotowy.';
    action = nextLesson ? { type: 'course_lesson', lessonKey: nextLesson.key } : { type: 'none' };
  } else if (flow.state === 'reviews_due') {
    headline = newWords.length > 0 && newLesson
      ? ('Lekcja ' + newLesson.shortLabel)
      : 'Dzisiejsze powtórki';
    summary = newWords.length > 0
      ? 'Najpierw powtórki, potem nowa lekcja.'
      : 'Powtórki z wcześniejszych lekcji.';
    action = { type: 'daily_session' };
    if (newWords.length > 0 && newLesson) {
      secondaryAction = { type: 'course_lesson', lessonKey: newLesson.key };
    }
  } else if (flow.state === 'lesson_ready' && newWords.length > 0) {
    headline = newLesson ? ('Lekcja ' + newLesson.shortLabel) : 'Nowe słowa';
    summary = 'Teraz nowe słowa.';
    action = { type: 'daily_session' };
  } else if (flow.state === 'no_content_available') {
    headline = nextLesson ? ('Lekcja ' + nextLesson.shortLabel) : 'Dzisiejsza sesja';
    summary = nextLesson ? 'Na dziś brak kart.' : 'Na dziś brak kart.';
    action = nextLesson ? { type: 'course_lesson', lessonKey: nextLesson.key } : { type: 'none' };
  } else {
    summary = 'Na dziś brak kart.';
  }

  var reviewsLine = due.length > 0
    ? 'Powtórki na dziś: ' + due.length
    : 'Powtórki na dziś: 0';

  var newLine = 'Nowe słowa: 0';
  if (newWords.length > 0) {
    if (newLesson) {
      newLine = newWords.length + ' ' + pluralizeWords(newWords.length, 'nowe słowo', 'nowe słowa', 'nowych słów') +
        ' z lekcji ' + newLesson.lessonCode;
    } else {
      newLine = newWords.length + ' ' + pluralizeWords(newWords.length, 'nowe słowo', 'nowe słowa', 'nowych słów');
    }
  }

  var cta = 'Powtórz słówka →';
  var secondaryCta = '';
  if (flow.state === 'session_complete') {
    cta = nextLesson ? 'Zobacz następną lekcję →' : '✓ Na dziś wszystko gotowe';
  } else if (done > 0 && remaining > 0 && flow.state !== 'reviews_due') {
    cta = 'Kontynuuj dzisiejszą sesję →';
  } else if (flow.state === 'reviews_due') {
    cta = due.length <= 12
      ? 'Powtórz ' + due.length + ' ' + pluralizeWords(due.length, 'słówko', 'słówka', 'słówek') + ' →'
      : 'Zacznij od powtórek →';
    if (newWords.length > 0 && newLesson) {
      secondaryCta = 'Kontynuuj lekcję ' + newLesson.lessonCode + ' →';
    }
  } else if (flow.state === 'lesson_ready' && newWords.length > 0 && newLesson) {
    cta = 'Przejdź do lekcji ' + newLesson.lessonCode + ' →';
  } else if (flow.state === 'lesson_ready' && newWords.length > 0) {
    cta = 'Zacznij nową lekcję →';
  } else if (flow.state === 'no_content_available') {
    cta = nextLesson ? 'Zobacz następną lekcję →' : 'Brak sesji na dziś';
  }

  return {
    summary: summary,
    headline: headline,
    reviewsLine: reviewsLine,
    newLine: newLine,
    cta: cta,
    action: action,
    secondaryCta: secondaryCta,
    secondaryAction: secondaryAction
  };
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
  var courseEl = document.getElementById('res-course');
  if (courseEl) {
    courseEl.style.display = 'none';
    courseEl.textContent = '';
  }
  var planEl = document.getElementById('res-plan');
  if (planEl) {
    planEl.style.display = 'none';
    planEl.innerHTML = '';
  }
  var nextEl = document.getElementById('res-next');
  if (nextEl) {
    nextEl.style.display = 'none';
    nextEl.textContent = '';
  }

  // Daily session completion banner
  const banner = document.getElementById('res-daily-banner');
  if (banner) banner.style.display = isDailySession ? 'block' : 'none';

  resultsPrimaryAction = { type: 'restart_session' };
  resultsSecondaryAction = { type: 'back_home' };
  updateResultsButtons('🔄 Jeszcze raz', isDailySession ? '🏠 Wróć do domu' : '🏠 Menu główne');

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

function getDailyReviewWords() {
  return WORDS.filter(function(w) {
    var c = srsData[w.id];
    return !SRS.isNew(c) && SRS.isDue(c);
  });
}

function getOrderedCourseLessons() {
  if (typeof getV3Segments !== 'function') return [];
  var lessons = [];
  getV3Segments().forEach(function(seg) {
    seg.lessons.forEach(function(lesson) {
      lessons.push(lesson);
    });
  });
  return lessons;
}

function getLessonWordsByKey(lessonKey) {
  return WORDS.filter(function(w) { return getRawWordLesson(w) === lessonKey; });
}

function getDailyLessonCandidate() {
  var lessons = getOrderedCourseLessons();
  for (var i = 0; i < lessons.length; i++) {
    var lessonWords = getLessonWordsByKey(lessons[i].key);
    var newWords = lessonWords.filter(function(w) { return SRS.isNew(srsData[w.id]); });
    if (newWords.length) return lessons[i];
  }
  return null;
}

function createDailySessionFlow() {
  ensureDailyLog();

  var dueWords = getDailyReviewWords();
  var goal = appConfig.dailyGoal || 0;
  var lessonCandidate = getDailyLessonCandidate();
  var lessonMeta = lessonCandidate ? parseSourceLessonMeta(lessonCandidate.key) : null;
  var lessonPool = lessonCandidate ? getLessonWordsByKey(lessonCandidate.key).filter(function(w) {
    return SRS.isNew(srsData[w.id]);
  }) : [];
  var lessonSlots = Math.max(0, goal - dueWords.length);
  if (!lessonSlots && lessonPool.length) lessonSlots = 1;
  var lessonWords = lessonSlots > 0 ? lessonPool.slice(0, lessonSlots) : [];
  var lessonOverflow = lessonPool.length > lessonWords.length;
  var nextLesson = getNextCourseLesson(lessonMeta ? lessonMeta.key : '');
  var goalTotal = dueWords.length + lessonWords.length;
  var phases = [];
  var totalSteps = (dueWords.length ? 1 : 0) + (lessonWords.length ? 1 : 0) + 1;

  if (dueWords.length) {
    phases.push({
      key: 'reviews',
      state: 'reviews_due',
      words: shuffle([].concat(dueWords)),
      countsToGoal: true,
      stepNumber: 1,
      totalSteps: totalSteps,
      stepLabel: '1/' + totalSteps,
      modeLabel: 'KROK 1 · POWTÓRKI',
      kicker: 'Krok 1 z ' + totalSteps,
      title: dueWords.length + ' ' + pluralizeWords(dueWords.length, 'dzisiejsza powtórka', 'dzisiejsze powtórki', 'dzisiejszych powtórek'),
      sub: 'Powtarzasz słówka z wcześniejszych lekcji. To pierwszy etap dzisiejszego planu.',
      next: lessonWords.length
        ? 'Potem: nowe słowa z lekcji ' + lessonMeta.shortLabel
        : 'Potem: krótkie podsumowanie sesji.',
      transitionTitle: lessonWords.length ? 'Powtórki ukończone' : 'Powtórki gotowe',
      transitionDetail: lessonWords.length
        ? 'Powtórki z wcześniejszych lekcji są już za Tobą. Teraz przechodzisz do nowego materiału z konkretnej lekcji w kursie.'
        : 'Nie ma dziś nowej lekcji do uruchomienia, więc po tym etapie domkniesz sesję.',
      courseLine: lessonWords.length ? 'Jesteś w kursie: ' + lessonMeta.shortLabel : '',
      transitionNext: lessonWords.length
        ? 'Za chwilę: lekcja ' + lessonMeta.shortLabel
        : 'Za chwilę: ekran zakończenia sesji.',
      transitionCta: lessonWords.length ? 'Przejdź do nowych słów →' : 'Zobacz podsumowanie →',
      primaryCta: lessonWords.length ? 'Rozpocznij lekcję ' + lessonMeta.lessonCode + ' →' : 'Zobacz podsumowanie →'
    });
  }

  if (lessonWords.length) {
    phases.push({
      key: 'lesson',
      state: 'lesson_ready',
      words: shuffle([].concat(lessonWords)),
      countsToGoal: true,
      stepNumber: dueWords.length ? 2 : 1,
      totalSteps: totalSteps,
      stepLabel: (dueWords.length ? 2 : 1) + '/' + totalSteps,
      modeLabel: 'KROK ' + (dueWords.length ? 2 : 1) + ' · NOWE SŁOWA',
      kicker: 'Krok ' + (dueWords.length ? 2 : 1) + ' z ' + totalSteps,
      title: 'Nowe słowa z lekcji ' + lessonMeta.shortLabel,
      sub: 'Poznajesz nowy materiał z jednej konkretnej lekcji. Wszystkie te słowa pochodzą z: ' + lessonMeta.shortLabel + '.',
      next: lessonOverflow
        ? 'Po sesji możesz dokończyć resztę tej lekcji.'
        : nextLesson
          ? 'Po sesji: następna lekcja ' + nextLesson.shortLabel
          : 'Po sesji: zakończenie dziennego planu.',
      transitionTitle: 'Nowa lekcja gotowa',
      transitionDetail: 'Główna część dziennego planu jest skończona. Teraz zobaczysz krótkie domknięcie i następny sensowny krok.',
      courseLine: 'Jesteś w kursie: ' + lessonMeta.shortLabel,
      transitionNext: lessonOverflow
        ? 'Możesz wrócić do tej samej lekcji lub iść dalej w kursie.'
        : nextLesson
          ? 'Następny krok w kursie: ' + nextLesson.shortLabel
          : 'Dzisiejszy plan jest kompletny.',
      transitionCta: 'Zobacz podsumowanie →'
    });
  }

  var reinforcementAction = null;
  if (lessonOverflow && lessonMeta) {
    reinforcementAction = {
      type: 'course_lesson',
      lessonKey: lessonMeta.key,
      label: 'Dokończ lekcję ' + lessonMeta.lessonCode + ' →',
      summary: 'W tej lekcji czeka jeszcze materiał poza dzisiejszym limitem.'
    };
  } else if (nextLesson) {
    reinforcementAction = {
      type: 'course_lesson',
      lessonKey: nextLesson.key,
      label: 'Zobacz następną lekcję →',
      summary: 'Następna lekcja w kursie: ' + nextLesson.shortLabel
    };
  }

  var state = 'no_content_available';
  if (phases.length) state = phases[0].state;
  else if (reinforcementAction) state = 'session_complete';

  return {
    state: state,
    dueWords: dueWords,
    lessonWords: lessonWords,
    remainingCount: dueWords.length + lessonWords.length,
    lessonMeta: lessonMeta,
    nextLesson: nextLesson,
    goalTotal: goalTotal,
    phases: phases,
    reinforcementAction: reinforcementAction
  };
}

function getDailyCompletionSummary() {
  var goalDone = dailyLog.done;
  var totalReviews = dailySessionFlow ? dailySessionFlow.totalReviews : sessionReviews;
  var totalCorrect = dailySessionFlow ? dailySessionFlow.totalCorrect : sessionCorrect;
  var pct = totalReviews ? Math.round(totalCorrect / totalReviews * 100) : 0;
  var reinforcement = dailySessionFlow && dailySessionFlow.reinforcementAction
    ? dailySessionFlow.reinforcementAction
    : null;

  return {
    banner: '✓ Dzisiejsza sesja ukończona',
    score: goalDone + '/' + (dailySessionFlow ? dailySessionFlow.goalTotal : goalDone),
    title: reinforcement ? 'Plan na dziś zamknięty' : 'Dzisiejszy plan gotowy',
    detail: 'Do dziennego celu liczą się tylko karty z planu: powtórki i nowe słowa. Dzisiejsza skuteczność: ' + pct + '%.',
    course: reinforcement && reinforcement.lessonKey ? 'Dalej w kursie: ' + (parseSourceLessonMeta(reinforcement.lessonKey) || {}).shortLabel : '',
    next: reinforcement ? reinforcement.summary : 'Możesz wrócić do domu albo zakończyć na dziś.',
    primaryAction: reinforcement || { type: 'back_home' },
    primaryLabel: reinforcement ? reinforcement.label : ''
  };
}

function buildTransitionPlanMarkup(prevPhase, nextPhase) {
  var total = nextPhase && nextPhase.totalSteps ? nextPhase.totalSteps : 3;
  var rows = [];

  if (prevPhase) {
    rows.push('<div class="res-plan-item done"><strong>Krok ' + prevPhase.stepNumber + ' z ' + total + ':</strong> ' + escapeHtml(prevPhase.title) + ' — ukończono</div>');
  }
  if (nextPhase) {
    rows.push('<div class="res-plan-item now"><strong>Krok ' + nextPhase.stepNumber + ' z ' + total + ':</strong> ' + escapeHtml(nextPhase.title) + ' — teraz</div>');
  }

  if (total >= 3) {
    var summaryStep = total;
    var summaryState = nextPhase && nextPhase.stepNumber === summaryStep ? 'teraz' : 'potem';
    rows.push('<div class="res-plan-item"><strong>Krok ' + summaryStep + ' z ' + total + ':</strong> Podsumowanie — ' + summaryState + '</div>');
  }

  return rows.join('');
}

function getCourseProgressStats() {
  if (typeof getLessonStatusByKey !== 'function') {
    return { completedLessons: 0, startedLessons: 0 };
  }
  var lessons = getOrderedCourseLessons();
  var completed = 0;
  var started = 0;
  lessons.forEach(function(lesson) {
    var status = getLessonStatusByKey(lesson.key);
    if (status === 'done') completed++;
    if (status === 'done' || status === 'in-progress') started++;
  });
  return { completedLessons: completed, startedLessons: started };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pluralizeWords(n, one, few, many) {
  var mod10 = n % 10;
  var mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

function parseSourceLessonMeta(raw) {
  var src = (raw || '').trim();
  if (!src) return null;

  var detailed = src.match(/^(\d+)\.(\d+)\s+(.+)$/);
  if (detailed) {
    return {
      key: src,
      segNum: parseInt(detailed[1], 10),
      subNum: parseInt(detailed[2], 10),
      lessonCode: detailed[1] + '.' + detailed[2],
      title: detailed[3],
      shortLabel: detailed[1] + '.' + detailed[2] + ' ' + detailed[3],
      fullLabel: 'Lekcja ' + detailed[1] + '.' + detailed[2] + ' · ' + detailed[3]
    };
  }

  var parsedNum = parseLessonNumber(src);
  if (parsedNum !== null) {
    return {
      key: src,
      segNum: parsedNum,
      subNum: null,
      lessonCode: String(parsedNum),
      title: '',
      shortLabel: String(parsedNum),
      fullLabel: 'Lekcja ' + parsedNum
    };
  }

  return {
    key: src,
    segNum: null,
    subNum: null,
    lessonCode: src,
    title: '',
    shortLabel: src,
    fullLabel: 'Źródło: ' + src
  };
}

function getWordSourceLabel(w) {
  var meta = parseSourceLessonMeta(getRawWordLesson(w));
  if (!meta) return 'Źródło: kurs HanziPL';
  return meta.fullLabel || ('Źródło: ' + meta.shortLabel);
}

function getPrimaryLessonFromWords(words) {
  if (!Array.isArray(words) || !words.length) return null;
  var counts = Object.create(null);
  var firstSeen = [];
  var order = Object.create(null);
  words.forEach(function(w) {
    var raw = getRawWordLesson(w) || 'kurs HanziPL';
    if (!counts[raw]) {
      order[raw] = firstSeen.length;
      firstSeen.push(raw);
    }
    counts[raw] = (counts[raw] || 0) + 1;
  });
  firstSeen.sort(function(a, b) {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    return order[a] - order[b];
  });
  return parseSourceLessonMeta(firstSeen[0]);
}

function getDistinctLessonCount(words) {
  if (!Array.isArray(words) || !words.length) return 0;
  var seen = Object.create(null);
  words.forEach(function(w) {
    var raw = getRawWordLesson(w) || 'kurs HanziPL';
    seen[raw] = true;
  });
  return Object.keys(seen).length;
}

function getNextCourseLesson(currentKey) {
  if (typeof getV3Segments !== 'function' || typeof getLessonStatusByKey !== 'function') return null;

  var lessons = [];
  getV3Segments().forEach(function(seg) {
    seg.lessons.forEach(function(lesson) {
      lessons.push(lesson);
    });
  });

  if (!lessons.length) return null;

  var next = null;
  for (var i = 0; i < lessons.length; i++) {
    if (getLessonStatusByKey(lessons[i].key) !== 'done') {
      next = lessons[i];
      break;
    }
  }

  if (!next) return null;
  if (!currentKey || next.key !== currentKey) return parseSourceLessonMeta(next.key);

  for (var j = 0; j < lessons.length; j++) {
    if (lessons[j].key === currentKey) {
      return lessons[j + 1] ? parseSourceLessonMeta(lessons[j + 1].key) : null;
    }
  }
  return null;
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
// Rendering driven by getV3Segments() from courseStages.js.
// Status + session helpers live in courseStages.js (getLessonStatusByKey, startLessonSessionByKey).

function renderStages() {
  document.getElementById('stages-list').style.display = 'block';
  document.getElementById('stage-detail').style.display = 'none';

  var segments = getV3Segments();

  if (!segments.length) {
    document.getElementById('stages-list').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--muted);font-family:\'Space Mono\',monospace;font-size:.75rem;">Brak danych kursu.</div>';
    return;
  }

  var html = segments.map(function(seg) {
    var lessons   = seg.lessons;
    var doneCount = lessons.filter(function(l) { return getLessonStatusByKey(l.key) === 'done'; }).length;
    var pct       = lessons.length ? Math.round(doneCount / lessons.length * 100) : 0;
    var allDone   = doneCount === lessons.length;

    var nextLesson = null;
    for (var i = 0; i < lessons.length; i++) {
      if (getLessonStatusByKey(lessons[i].key) !== 'done') { nextLesson = lessons[i]; break; }
    }

    var nextHint = allDone
      ? '<div class="sc-next sc-next-done">✓ Wszystkie lekcje przerobione</div>'
      : nextLesson
        ? '<div class="sc-next">Następna: <strong>' + nextLesson.name + '</strong></div>'
        : '';

    var preview = lessons.slice(0, 2).map(function(l) { return l.name; }).join(' · ') + (lessons.length > 2 ? ' …' : '');

    return '<div class="stage-card" data-action="open-segment" data-seg="' + seg.segNum + '">' +
      '<div class="stage-card-head">' +
        '<span class="stage-icon">' + seg.icon + '</span>' +
        '<div class="stage-card-title">' +
          '<div class="stage-name">' + seg.name + '</div>' +
          '<div class="stage-desc">' + preview + '</div>' +
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

function renderSegmentDetail(segNum) {
  var segments = getV3Segments();
  var seg = null;
  for (var i = 0; i < segments.length; i++) {
    if (segments[i].segNum === segNum) { seg = segments[i]; break; }
  }
  if (!seg) return;

  var lessons = seg.lessons;
  var lessonStatuses = lessons.map(function(lesson) {
    return { lesson: lesson, status: getLessonStatusByKey(lesson.key) };
  });
  var doneCount    = lessonStatuses.filter(function(ls) { return ls.status === 'done'; }).length;
  var totalLessons = lessons.length;

  // CTA: first non-done lesson
  var firstActive = null;
  for (var i = 0; i < lessonStatuses.length; i++) {
    if (lessonStatuses[i].status !== 'done' && lessonStatuses[i].status !== 'empty') {
      firstActive = lessonStatuses[i]; break;
    }
  }
  var allNew  = lessonStatuses.every(function(ls) { return ls.status === 'new'  || ls.status === 'empty'; });
  var allDone = lessonStatuses.every(function(ls) { return ls.status === 'done' || ls.status === 'empty'; });
  var ctaLesson = firstActive ? firstActive.lesson : lessons[0];
  var ctaLabel;
  if (allDone)     ctaLabel = '↺ Powtórz segment';
  else if (allNew) ctaLabel = '▶ Zacznij segment';
  else             ctaLabel = '▶ Kontynuuj: ' + ctaLesson.name;

  // Segment word stats
  var segWords    = WORDS.filter(function(w) {
    return lessons.some(function(l) { return l.key === w.sourceLesson; });
  });
  var segNew      = segWords.filter(function(w) { return SRS.isNew(srsData[w.id]); }).length;
  var segMastered = segWords.filter(function(w) { return SRS.isMastered(srsData[w.id]); }).length;
  var segLearning = segWords.length - segNew - segMastered;

  // Lesson cards
  var lessonsHtml = lessonStatuses.map(function(ls) {
    var lesson = ls.lesson;
    var status = ls.status;
    var lw     = WORDS.filter(function(w) { return w.sourceLesson === lesson.key; });
    var lNew   = lw.filter(function(w) { return SRS.isNew(srsData[w.id]); }).length;
    var lMast  = lw.filter(function(w) { return SRS.isMastered(srsData[w.id]); }).length;
    var lLearn = lw.length - lNew - lMast;
    var lpct   = lw.length ? Math.round(lMast / lw.length * 100) : 0;

    var badge, btnLabel;
    if (status === 'done') {
      badge    = '<span class="lesson-status ls-done">✓ Przerobiona</span>';
      btnLabel = 'Powtórz';
    } else if (status === 'in-progress') {
      badge    = '<span class="lesson-status ls-progress">W trakcie</span>';
      btnLabel = 'Kontynuuj';
    } else {
      badge    = '<span class="lesson-status ls-new">Nowa</span>';
      btnLabel = 'Zacznij';
    }

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
      '<div class="lc-footer">' +
        '<span class="lc-meta">' + metaStr + '</span>' +
        '<button class="btn-lesson" data-action="start-lesson" data-lesson-key="' + lesson.key.replace(/"/g, '&quot;') + '">' + btnLabel + '</button>' +
      '</div>' +
      (status !== 'new' ? '<div class="lc-bar"><div class="lc-fill" style="width:' + lpct + '%"></div></div>' : '') +
    '</div>';
  }).join('');

  var wordStatsHtml =
    '<div class="stage-word-stats">' +
      (segNew      ? '<span class="sws-item sws-new">'      + segNew      + ' nowych</span>'    : '') +
      (segLearning ? '<span class="sws-item sws-learning">' + segLearning + ' w nauce</span>'   : '') +
      (segMastered ? '<span class="sws-item sws-ok">✓ '    + segMastered + ' opanowanych</span>': '') +
    '</div>';

  var nextCallout = allDone
    ? '<div class="next-lesson-callout nlc-done">✓ Wszystkie lekcje przerobione — możesz powtórzyć dowolną</div>'
    : '<div class="next-lesson-callout">' +
        '<span class="nlc-label">Następna lekcja</span>' +
        '<span class="nlc-name">' + ctaLesson.name + '</span>' +
      '</div>';

  document.getElementById('stage-detail').innerHTML =
    '<button class="btn-back-stage" data-action="back-to-segments">← Wszystkie segmenty</button>' +
    '<div class="stage-detail-head">' +
      '<span class="stage-icon">' + seg.icon + '</span>' +
      '<h2 class="stage-detail-name">' + seg.name + '</h2>' +
    '</div>' +
    '<div class="stage-lesson-summary">' +
      '<span class="sls-count">' + totalLessons + ' lekcji</span>' +
      '<span class="sls-done">' + doneCount + '/' + totalLessons + ' przerobionych</span>' +
    '</div>' +
    '<div class="stage-prog-wrap">' +
      '<div class="stage-prog-track"><div class="stage-prog-fill" style="width:' +
        Math.round(doneCount / Math.max(totalLessons, 1) * 100) + '%"></div></div>' +
    '</div>' +
    nextCallout +
    '<button class="btn-stage-cta" data-action="start-lesson" data-lesson-key="' + ctaLesson.key.replace(/"/g, '&quot;') + '">' + ctaLabel + '</button>' +
    wordStatsHtml +
    '<div class="divider"><span>Lekcje</span></div>' +
    '<div class="stage-lessons">' + lessonsHtml + '</div>';

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

// ── STAGES SCREEN EVENT DELEGATION ───────────────
// Replaces inline onclick handlers to fix broken attributes caused by
// JSON.stringify producing double-quotes inside double-quoted HTML attributes
// (was breaking mobile Safari btn clicks).
document.addEventListener('DOMContentLoaded', function() {
  var scrStages = document.getElementById('scr-stages');
  if (!scrStages) return;

  scrStages.addEventListener('click', function(e) {
    // Walk up from clicked target to find the element with data-action
    var el = e.target;
    while (el && el !== scrStages) {
      var action = el.getAttribute('data-action');
      if (action) {
        if (action === 'open-segment') {
          e.stopPropagation();
          renderSegmentDetail(parseInt(el.getAttribute('data-seg'), 10));
          return;
        }
        if (action === 'start-lesson') {
          e.stopPropagation();
          startLessonSessionByKey(el.getAttribute('data-lesson-key'));
          return;
        }
        if (action === 'back-to-segments') {
          e.stopPropagation();
          renderStages();
          return;
        }
      }
      // If we hit a button with data-action inside a stage-card, stop bubbling
      // before the card's own open-segment action fires
      if (el.tagName === 'BUTTON') break;
      el = el.parentElement;
    }
  });
});

window.renderStages = renderStages;
window.renderSegmentDetail = renderSegmentDetail;
window.startLessonSessionByKey = startLessonSessionByKey;
window.qzNext = qzNext;
window.startCustomSession = startCustomSession;
window.handleTodayPrimaryAction = handleTodayPrimaryAction;
window.startDailySession = startDailySession;
window.restartSession = restartSession;
window.handleResultsPrimaryAction = handleResultsPrimaryAction;
window.handleResultsSecondaryAction = handleResultsSecondaryAction;
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
