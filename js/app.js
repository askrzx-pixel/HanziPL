// ── APP.JS ────────────────────────────────────────
// UI rendering, screen switching, session flow.
// Depends on: words.js, storage.js, srs.js

// ── Runtime state ─────────────────────────────────
var curFilter  = 'all';
var curMode    = 'fc';
var studyScope = 'today';
var studySegment = 'all';
var studyLesson = 'all';
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
var wordAudioPlayer = null;
var wordAudioAvailability = Object.create(null);
var currentWordAudioSrc = '';
var currentWordAudioRequest = 0;
var resultsSecondaryAction = { type: 'back_home' };

function isActiveContentWord(word) {
  return !word || !word.contentStatus || word.contentStatus === 'active';
}

function getActiveWords() {
  return WORDS.filter(isActiveContentWord);
}

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

  document.getElementById('home-plan-head').textContent = plan.headline;
  document.getElementById('home-session-counts').textContent =
    due.length + ' ' + pluralizeWords(due.length, 'powtórka', 'powtórki', 'powtórek') +
    (newWords.length > 0 ? ' · ' + newWords.length + ' ' + pluralizeWords(newWords.length, 'nowe słowo', 'nowe słowa', 'nowych słów') : '');

  const pct = goal > 0 ? Math.min(100, Math.round(done / goal * 100)) : 0;
  document.getElementById('daily-prog-fill').style.width = pct + '%';
  document.getElementById('daily-prog-txt').textContent  = done + ' / ' + goal + ' słów';

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
  track('daily_session_started');
  startDailyPhase(0);
}

// ── STATS ─────────────────────────────────────────
function renderStats() {
  // 1. Seria
  var streakVal = (streakData && streakData.current) || 0;
  document.getElementById('st-streak').textContent = streakVal;
  var streakLabelEl = document.getElementById('st-streak-lbl');
  if (streakLabelEl) {
    streakLabelEl.textContent = pluralizeWords(streakVal, 'dzień serii', 'dni serii', 'dni serii');
  }

  // 2. Word counts
  var total    = WORDS.length;
  var mastered = WORDS.filter(function(w) { return  SRS.isMastered(srsData[w.id]); }).length;
  var learning = WORDS.filter(function(w) { var c = srsData[w.id]; return !SRS.isNew(c) && !SRS.isMastered(c); }).length;
  var newW     = total - mastered - learning;

  document.getElementById('st-cnt-m').textContent = mastered;
  document.getElementById('st-cnt-l').textContent = learning;
  document.getElementById('st-cnt-n').textContent = newW;

  document.getElementById('st-bar-m').style.width = (total ? mastered / total * 100 : 0) + '%';
  document.getElementById('st-bar-l').style.width = (total ? learning / total * 100 : 0) + '%';
  document.getElementById('st-bar-n').style.width = (total ? newW    / total * 100 : 0) + '%';

  // 3. Skuteczność
  var totalR = 0, totalC = 0;
  WORDS.forEach(function(w) {
    var c = srsData[w.id];
    totalR += (c && c.reviews) || 0;
    totalC += (c && c.correct) || 0;
  });
  var acc = totalR > 0 ? Math.round(totalC / totalR * 100) : null;
  document.getElementById('st-acc').textContent = acc !== null ? acc + '%' : '—';
  document.getElementById('st-acc-empty').style.display = acc !== null ? 'none' : 'block';

  // 4. Postęp lekcji
  renderStatsLessons();

  // 5. Trudne słówka
  renderStatsHard();

  // 6. Action CTAs
  renderStatsActions();
}

function renderStatsLessons() {
  var container  = document.getElementById('st-lessons');
  var lessonKeys = getOrderedCourseLessons().map(function(lesson) { return lesson.key; });
  var activeWords = getActiveWords();

  var lessons = lessonKeys.map(function(ls) {
    var lw = activeWords.filter(function(w) { return getNormalizedLessonKey(w) === ls; });
    if (!lw.length) return null;
    var seen = lw.filter(function(w) { return !SRS.isNew(srsData[w.id]); }).length;
    var pct  = Math.round(seen / lw.length * 100);
    var status = typeof getLessonStatusByKey === 'function' ? getLessonStatusByKey(ls) : (
      seen === 0 ? 'new' : seen === lw.length ? 'done' : 'in-progress'
    );
    return { key: ls, pct: pct, status: status, total: lw.length, seen: seen };
  }).filter(Boolean);

  // find: last completed, current active, next unstarted
  var lastDoneIdx = -1, activeIdx = -1, nextNewIdx = -1;
  lessons.forEach(function(l, i) {
    if (l.status === 'done')   lastDoneIdx = i;
    if (l.status === 'in-progress' && activeIdx === -1) activeIdx = i;
  });
  var searchFrom = activeIdx !== -1 ? activeIdx + 1 : 0;
  for (var i = searchFrom; i < lessons.length; i++) {
    if (lessons[i].status === 'new') { nextNewIdx = i; break; }
  }

  var toShow = [];
  if (lastDoneIdx !== -1) toShow.push({ l: lessons[lastDoneIdx], hi: false });
  if (activeIdx   !== -1) toShow.push({ l: lessons[activeIdx],   hi: true  });
  if (nextNewIdx  !== -1) toShow.push({ l: lessons[nextNewIdx],  hi: false });
  if (!toShow.length && lessons.length) toShow.push({ l: lessons[0], hi: false });

  if (!toShow.length) {
    container.innerHTML = '<p class="st-empty">Zacznij naukę, żeby zobaczyć postęp lekcji.</p>';
    return;
  }

  container.innerHTML = toShow.map(function(item) {
    var l   = item.l;
    var lessonMeta = parseSourceLessonMeta(l.key);
    var lessonLabel = lessonMeta ? ('Przejdź do lekcji ' + lessonMeta.lessonCode + ' →') : ('Przejdź do ' + l.key + ' →');
    var activeLessonLabel = lessonMeta ? ('Kontynuuj lekcję ' + lessonMeta.lessonCode + ' →') : ('Kontynuuj ' + l.key + ' →');
    var lbl = l.status === 'done' ? 'Ukończona' : l.status === 'in-progress' ? 'W trakcie' : '';
    var cls = l.status === 'done' ? 'st-ls-done' : l.status === 'in-progress' ? 'st-ls-active' : 'st-ls-next';
    var escapedKey = l.key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div class="st-lrow' + (item.hi ? ' st-lrow-hi' : '') + '">' +
      '<div class="st-lrow-top">' +
        '<span class="st-lrow-name">' + l.key + '</span>' +
        '<span class="st-lchip ' + cls + '">' + lbl + '</span>' +
      '</div>' +
      '<div class="btrack"><div class="bfill" style="width:' + l.pct + '%"></div></div>' +
      '<div class="st-lrow-sub">' + l.seen + '\u202f/\u202f' + l.total + ' słów · ' + l.pct + '%</div>' +
      (l.status !== 'done'
        ? '<button class="st-next-btn" onclick="startLessonSessionByKey(\'' + l.key.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\')">' + (l.status === 'in-progress' ? activeLessonLabel : lessonLabel) + '</button>'
        : '') +
      '</div>';
  }).join('');
}

function renderStatsHard() {
  var container  = document.getElementById('st-hard');
  var candidates = getActiveWords()
    .map(function(w) { return Object.assign({}, w, { _c: srsData[w.id] || SRS.defaultCard() }); })
    .filter(function(w) { return (w._c.reviews || 0) >= 2; })
    .map(function(w) { return Object.assign({}, w, { _acc: (w._c.correct || 0) / (w._c.reviews || 1) }); })
    .sort(function(a, b) { return a._acc - b._acc; })
    .slice(0, 3);

  if (!candidates.length) {
    container.innerHTML = '<div class="st-hard-empty">✓ Brak trudnych słówek — świetna robota!</div>';
    return;
  }

  container.innerHTML = candidates.map(function(w) {
    var pct = Math.round(w._acc * 100);
    var cls = pct < 50 ? 'bad' : 'mid';
    return '<div class="weak-item">' +
      '<div><span class="weak-hz">' + w.hanzi + '</span> <span class="weak-pl">' + w.pl + '</span></div>' +
      '<div class="weak-acc ' + cls + '">' + pct + '%</div>' +
      '</div>';
  }).join('');
}

function renderStatsActions() {
  var container = document.getElementById('st-actions');
  if (!container) return;

  var candidate  = getDailyLessonCandidate();
  var hardPool   = getHardWordsPool();

  var btns = '';
  if (hardPool.length) {
    btns += '<button class="btn st-act-hard" onclick="startHardSession()">↺ Powtarzaj trudne słówka (' + hardPool.length + ')</button>';
  }
  if (candidate) {
    var lessonMeta = parseSourceLessonMeta(candidate.key);
    var lbl = lessonMeta ? ('Kontynuuj lekcję ' + lessonMeta.lessonCode) : 'Kontynuuj lekcję';
    btns += '<button class="btn-out st-act-lesson" onclick="startLessonSessionByKey(\'' + candidate.key.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\')">' + lbl + ' →</button>';
  }

  container.innerHTML = btns ? '<div class="st-act-row">' + btns + '</div>' : '';
}

function startHardSession() {
  var pool = getHardWordsPool();
  if (!pool.length) return;
  document.querySelectorAll('.scr').forEach(function(s) { s.classList.remove('on'); });
  document.querySelectorAll('.botnav-btn').forEach(function(b) { b.classList.remove('on'); });
  document.getElementById('scr-study').classList.add('on');
  var navBtn = document.getElementById('bn-study');
  if (navBtn) navBtn.classList.add('on');
  window.scrollTo(0, 0);
  hideAll();
  isDailySession   = false;
  dailySessionFlow = null;
  sessionMeta      = { modeLabel: 'TRUDNE SŁÓWKA', countsToGoal: false };
  sWords = pool; sIdx = 0; sOk = 0; sTotal = pool.length;
  track('hard_words_started', { word_count: pool.length });
  startFC();
}

// ── WORDS BROWSER ─────────────────────────────────
var curSegment2 = 'all';
var curStatus2  = 'all';
var curLesson2  = 'all';

function filterWordsSegment(segKey, btn) {
  curSegment2 = segKey;
  curLesson2 = 'all';
  syncWordSegmentSelect();
  syncWordLessonFilter();
  renderWords();
}

function filterWordsSegmentSelect(segKey) {
  filterWordsSegment(segKey);
}

function filterWordStatus(status, btn) {
  curStatus2 = status;
  document.querySelectorAll('#frow-status .chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderWords();
}

function filterWordLesson(lessonKey, btn) {
  curLesson2 = lessonKey;
  document.querySelectorAll('#frow-level .chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderWords();
}

function isHardWord(word) {
  var card = srsData[word.id] || SRS.defaultCard();
  var reviews = card.reviews || 0;
  var accuracy = (card.correct || 0) / Math.max(reviews, 1);
  return reviews >= 2 && accuracy < 0.7;
}

function getWordBrowserSegmentItems() {
  if (typeof getV3Segments !== 'function') return [{ value: 'all', label: 'Wszystkie' }];
  return [{ value: 'all', label: 'Wszystkie' }].concat(
    getV3Segments().map(function(seg) {
      return { value: String(seg.segNum), label: seg.segNum + '. ' + seg.name };
    })
  );
}

function getWordBrowserStatusItems() {
  return [
    { value: 'all', label: 'Wszystkie' },
    { value: 'new', label: 'Nowe' },
    { value: 'learning', label: 'W nauce' },
    { value: 'mastered', label: 'Opanowane' },
    { value: 'hard', label: 'Trudne' }
  ];
}

function syncWordSegmentSelect() {
  var select = document.getElementById('words-segment-select');
  if (!select) return;
  var items = getWordBrowserSegmentItems();
  select.innerHTML = items.map(function(item) {
    return '<option value="' + item.value.replace(/"/g, '&quot;') + '">' + item.label + '</option>';
  }).join('');
  select.value = curSegment2;
}

function getWordBrowserLessonItems() {
  if (curSegment2 === 'all' || typeof getV3Segments !== 'function') {
    return [{ value: 'all', label: 'Wszystkie' }];
  }
  var segments = getV3Segments();
  for (var i = 0; i < segments.length; i++) {
    if (String(segments[i].segNum) === String(curSegment2)) {
      return [{ value: 'all', label: 'Wszystkie' }].concat(
        segments[i].lessons.map(function(lesson) {
          var meta = parseSourceLessonMeta(lesson.key);
          return { value: lesson.key, label: meta.shortLabel || lesson.name };
        })
      );
    }
  }
  return [{ value: 'all', label: 'Wszystkie' }];
}

function syncWordLessonFilter() {
  var wrap = document.getElementById('words-lesson-filter');
  if (!wrap) return;
  if (curSegment2 === 'all') {
    wrap.hidden = true;
    document.getElementById('frow-level').innerHTML = '';
    return;
  }

  wrap.hidden = false;
  renderChipList('frow-level', getWordBrowserLessonItems(),
    function(v) { return curLesson2 === v; },
    filterWordLesson);
}

function renderWords() {
  const q = (document.getElementById('srch').value || '').toLowerCase();
  let f = getActiveWords();
  if (curSegment2 !== 'all') {
    f = f.filter(function(w) {
      var meta = parseSourceLessonMeta(getRawWordLesson(w));
      return meta && String(meta.segNum) === String(curSegment2);
    });
  }
  if (curLesson2 !== 'all') f = f.filter(w => getRawWordLesson(w) === curLesson2);
  if (curStatus2 === 'new') f = f.filter(w => SRS.isNew(srsData[w.id]));
  if (curStatus2 === 'learning') f = f.filter(w => {
    var c = srsData[w.id];
    return !SRS.isNew(c) && !SRS.isMastered(c);
  });
  if (curStatus2 === 'mastered') f = f.filter(w => SRS.isMastered(srsData[w.id]));
  if (curStatus2 === 'hard') f = f.filter(isHardWord);
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
    const lessonMeta = parseSourceLessonMeta(getRawWordLesson(w));
    const showSegmentBadge = curSegment2 === 'all' && lessonMeta && lessonMeta.segNum !== null;
    const metaHtml = '<div class="wcard-meta">' +
      '<span class="ls">' + (lessonMeta ? lessonMeta.lessonCode : getNormalizedLessonKey(w)) + '</span>' +
      (showSegmentBadge ? '<span class="wtopic">Segment ' + lessonMeta.segNum + '</span>' : '') +
      '</div>';
    const tagsHtml = (w.tags && w.tags.length)
      ? '<div class="wtags">' + w.tags.map(t => '<span class="wtag">' + t + '</span>').join('') + '</div>'
      : '';
    const mwBadge = w.measureWord
      ? '<span class="mw-badge" title="Klasyfikator: ' + w.measureWord.hanzi + ' (' + w.measureWord.pinyin + ')">' + w.measureWord.hanzi + '</span>'
      : '';
    return '<div class="wcard" onclick="openWordDetail(\'' + w.id.replace(/'/g, "\\'") + '\')">' +
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

// ── WORD DETAIL MODAL ─────────────────────────────
function openWordDetail(wordId) {
  var word = null;
  for (var i = 0; i < WORDS.length; i++) {
    if (WORDS[i].id === wordId) { word = WORDS[i]; break; }
  }
  if (!word) return;

  var lessonMeta = parseSourceLessonMeta(getRawWordLesson(word));
  var contextHtml = lessonMeta
    ? '<div class="wm-context"><span class="wm-lesson">' + escapeHtml(lessonMeta.fullLabel) + '</span></div>'
    : '';

  var audioSrc = getWordAudioPath(word);
  var audioHtml = audioSrc
    ? '<button class="btn wm-audio-btn" id="wm-audio-btn" disabled onclick="playWordModalAudio()">🔊 Wymowa</button>'
    : '';

  document.getElementById('word-modal-content').innerHTML =
    '<div class="wm-hz">' + escapeHtml(word.hanzi) + '</div>' +
    '<div class="wm-py">' + escapeHtml(word.pinyin) + '</div>' +
    '<div class="wm-pl">' + escapeHtml(word.pl) + '</div>' +
    contextHtml +
    audioHtml;

  document.getElementById('word-modal-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';

  if (audioSrc) {
    currentWordAudioSrc = '';
    checkWordAudioAvailability(audioSrc).then(function(available) {
      var btn = document.getElementById('wm-audio-btn');
      if (!btn) return;
      if (available) {
        currentWordAudioSrc = audioSrc;
        btn.disabled = false;
      } else {
        btn.style.display = 'none';
      }
    });
  }
}

function closeWordModal() {
  document.getElementById('word-modal-overlay').style.display = 'none';
  document.body.style.overflow = '';
  currentWordAudioSrc = '';
}

function playWordModalAudio() {
  playCurrentWordAudio();
}

// ── STUDY — MODE SELECT ───────────────────────────
function selMode(m) {
  curMode = m;
  document.querySelectorAll('.mcard').forEach(b => b.classList.remove('on'));
  document.getElementById('m-' + m).classList.add('on');
}

function getHardWordsPool() {
  return getActiveWords()
    .map(function(w) { return Object.assign({}, w, { _c: srsData[w.id] || SRS.defaultCard() }); })
    .filter(function(w) { return (w._c.reviews || 0) >= 2; })
    .map(function(w) { return Object.assign({}, w, { _acc: (w._c.correct || 0) / (w._c.reviews || 1) }); })
    .sort(function(a, b) { return a._acc - b._acc; })
    .slice(0, 10)
    .map(function(w) { var r = Object.assign({}, w); delete r._c; delete r._acc; return r; });
}

function getStudyScopeItems() {
  return [
    { value: 'today', label: 'Dzisiejszy materiał' },
    { value: 'current_lesson', label: 'Aktualna lekcja' },
    { value: 'hard', label: 'Trudne słówka' },
    { value: 'segment', label: 'Wybrany segment' },
    { value: 'lesson', label: 'Wybrana lekcja' }
  ];
}

function getStudySegmentItems() {
  if (typeof getV3Segments !== 'function') return [];
  return getV3Segments().map(function(seg) {
    return { value: String(seg.segNum), label: 'Segment ' + seg.segNum };
  });
}

function getStudyLessonItemsForSegment(segValue) {
  if (!segValue || segValue === 'all' || typeof getV3Segments !== 'function') return [];
  var segments = getV3Segments();
  for (var i = 0; i < segments.length; i++) {
    if (String(segments[i].segNum) === String(segValue)) {
      return segments[i].lessons.map(function(lesson) {
        var meta = parseSourceLessonMeta(lesson.key);
        return { value: lesson.key, label: meta.shortLabel || lesson.name };
      });
    }
  }
  return [];
}

function getCurrentStudyLessonMeta() {
  var candidate = getDailyLessonCandidate();
  if (candidate) return parseSourceLessonMeta(candidate.key);
  return getNextCourseLesson('');
}

function getStudyPool() {
  if (studyScope === 'today') {
    var flow = createDailySessionFlow();
    var words = [];
    (flow.phases || []).forEach(function(phase) {
      if (Array.isArray(phase.words) && phase.words.length) words = words.concat(phase.words);
    });
    return getUniqueWords(words);
  }
  if (studyScope === 'current_lesson') {
    var currentLesson = getCurrentStudyLessonMeta();
    return currentLesson ? getLessonWordsByKey(currentLesson.key) : [];
  }
  if (studyScope === 'hard') {
    return getHardWordsPool();
  }
  if (studyScope === 'segment') {
    if (studySegment === 'all' || typeof getV3Segments !== 'function') return [];
    return getActiveWords().filter(function(w) {
      var meta = parseSourceLessonMeta(getRawWordLesson(w));
      return meta && String(meta.segNum) === String(studySegment);
    });
  }
  if (studyScope === 'lesson') {
    return studyLesson !== 'all' ? getLessonWordsByKey(studyLesson) : [];
  }
  return [];
}

function syncStudyScopeUi() {
  var segWrap = document.getElementById('study-segment-wrap');
  var lessonWrap = document.getElementById('study-lesson-wrap');
  var segmentNeeded = studyScope === 'segment' || studyScope === 'lesson';
  var lessonNeeded = studyScope === 'lesson';
  if (segWrap) segWrap.hidden = !segmentNeeded;
  if (lessonWrap) lessonWrap.hidden = !lessonNeeded;

  if (segmentNeeded) {
    var segmentItems = getStudySegmentItems();
    if (!segmentItems.some(function(item) { return item.value === studySegment; })) {
      studySegment = segmentItems.length ? segmentItems[0].value : 'all';
    }
    renderChipList('study-segment', segmentItems,
      function(v) { return studySegment === v; },
      filterStudySegment);
  } else {
    studySegment = 'all';
    var segmentEl = document.getElementById('study-segment');
    if (segmentEl) segmentEl.innerHTML = '';
  }

  if (lessonNeeded && studySegment !== 'all') {
    var lessonItems = getStudyLessonItemsForSegment(studySegment);
    if (!lessonItems.some(function(item) { return item.value === studyLesson; })) {
      studyLesson = lessonItems.length ? lessonItems[0].value : 'all';
    }
    renderChipList('study-lesson', lessonItems,
      function(v) { return studyLesson === v; },
      filterStudyLesson);
  } else {
    studyLesson = 'all';
    var lessonEl = document.getElementById('study-lesson');
    if (lessonEl) lessonEl.innerHTML = '';
  }
}

function filterStudyScope(scope, btn) {
  studyScope = scope;
  document.querySelectorAll('#study-scope .chip').forEach(function(b) { b.classList.remove('on'); });
  btn.classList.add('on');
  syncStudyScopeUi();
  updateSessionCount();
}

function filterStudySegment(seg, btn) {
  studySegment = seg;
  document.querySelectorAll('#study-segment .chip').forEach(function(b) { b.classList.remove('on'); });
  btn.classList.add('on');
  if (studyScope === 'lesson') studyLesson = 'all';
  syncStudyScopeUi();
  updateSessionCount();
}

function filterStudyLesson(lessonKey, btn) {
  studyLesson = lessonKey;
  document.querySelectorAll('#study-lesson .chip').forEach(function(b) { b.classList.remove('on'); });
  btn.classList.add('on');
  updateSessionCount();
}

function updateSessionCount() {
  const scntEl = document.getElementById('scnt');
  if (!scntEl) return;
  const pool = getStudyPool();
  var label = 'dzisiejszym materiale';
  if (studyScope === 'current_lesson') {
    var currentLesson = getCurrentStudyLessonMeta();
    label = currentLesson ? ('lekcji ' + currentLesson.lessonCode) : 'aktualnej lekcji';
  } else if (studyScope === 'hard') {
    label = 'trudnych słówkach';
  } else if (studyScope === 'segment' && studySegment !== 'all') {
    label = 'segmencie ' + studySegment;
  } else if (studyScope === 'lesson' && studyLesson !== 'all') {
    var lessonMeta = parseSourceLessonMeta(studyLesson);
    label = lessonMeta ? ('lekcji ' + lessonMeta.lessonCode) : 'wybranej lekcji';
  }
  scntEl.textContent = pool.length + ' słówek w ' + label;
}

function startCustomSession() {
  const basePool = getStudyPool();
  const pool = orderWordsForSession(basePool);

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
  currentWordAudioSrc = '';
  if (wordAudioPlayer) wordAudioPlayer.pause();
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
function getWordAudioPath(word) {
  if (!word || !word.id) return '';
  return 'audio/words/' + encodeURIComponent(word.id) + '.mp3';
}

async function checkWordAudioAvailability(src) {
  if (!src) return false;
  if (typeof wordAudioAvailability[src] === 'boolean') return wordAudioAvailability[src];
  try {
    var response = await fetch(src, { method: 'HEAD', cache: 'force-cache' });
    wordAudioAvailability[src] = response.ok;
    return response.ok;
  } catch (_) {
    wordAudioAvailability[src] = false;
    return false;
  }
}

function hideWordAudioButton() {
  ['fc-audio-btn', 'tp-audio-btn'].forEach(function(id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.hidden = true;
    btn.disabled = true;
  });
}

async function syncCurrentWordAudio(word) {
  var requestId = ++currentWordAudioRequest;

  hideWordAudioButton();
  currentWordAudioSrc = '';
  if (wordAudioPlayer) {
    wordAudioPlayer.pause();
    wordAudioPlayer.currentTime = 0;
  }

  var src = getWordAudioPath(word);
  if (!src) return;

  var available = await checkWordAudioAvailability(src);
  if (requestId !== currentWordAudioRequest) return;
  if (!available) return;

  currentWordAudioSrc = src;
  ['fc-audio-btn', 'tp-audio-btn'].forEach(function(id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.hidden = false;
    btn.disabled = false;
  });
}

async function playCurrentWordAudio() {
  if (!currentWordAudioSrc) return;
  if (!wordAudioPlayer) {
    wordAudioPlayer = new Audio();
  }

  try {
    wordAudioPlayer.pause();
    if (wordAudioPlayer.src !== new URL(currentWordAudioSrc, window.location.href).href) {
      wordAudioPlayer.src = currentWordAudioSrc;
    }
    wordAudioPlayer.currentTime = 0;
    await wordAudioPlayer.play();
    track('audio_played');
  } catch (_) {
    hideWordAudioButton();
    currentWordAudioSrc = '';
  }
}

function startFC() {
  track('flashcards_started');
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
  renderSessionStageCard();

  const fcEl = document.getElementById('fc');
  if (!fcEl) return;

  const hzEl = document.getElementById('fc-hz');
  const pyEl = document.getElementById('fc-py');
  const trEl = document.getElementById('fc-tr');
  const bhEl = document.getElementById('fc-bh');
  const srcEl = document.getElementById('fc-source');
  const mwEl = document.getElementById('fc-mw');
  const contextEl = document.getElementById('fc-context');

  syncCurrentWordAudio(w).catch(function() { hideWordAudioButton(); });

  function applyContent() {
    if (hzEl) hzEl.textContent = w.hanzi || '—';
    if (pyEl) pyEl.textContent = w.pinyin || '—';
    if (trEl) trEl.textContent = w.pl || '—';
    if (bhEl) bhEl.textContent = w.hanzi || '—';
    if (srcEl) {
      srcEl.style.display = 'none';
      srcEl.textContent = '';
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

    if (contextEl) {
      var lessonContext = getWordFrontContextLabel(w);
      if (lessonContext) {
        contextEl.textContent = lessonContext;
        contextEl.style.display = '';
      } else {
        contextEl.style.display = 'none';
        contextEl.textContent = '';
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
  var isLessonPhase = sessionMeta && sessionMeta.phaseKey === 'lesson';
  var copyEl = document.getElementById('srs-copy');
  if (copyEl) {
    copyEl.textContent = isLessonPhase
      ? 'Zapamiętaj to słowo. Wrócimy do niego wkrótce.'
      : 'Wybierz, jak dobrze znasz to słowo.';
  }
  setTimeout(() => document.getElementById('srs-btns').style.display = 'block', 340);
}

function renderSessionStageCard() {
  var cardEl = document.getElementById('session-stage-card');
  if (!cardEl) return;

  if (!isDailySession || !sessionMeta) {
    cardEl.style.display = 'none';
    return;
  }

  var title = sessionMeta.title || 'Sesja';
  var sub = sessionMeta.sub || '';
  if (sessionMeta.phaseKey === 'lesson') {
    title = 'Nowe słowa';
    sub = '';
  }

  document.getElementById('session-stage-kicker').textContent = sessionMeta.kicker || 'Teraz';
  document.getElementById('session-stage-title').textContent  = title;
  document.getElementById('session-stage-sub').textContent    = sub;
  document.getElementById('session-stage-next').textContent   = sessionMeta.next || '';
  var compact = sIdx > 0;
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
    var bannerText = prevPhase
      ? (prevPhase.key === 'reviews' ? '✓ Powtórki ukończone' : '✓ Lekcja ukończona')
      : '✓ Etap ukończony';
    banner.textContent = bannerText;
  }

  var rscEl = document.getElementById('rsc');
  if (rscEl) {
    rscEl.textContent = 'Krok ' + nextPhase.stepNumber + ' z ' + nextPhase.totalSteps;
    rscEl.classList.remove('resc-score');
    rscEl.classList.add('resc-step');
  }
  document.getElementById('rsl').textContent = transitionPhase.transitionTitle || nextPhase.transitionTitle;

  var detailEl = document.getElementById('res-detail');
  if (detailEl) {
    var transitionHint = (nextPhase.key === 'lesson' && dailySessionFlow.lessonMeta)
      ? 'Teraz: nowe słowa z lekcji ' + dailySessionFlow.lessonMeta.lessonCode
      : '';
    detailEl.style.display = transitionHint ? '' : 'none';
    detailEl.textContent = transitionHint;
  }

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
  if (nextEl) { nextEl.style.display = 'none'; nextEl.textContent = ''; }

  renderCompletionExtras(null);

  resultsPrimaryAction = { type: 'daily_next_phase', phaseIndex: dailySessionFlow.currentPhaseIndex };
  resultsSecondaryAction = { type: 'back_home' };
  updateResultsButtons(
    nextPhase.key === 'lesson'
      ? ('Rozpocznij lekcję ' + (dailySessionFlow.lessonMeta ? dailySessionFlow.lessonMeta.lessonCode : '') + ' →')
      : (transitionPhase.primaryCta || transitionPhase.transitionCta || nextPhase.primaryCta || nextPhase.transitionCta),
    'Wróć do dziś'
  );
}

// ── RESULTS EXTRAS ─────────────────────────────────────────────────────────
function _firstMeaning(pl) {
  if (!pl) return '';
  return pl.split(/[;,]/)[0].trim();
}

function buildContextPhrases(words) {
  var phrases = [];
  var pronoun = null, verb = null, noun = null;
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (!w.tags) continue;
    if (!pronoun && w.tags.indexOf('zaimek') !== -1 && w.tags.indexOf('osoba') !== -1) pronoun = w;
    if (!verb   && w.tags.indexOf('czasownik') !== -1) verb = w;
    if (!noun   && w.tags.indexOf('rzeczownik') !== -1) noun = w;
  }
  // Template A: pronoun + verb
  if (pronoun && verb) {
    phrases.push({
      hz: pronoun.hanzi + verb.hanzi + '。',
      py: pronoun.pinyin + ' ' + verb.pinyin + '。',
      pl: _firstMeaning(pronoun.pl) + ' ' + _firstMeaning(verb.pl) + '。'
    });
  }
  // Template B: 这是 + noun
  if (noun) {
    phrases.push({
      hz: '这是' + noun.hanzi + '。',
      py: 'Zhè shì ' + noun.pinyin + '。',
      pl: 'To jest ' + _firstMeaning(noun.pl) + '。'
    });
  }
  // Fallback: single-word exclamation from first word
  if (phrases.length === 0 && words.length > 0) {
    var fw = words[0];
    phrases.push({
      hz: fw.hanzi + '！',
      py: fw.pinyin + '！',
      pl: _firstMeaning(fw.pl) + '！'
    });
  }
  return phrases.slice(0, 2);
}

function renderResExtras(reviewWords, contextWords) {
  // Word review block
  var revEl = document.getElementById('res-word-review');
  if (revEl) {
    var sample = reviewWords.slice(0, 5);
    if (sample.length > 0) {
      var rows = sample.map(function(w) {
        return '<div class="res-review-row">' +
          '<span class="res-review-hz">' + w.hanzi + '</span>' +
          '<span class="res-review-py">' + w.pinyin + '</span>' +
          '<span class="res-review-pl">' + _firstMeaning(w.pl) + '</span>' +
          '</div>';
      }).join('');
      revEl.innerHTML = '<div class="res-review-head">Słówka z tej lekcji</div>' + rows;
      revEl.style.display = 'block';
    } else {
      revEl.style.display = 'none';
    }
  }
  // Context phrases block
  var ctxEl = document.getElementById('res-context');
  if (ctxEl) {
    var phrases = buildContextPhrases(contextWords);
    if (phrases.length > 0) {
      var ctxRows = phrases.map(function(p) {
        return '<div class="res-ctx-row">' +
          '<div class="res-ctx-hz">' + p.hz + '</div>' +
          '<div class="res-ctx-py">' + p.py + '</div>' +
          '<div class="res-ctx-pl">' + p.pl + '</div>' +
          '</div>';
      }).join('');
      ctxEl.innerHTML = '<div class="res-ctx-head">Przykłady użycia</div>' + ctxRows;
      ctxEl.style.display = 'block';
    } else {
      ctxEl.style.display = 'none';
    }
  }
}

function _hideResExtras() {
  var r = document.getElementById('res-word-review');
  var c = document.getElementById('res-context');
  if (r) { r.style.display = 'none'; r.innerHTML = ''; }
  if (c) { c.style.display = 'none'; c.innerHTML = ''; }
}
// ───────────────────────────────────────────────────────────────────────────

function showDailyCompletionScreen() {
  hideAll();
  document.getElementById('sres').style.display = 'block';

  var summary = getDailyCompletionSummary();
  var banner = document.getElementById('res-daily-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = summary.banner;
  }

  var rscEl2 = document.getElementById('rsc');
  if (rscEl2) {
    rscEl2.textContent = summary.score;
    rscEl2.classList.remove('resc-step');
    rscEl2.classList.add('resc-score');
  }
  document.getElementById('rsl').textContent = summary.title;
  var detailEl2 = document.getElementById('res-detail');
  if (detailEl2) {
    detailEl2.style.display = summary.detail ? '' : 'none';
    detailEl2.textContent = summary.detail || '';
  }

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
  if (nextEl) { nextEl.style.display = 'none'; nextEl.textContent = ''; }

  renderCompletionExtras(buildCompletionExtras({
    mode: 'daily',
    lessonMeta: dailySessionFlow ? dailySessionFlow.lessonMeta : null,
    lessonWords: dailySessionFlow ? dailySessionFlow.lessonWords : null
  }));

  resultsPrimaryAction = summary.primaryAction;
  resultsSecondaryAction = { type: 'back_home' };
  updateResultsButtons(summary.primaryLabel, 'Wróć do dziś');

  var lessonWords = [];
  if (dailySessionFlow && dailySessionFlow.lessonMeta && dailySessionFlow.lessonMeta.key) {
    lessonWords = getLessonWordsByKey(dailySessionFlow.lessonMeta.key);
  }
  if (!lessonWords.length) lessonWords = sWords.slice();
  renderResExtras(lessonWords.slice(0, 5), lessonWords);

  checkAndUpdateStreak();
  renderStreakBadge();
  updateNavMastered();
}

function updateResultsButtons(primaryLabel, secondaryLabel) {
  var primaryBtn = document.getElementById('res-primary-btn');
  var secondaryBtn = document.getElementById('res-secondary-btn');
  if (primaryBtn) {
    if (primaryLabel) {
      primaryBtn.style.display = '';
      primaryBtn.textContent = primaryLabel;
    } else {
      primaryBtn.style.display = 'none';
    }
  }
  if (secondaryBtn) secondaryBtn.textContent = secondaryLabel || 'Wróć do dziś';
}

function renderCompletionExtras(data) {
  var reviewEl = document.getElementById('res-review');
  var contextEl = document.getElementById('res-context');

  if (reviewEl) {
    if (data && data.reviewWords && data.reviewWords.length) {
      var reviewTitle = data.reviewTitle || 'Szybkie przypomnienie';
      reviewEl.style.display = 'block';
      reviewEl.innerHTML =
        '<div class="res-extra-title">' + escapeHtml(reviewTitle) + '</div>' +
        '<div class="res-review-list">' +
          data.reviewWords.map(function(word) {
            return '<div class="res-review-item">' +
              '<div class="res-review-top">' +
                '<span class="res-review-hz">' + escapeHtml(word.hanzi || '—') + '</span>' +
                '<span class="res-review-py">' + escapeHtml(word.pinyin || '') + '</span>' +
              '</div>' +
              '<div class="res-review-pl">' + escapeHtml(word.pl || '—') + '</div>' +
            '</div>';
          }).join('') +
        '</div>';
    } else {
      reviewEl.style.display = 'none';
      reviewEl.innerHTML = '';
    }
  }

  if (contextEl) {
    contextEl.style.display = 'none';
    contextEl.innerHTML = '';
  }
}

function getSessionBaseWords() {
  var limit = Math.min(sTotal || 0, Array.isArray(sWords) ? sWords.length : 0);
  return (Array.isArray(sWords) ? sWords.slice(0, limit) : []).filter(Boolean);
}

function getUniqueWords(words, limit) {
  var seen = Object.create(null);
  var out = [];
  (words || []).forEach(function(word) {
    if (!word || !word.id || seen[word.id]) return;
    seen[word.id] = true;
    out.push(word);
  });
  return typeof limit === 'number' ? out.slice(0, limit) : out;
}

function getShortPolishLabel(text) {
  var label = String(text || '').split(/[;,]/)[0].trim();
  return label || 'to słowo z tej lekcji';
}

function getCompletionUsageLabel(word) {
  var hanzi = word && word.hanzi;
  var tags = Array.isArray(word && word.tags) ? word.tags : [];
  if (hanzi === '对不起') return 'Używamy, gdy chcemy przeprosić.';
  if (hanzi === '没关系') return 'Używamy, gdy odpowiadamy, że nic się nie stało.';
  if (hanzi === '谢谢') return 'Używamy, gdy chcemy komuś podziękować.';
  if (hanzi === '不客气') return 'Mówimy tak, gdy odpowiadamy na podziękowanie.';
  if (hanzi === '请') return 'Używamy, gdy prosimy albo uprzejmie zapraszamy.';
  if (hanzi === '不好意思') return 'Używamy, gdy chcemy kogoś grzecznie zaczepić albo lekko przeprosić.';
  if (hanzi === '我') return 'Używamy, gdy mówimy o sobie.';
  if (hanzi === '你') return 'Używamy, gdy zwracamy się do jednej osoby.';
  if (hanzi === '叫') return 'Używamy, gdy mówimy, jak mamy na imię.';
  if (hanzi === '名字') return 'Używamy, gdy mówimy o imieniu albo pytamy o imię.';
  if (hanzi === '什么') return 'Używamy, gdy pytamy „co?” albo „jakie?”.';
  if (hanzi === '是') return 'Używamy, gdy mówimy, że coś lub ktoś jest czymś.';
  if (hanzi === '快乐') return 'Używamy, gdy mówimy o radości albo szczęściu.';
  if (hanzi === '生日快乐') return 'Mówimy tak, gdy składamy komuś życzenia urodzinowe.';
  if (hanzi === '新年') return 'Używamy, gdy mówimy o Nowym Roku.';
  if (hanzi === '新年快乐') return 'Mówimy tak, gdy składamy komuś życzenia noworoczne.';
  if (hanzi === '祝') return 'Używamy, gdy składamy komuś życzenia.';
  if (hanzi === '你好' || hanzi === '您好' || tags.indexOf('powitanie') !== -1) return 'Używamy, gdy się z kimś witamy.';
  if (tags.indexOf('pożegnanie') !== -1) return 'Używamy, gdy się z kimś żegnamy.';
  if (tags.indexOf('pytanie') !== -1 || tags.indexOf('zaimek pytający') !== -1) return 'Używamy, gdy zadajemy proste pytanie.';
  if (tags.indexOf('grzeczność') !== -1) return 'Używamy w uprzejmej odpowiedzi albo prośbie.';
  if (tags.indexOf('czasownik') !== -1) return 'Używamy, gdy mówimy o prostej czynności.';
  if (tags.indexOf('osoba') !== -1 || tags.indexOf('imię') !== -1) return 'Używamy, gdy mówimy o sobie albo o innych osobach.';
  return 'Używamy, gdy chcemy powiedzieć: ' + getShortPolishLabel(word && word.pl) + '.';
}

function buildCompletionContextItems(words) {
  return getUniqueWords(words, 2).map(function(word) {
    return {
      hanzi: word.hanzi,
      pinyin: word.pinyin,
      pl: word.pl,
      note: getCompletionUsageLabel(word)
    };
  });
}

function buildCompletionExtras(options) {
  var mode = options && options.mode ? options.mode : 'session';
  var sessionWords = getUniqueWords(getSessionBaseWords());
  var reviewWords = [];
  var reviewTitle = '';
  var contextTitle = 'Jak używamy tych słów';
  var lessonMeta = options && options.lessonMeta ? options.lessonMeta : null;
  var hasLessonReview = mode === 'daily' && options && Array.isArray(options.lessonWords) && options.lessonWords.length;

  if (hasLessonReview) {
    reviewWords = getUniqueWords(options.lessonWords, 5);
  } else if (sessionWords.length && getDistinctLessonCount(sessionWords) <= 1) {
    lessonMeta = lessonMeta || getPrimaryLessonFromWords(sessionWords);
    reviewWords = lessonMeta
      ? getUniqueWords(getLessonWordsByKey(lessonMeta.key), 5)
      : getUniqueWords(sessionWords, 5);
  } else if (mode === 'daily' && sessionWords.length) {
    reviewWords = getUniqueWords(sessionWords, 5);
  }

  if (!lessonMeta && reviewWords.length && getDistinctLessonCount(reviewWords) <= 1) {
    lessonMeta = getPrimaryLessonFromWords(reviewWords);
  }

  if (reviewWords.length) {
    reviewTitle = lessonMeta && lessonMeta.lessonCode && (hasLessonReview || mode !== 'daily')
      ? 'Szybkie przypomnienie · lekcja ' + lessonMeta.lessonCode
      : 'Szybkie przypomnienie';
  }

  if (mode === 'daily' && !hasLessonReview) {
    contextTitle = 'Jak używamy tych słów';
  } else if (lessonMeta && lessonMeta.lessonCode) {
    contextTitle = 'Jak używamy tych słów';
  }

  var contextSource = reviewWords.length ? reviewWords : sessionWords;
  var contextItems = buildCompletionContextItems(contextSource);

  if (!reviewWords.length && !contextItems.length) return null;

  return {
    reviewTitle: reviewTitle,
    reviewWords: reviewWords,
    contextTitle: contextTitle,
    contextItems: contextItems
  };
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

// "Kolejne" button handler — uses Good (2) for first-encounter lesson phase
// so new words are scheduled for the next day, not 4 days ahead.
// For review phases uses Easy (3) as before.
function nextWordAns() {
  var rating = (sessionMeta && sessionMeta.phaseKey === 'lesson') ? 2 : 3;
  srsAns(rating);
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

  const activeWords = getActiveWords();
  const sameLsn = activeWords.filter(x => x.pl !== w.pl && getNormalizedLessonKey(x) === getNormalizedLessonKey(w));
  const other = activeWords.filter(x => x.pl !== w.pl && getNormalizedLessonKey(x) !== getNormalizedLessonKey(w));
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
  syncCurrentWordAudio(w).catch(function() { hideWordAudioButton(); });
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
  var rscElStd = document.getElementById('rsc');
  if (rscElStd) {
    rscElStd.textContent = t + ' ' + pluralizeWords(t, 'słówko', 'słówka', 'słówek');
    rscElStd.classList.remove('resc-step');
    rscElStd.classList.add('resc-score');
  }
  document.getElementById('rsl').textContent = 'Sesja ukończona';
  var detailElStd = document.getElementById('res-detail');
  if (detailElStd) {
    detailElStd.style.display = '';
    detailElStd.textContent = 'Przerobiono ' + t + ' ' + pluralizeWords(t, 'słówko', 'słówka', 'słówek') + '.';
  }
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

  renderCompletionExtras(buildCompletionExtras({ mode: isDailySession ? 'daily' : 'session' }));

  // Daily session completion banner
  const banner = document.getElementById('res-daily-banner');
  if (banner) banner.style.display = isDailySession ? 'block' : 'none';

  resultsPrimaryAction = { type: 'restart_session' };
  resultsSecondaryAction = { type: 'back_home' };
  updateResultsButtons('Powtórz sesję →', 'Wróć do dziś');

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

function getNumericWordOrderValue(word) {
  if (!word) return Number.MAX_SAFE_INTEGER;
  var hanzi = (word.hanzi || '').trim();
  var directMap = {
    '零': 0,
    '一': 1,
    '二': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9,
    '十': 10
  };
  if (Object.prototype.hasOwnProperty.call(directMap, hanzi)) return directMap[hanzi];

  var parsed = chineseNumToInt(hanzi);
  if (!isNaN(parsed) && parsed !== 99) return parsed;

  var idNum = parseInt(String(word.id || '').replace(/^\D+/, ''), 10);
  return isNaN(idNum) ? Number.MAX_SAFE_INTEGER : 1000 + idNum;
}

function orderWordsForSession(words) {
  var list = [].concat(words || []);
  if (!list.length) return list;

  var allNumeric = list.every(function(word) {
    return word && word.topic === 'liczby_i_ilosci';
  });
  if (!allNumeric) return shuffle(list);

  return list.sort(function(a, b) {
    return getNumericWordOrderValue(a) - getNumericWordOrderValue(b);
  });
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
  return getActiveWords().filter(function(w) {
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
  return getActiveWords().filter(function(w) { return getRawWordLesson(w) === lessonKey; });
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
  if (lessonPool.length && lessonPool.every(function(word) { return word && word.topic === 'liczby_i_ilosci'; })) {
    lessonPool = orderWordsForSession(lessonPool);
  }
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
      sub: 'Powtórki z wcześniejszych lekcji.',
      next: lessonWords.length
        ? 'Potem: nowe słowa z lekcji ' + lessonMeta.shortLabel
        : 'Potem: krótkie podsumowanie sesji.',
      transitionTitle: lessonWords.length ? 'Czas na nowe słowa' : 'Powtórki gotowe',
      transitionDetail: '',
      courseLine: lessonWords.length ? lessonMeta.fullLabel : '',
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
      words: orderWordsForSession(lessonWords),
      countsToGoal: true,
      stepNumber: dueWords.length ? 2 : 1,
      totalSteps: totalSteps,
      stepLabel: (dueWords.length ? 2 : 1) + '/' + totalSteps,
      modeLabel: 'KROK ' + (dueWords.length ? 2 : 1) + ' · NOWE SŁOWA',
      kicker: 'Krok ' + (dueWords.length ? 2 : 1) + ' z ' + totalSteps,
      title: 'Nowe słowa z lekcji ' + lessonMeta.shortLabel,
      sub: 'Słówka z lekcji ' + lessonMeta.lessonCode + '.',
      next: lessonOverflow
        ? 'Po sesji możesz dokończyć resztę tej lekcji.'
        : nextLesson
          ? 'Po sesji: następna lekcja ' + nextLesson.shortLabel
          : 'Po sesji: zakończenie dziennego planu.',
      transitionTitle: 'Lekcja ukończona',
      transitionDetail: 'Główna część dziennego planu jest skończona. Teraz zobaczysz krótkie domknięcie i następny sensowny krok.',
      courseLine: lessonMeta.fullLabel,
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
  var reinforcement = dailySessionFlow && dailySessionFlow.reinforcementAction
    ? dailySessionFlow.reinforcementAction
    : null;

  return {
    banner: '✓ Dzisiejsza sesja ukończona',
    score: goalDone + '/' + (dailySessionFlow ? dailySessionFlow.goalTotal : goalDone),
    title: reinforcement ? 'Plan na dziś zamknięty' : 'Dzisiejszy plan gotowy',
    detail: goalDone + ' ' + pluralizeWords(goalDone, 'słówko przerobione', 'słówka przerobione', 'słówek przerobionych'),
    course: reinforcement && reinforcement.lessonKey ? (parseSourceLessonMeta(reinforcement.lessonKey) || {}).fullLabel || '' : '',
    next: reinforcement ? reinforcement.summary : 'Możesz wrócić do domu albo zakończyć na dziś.',
    primaryAction: reinforcement || { type: 'back_home' },
    primaryLabel: reinforcement ? reinforcement.label : ''
  };
}

function buildTransitionPlanMarkup(prevPhase, nextPhase) {
  var total = nextPhase && nextPhase.totalSteps ? nextPhase.totalSteps : 3;
  var rows = [];

  if (prevPhase) {
    rows.push('<div class="res-plan-item done">✓ Krok ' + prevPhase.stepNumber + ': ' + escapeHtml(prevPhase.title) + '</div>');
  }
  if (nextPhase) {
    rows.push('<div class="res-plan-item now">→ Krok ' + nextPhase.stepNumber + ': ' + escapeHtml(nextPhase.title) + '</div>');
  }

  if (total >= 3) {
    var summaryStep = total;
    var summaryState = nextPhase && nextPhase.stepNumber === summaryStep ? 'teraz' : 'potem';
    rows.push('<div class="res-plan-item">· Krok ' + summaryStep + ': Podsumowanie' + (summaryState === 'teraz' ? ' — teraz' : '') + '</div>');
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
  if (!meta) return 'Źródło: kurs HanziGo';
  if (meta.lessonCode && meta.title) return 'Lekcja ' + meta.lessonCode + ' · ' + meta.title;
  return meta.fullLabel || ('Źródło: ' + meta.shortLabel);
}

function getWordFrontContextLabel(w) {
  var meta = parseSourceLessonMeta(getRawWordLesson(w));
  if (!meta) return '';
  if (meta.lessonCode) return 'Lekcja ' + meta.lessonCode;
  if (meta.segNum !== null) return 'Segment ' + meta.segNum;
  return meta.shortLabel || '';
}

function getPrimaryLessonFromWords(words) {
  if (!Array.isArray(words) || !words.length) return null;
  var counts = Object.create(null);
  var firstSeen = [];
  var order = Object.create(null);
  words.forEach(function(w) {
    var raw = getRawWordLesson(w) || 'kurs HanziGo';
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
    var raw = getRawWordLesson(w) || 'kurs HanziGo';
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
  getActiveWords().forEach(function(w) {
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
  getActiveWords().forEach(function(w) {
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
  getActiveWords().forEach(function(w) {
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
  // Words browser — single-select filters
  syncWordSegmentSelect();
  renderChipList('frow-status', getWordBrowserStatusItems(),
    function(v) { return curStatus2 === v; },
    filterWordStatus);
  syncWordLessonFilter();

  // Study screen — guided scope
  renderChipList('study-scope', getStudyScopeItems(),
    function(v) { return studyScope === v; },
    filterStudyScope);
  syncStudyScopeUi();
}

// ── STAGES SCREEN ─────────────────────────────────
// Rendering driven by getV3Segments() from courseStages.js.
// Status + session helpers live in courseStages.js (getLessonStatusByKey, startLessonSessionByKey).

function getCourseLessonWordStats(lessonKey, activeWords) {
  var words = (activeWords || getActiveWords()).filter(function(w) { return getRawWordLesson(w) === lessonKey; });
  var mastered = words.filter(function(w) { return SRS.isMastered(srsData[w.id]); }).length;
  var total = words.length;
  return {
    total: total,
    mastered: mastered,
    pct: total ? Math.round(mastered / total * 100) : 0
  };
}

function renderStages() {
  document.getElementById('stages-list').style.display = 'block';
  document.getElementById('stage-detail').style.display = 'none';

  var segments = getV3Segments();
  var activeWords = getActiveWords();

  if (!segments.length) {
    document.getElementById('stages-list').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--muted);font-family:\'Space Mono\',monospace;font-size:.75rem;">Brak danych kursu.</div>';
    return;
  }

  var html = segments.map(function(seg) {
    var lessons = seg.lessons;
    var doneCount = lessons.filter(function(l) { return getLessonStatusByKey(l.key) === 'done'; }).length;
    var pct = lessons.length ? Math.round(doneCount / lessons.length * 100) : 0;
    var allDone = doneCount === lessons.length;

    var lessonStatuses = lessons.map(function(lesson) {
      return { lesson: lesson, status: getLessonStatusByKey(lesson.key) };
    });

    var lessonsHtml = lessonStatuses.map(function(ls) {
      var lesson = ls.lesson;
      var status = ls.status;
      var lessonMeta = parseSourceLessonMeta(lesson.key);
      var stats = getCourseLessonWordStats(lesson.key, activeWords);
      var lpct = stats.pct;

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

      return '<div class="lesson-card' + (status === 'done' ? ' lc-done' : '') + '">' +
        '<div class="lc-header">' +
          '<div class="lc-title-wrap">' +
            '<span class="lc-code">' + lessonMeta.lessonCode + '</span>' +
            '<span class="lc-name">' + (lessonMeta.title || lesson.name) + '</span>' +
          '</div>' +
          badge +
        '</div>' +
        '<div class="lc-meta-row">' + stats.total + ' słów</div>' +
        '<div class="lc-bar"><div class="lc-fill" style="width:' + lpct + '%"></div></div>' +
        '<div class="lc-footer">' +
          '<span class="lc-meta">' + lpct + '% opanowane</span>' +
          '<button class="btn-lesson" data-action="start-lesson" data-lesson-key="' + lesson.key.replace(/"/g, '&quot;') + '">' + btnLabel + '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    var progressBadge = pct > 0
      ? '<span class="seg-hdr-badge' + (allDone ? ' seg-hdr-badge-done' : '') + '">' + pct + '%</span>'
      : '';

    return '<div class="seg-group">' +
      '<div class="seg-group-header">' +
        '<span class="stage-icon">' + seg.icon + '</span>' +
        '<span class="seg-hdr-name">' + seg.name + '</span>' +
        '<span class="seg-hdr-meta">' + doneCount + '/' + lessons.length + '</span>' +
        progressBadge +
      '</div>' +
      '<div class="seg-group-lessons">' + lessonsHtml + '</div>' +
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
  var activeWords = getActiveWords();
  var segWords    = activeWords.filter(function(w) {
    return lessons.some(function(l) { return l.key === w.sourceLesson; });
  });
  var segNew      = segWords.filter(function(w) { return SRS.isNew(srsData[w.id]); }).length;
  var segMastered = segWords.filter(function(w) { return SRS.isMastered(srsData[w.id]); }).length;
  var segLearning = segWords.length - segNew - segMastered;

  // Lesson cards
  var lessonsHtml = lessonStatuses.map(function(ls) {
    var lesson = ls.lesson;
    var status = ls.status;
    var lessonMeta = parseSourceLessonMeta(lesson.key);
    var stats  = getCourseLessonWordStats(lesson.key, activeWords);
    var lpct   = stats.pct;

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

    return '<div class="lesson-card' + (status === 'done' ? ' lc-done' : '') + '">' +
      '<div class="lc-header">' +
        '<div class="lc-title-wrap">' +
          '<span class="lc-code">' + lessonMeta.lessonCode + '</span>' +
          '<span class="lc-name">' + (lessonMeta.title || lesson.name) + '</span>' +
        '</div>' +
        badge +
      '</div>' +
      '<div class="lc-meta-row">' + stats.total + ' słów</div>' +
      '<div class="lc-bar"><div class="lc-fill" style="width:' + lpct + '%"></div></div>' +
      '<div class="lc-footer">' +
        '<span class="lc-meta">' + lpct + '% opanowane</span>' +
        '<button class="btn-lesson" data-action="start-lesson" data-lesson-key="' + lesson.key.replace(/"/g, '&quot;') + '">' + btnLabel + '</button>' +
      '</div>' +
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
    pool: getStudyPool().length,
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
window.srsAns     = srsAns;
window.nextWordAns = nextWordAns;
window.chkType = chkType;
window.tpNext = tpNext;
window.initChips = initChips;
window.selMode = selMode;
window.filterWordsSegment = filterWordsSegment;
window.filterWordStatus = filterWordStatus;
window.filterWordLesson = filterWordLesson;
window.renderWords = renderWords;
window.openWordDetail = openWordDetail;
window.closeWordModal = closeWordModal;
window.playWordModalAudio = playWordModalAudio;
window.setGoal = setGoal;
window.finishOnboard = finishOnboard;
window.dialogCancel = dialogCancel;
window.dialogConfirm = dialogConfirm;
window.playCurrentWordAudio = playCurrentWordAudio;
window.startHardSession = startHardSession;
init();
