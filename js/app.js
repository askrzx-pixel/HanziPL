// ── APP.JS ────────────────────────────────────────
// UI rendering, screen switching, session flow.
// Depends on: words.js, storage.js, srs.js

// ── Runtime state ─────────────────────────────────
var curFilter  = 'all';
var curMode    = 'fc';
var selLessons = new Set(['all']);
var sWords = [], sIdx = 0, sOk = 0, sTotal = 0, fcFlipped = false;
var isDailySession  = false;
var sessionReviews  = 0;
var sessionCorrect  = 0;

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
  const m = WORDS.filter(w => SRS.isMastered(srsData[w.hanzi])).length;
  document.getElementById('nm').textContent = m;
}

function go(name, btn) {
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.botnav-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('scr-' + name).classList.add('on');
  if (btn) btn.classList.add('on');
  if (name === 'home')  renderHomeScreen();
  if (name === 'stats') renderStats();
  if (name === 'words') renderWords();
  if (name === 'study') { updateSessionCount(); }
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
  const greet = h < 12 ? 'Dzień dobry!' : h < 18 ? 'Dzień dobry!' : 'Dobry wieczór!';
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

  const mastered = WORDS.filter(w => SRS.isMastered(srsData[w.hanzi])).length;
  document.getElementById('hs-total').textContent    = WORDS.length;
  document.getElementById('hs-mastered').textContent = mastered;
  updateNavMastered();

  let totalR = 0, totalC = 0;
  WORDS.forEach(w => {
    const c = srsData[w.hanzi];
    totalR += c.reviews || 0;
    totalC += c.correct || 0;
  });
  const acc = totalR > 0 ? Math.round(totalC / totalR * 100) : null;
  document.getElementById('hs-acc').textContent = acc !== null ? acc + '%' : '—';
}

function startDailySession() {
  const { due, newWords } = getDailyWords();
  const pool = shuffle([...due, ...newWords]);
  if (!pool.length) { showToast('Brak słówek na dziś! 🎉', false, 'good'); return; }

  // Przełącz widok na zakładkę Nauka (tylko nawigacja, bez resetowania sesji)
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.botnav-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('scr-study').classList.add('on');
  var navBtn = document.getElementById('bn-study');
  if (navBtn) navBtn.classList.add('on');
  window.scrollTo(0, 0);

  // Teraz uruchom sesję — po przełączeniu zakładki
  isDailySession = true;
  beginSession(pool, 'fc');
}

// ── STATS ─────────────────────────────────────────
function renderStats() {
  const total    = WORDS.length;
  const mastered = WORDS.filter(w =>  SRS.isMastered(srsData[w.hanzi])).length;
  const learning = WORDS.filter(w => { const c = srsData[w.hanzi]; return !SRS.isNew(c) && !SRS.isMastered(c); }).length;
  const newW     = WORDS.filter(w =>  SRS.isNew(srsData[w.hanzi])).length;

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
    .map(w => ({ ...w, c: srsData[w.hanzi] }))
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

  document.getElementById('bchart').innerHTML = LESSONS.map(ls => {
    const lw = WORDS.filter(w => w.lesson === ls);
    const lm = lw.filter(w => SRS.isMastered(srsData[w.hanzi])).length;
    const p  = lw.length ? Math.round(lm / lw.length * 100) : 0;
    return '<div class="brow"><div class="blbl">' + ls + '</div>' +
      '<div class="btrack"><div class="bfill" style="width:' + p + '%"></div></div>' +
      '<div class="bpct">' + p + '%</div></div>';
  }).join('');
}

// ── WORDS BROWSER ─────────────────────────────────
var curFilter2 = 'all';

function filterWords(l, btn) {
  curFilter2 = l;
  document.querySelectorAll('#scr-words .chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderWords();
}

function renderWords() {
  const q = (document.getElementById('srch').value || '').toLowerCase();
  let f = WORDS;
  if (curFilter2 !== 'all') f = f.filter(w => w.lesson === curFilter2);
  if (q) f = f.filter(w =>
    w.hanzi.includes(q) ||
    w.pinyin.toLowerCase().includes(q) ||
    w.pl.toLowerCase().includes(q)
  );

  document.getElementById('clbl').textContent = f.length + ' słówek';
  const g = document.getElementById('wgrid');

  if (!f.length) { g.innerHTML = '<div class="empty">Brak wyników…</div>'; return; }

  g.innerHTML = f.map(w => {
    const c    = srsData[w.hanzi];
    const tag  = SRS.isNew(c)      ? '<span class="srs-tag new">NOWE</span>'         :
                 SRS.isDue(c)      ? '<span class="srs-tag due">DO POWTÓRKI</span>'   :
                 SRS.isMastered(c) ? '<span class="srs-tag ok">✓ OPANOWANE</span>'   : '';
    const mPct = Math.min(100, Math.round((c.interval || 0) / 21 * 100));
    return '<div class="wcard">' +
      '<span class="hz">' + w.hanzi + '</span>' +
      '<div class="py">' + w.pinyin + '</div>' +
      '<div class="tr">' + w.pl + '</div>' +
      '<div class="ls">' + w.lesson + '</div>' +
      tag +
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

function getPool() {
  return selLessons.has('all') ? WORDS : WORDS.filter(w => selLessons.has(w.lesson));
}

function updateSessionCount() {
  document.getElementById('scnt').textContent = getPool().length + ' słówek w puli';
}

function startCustomSession() {
  try {
    alert('weszło do startCustomSession');

    console.log('startCustomSession: start');
    console.log('curMode =', curMode);
    console.log('typeof shuffle =', typeof shuffle);
    console.log('typeof beginSession =', typeof beginSession);

    const basePool = getPool();
    console.log('basePool length =', basePool ? basePool.length : 'brak');

    const pool = shuffle([...basePool]);
    console.log('pool length after shuffle =', pool.length);

    if (!pool.length) {
      alert('Brak słówek w puli');
      showToast('Brak słówek!', true);
      updateSessionCount();
      return;
    }

    isDailySession = false;
    alert('zaraz beginSession');
    beginSession(pool, curMode);
    alert('beginSession wykonane');
  } catch (e) {
    console.error('Błąd w startCustomSession:', e);
    alert('Błąd: ' + e.message);
  }
  
function beginSession(pool, mode) {
  sWords = Array.isArray(pool) ? [...pool] : [];
  sIdx = 0;
  sOk = 0;
  sTotal = sWords.length;
  sessionReviews = 0;
  sessionCorrect = 0;
  fcFlipped = false;
  curMode = mode;

  if (!sWords.length) {
    showToast('Brak słówek!', true);
    backHome();
    return;
  }

  hideAll();

  if (mode === 'fc') {
    startFC();
  } else if (mode === 'qz') {
    startQZ();
  } else {
    startTP();
  }
}}

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
  document.getElementById('sh').style.display = 'block';
  isDailySession = false;
}

function sp(p, i, t) {
  const pc = t ? i / t * 100 : 0;
  document.getElementById(p + '-t').textContent   = i + '/' + t;
  document.getElementById(p + '-f').style.width   = pc + '%';
}

function recordAnswer(hanzi, correct) {
  sessionReviews++;
  if (correct) sessionCorrect++;
  ensureDailyLog();
  dailyLog.done++;
  if (SRS.isNew(srsData[hanzi])) dailyLog.newDone++;
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

  function applyContent() {
    if (hzEl) hzEl.textContent = w.hanzi || '—';
    if (pyEl) pyEl.textContent = w.pinyin || '—';
    if (trEl) trEl.textContent = w.pl || '—';
    if (bhEl) bhEl.textContent = w.hanzi || '—';

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
  const intervals = SRS.previewIntervals(srsData[w.hanzi]);
  ['srs-i0','srs-i1','srs-i2','srs-i3'].forEach((id, i) => {
    document.getElementById(id).textContent = intervals[i];
  });
  setTimeout(() => document.getElementById('srs-btns').style.display = 'block', 340);
}

function srsAns(rating) {
  const w    = sWords[sIdx];
  const card = srsData[w.hanzi];
  const correct = (rating >= 2);
  SRS.schedule(card, rating);
  srsData[w.hanzi] = card;
  recordAnswer(w.hanzi, correct);
  if (correct) sOk++;
  if (rating === 0) sWords.push(w); // Again → re-queue
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
  if (sIdx >= sWords.length) { showResults(); return; }
  const w = sWords[sIdx];
  document.getElementById('qz-hz').textContent = w.hanzi;
  document.getElementById('qz-py').textContent = w.pinyin;

  const sameLsn = WORDS.filter(x => x.pl !== w.pl && x.lesson === w.lesson);
  const other   = WORDS.filter(x => x.pl !== w.pl && x.lesson !== w.lesson);
  const pool    = shuffle(sameLsn).concat(shuffle(other));
  let opts      = [w.pl];
  pool.slice(0, 3).forEach(x => opts.push(x.pl));
  while (opts.length < 4) opts.push('—');
  shuffle(opts);

  const c = document.getElementById('qopts');
  c.innerHTML = '';
  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'qopt'; b.textContent = o;
    b.onclick = () => ansQZ(b, o, w.pl);
    c.appendChild(b);
  });
  document.getElementById('qz-nx').classList.remove('on');
  sp('qz', sIdx, sWords.length);
}

function ansQZ(btn, ch, cor) {
  document.querySelectorAll('.qopt').forEach(b => b.disabled = true);
  const correct = (ch === cor);
  if (correct) {
    btn.classList.add('ok'); sOk++;
    SRS.schedule(srsData[sWords[sIdx].hanzi], 2);
  } else {
    btn.classList.add('err');
    document.querySelectorAll('.qopt').forEach(b => { if (b.textContent === cor) b.classList.add('ok'); });
    SRS.schedule(srsData[sWords[sIdx].hanzi], 0);
  }
  recordAnswer(sWords[sIdx].hanzi, correct); // saveAll() jest już wewnątrz recordAnswer
  document.getElementById('qz-nx').classList.add('on');
}

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

  if (hzEl) hzEl.textContent = w.hanzi || '—';
  if (pyEl) pyEl.textContent = w.pinyin || '—';
  if (nextBtn) nextBtn.classList.remove('on');

  sp('qz', sIdx + 1, sWords.length);

  const sameLsn = WORDS.filter(x => x.pl !== w.pl && x.lesson === w.lesson);
  const other = WORDS.filter(x => x.pl !== w.pl && x.lesson !== w.lesson);
  const pool = shuffle(sameLsn).concat(shuffle(other));

  let opts = [w.pl];
  pool.slice(0, 3).forEach(x => opts.push(x.pl));
  while (opts.length < 4) opts.push('—');
  opts = shuffle(opts);

  if (optsBox) {
    optsBox.innerHTML = opts.map(opt => `
      <button class="qopt" onclick="checkQZ(this, ${JSON.stringify(w.pl)})">${opt}</button>
    `).join('');
  }
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

  if (correct) {
    inp.classList.add('ok');
    fb.textContent = '✓ Dobrze!'; fb.className = 'tfb ok'; sOk++;
    SRS.schedule(srsData[w.hanzi], 2);
    recordAnswer(w.hanzi, true);
  } else {
    inp.classList.add('err');
    fb.innerHTML = '✕ Poprawna: <b>' + w.pl + '</b>'; fb.className = 'tfb err';
    SRS.schedule(srsData[w.hanzi], 0);
    recordAnswer(w.hanzi, false);
  }
  // saveAll() jest już wywołane wewnątrz recordAnswer powyżej
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
  checkAndUpdateStreak();
  renderStreakBadge();
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
// Wywoływany przez firebase.js gdy zmienia się stan logowania.
// Nazwa handleAuthChange (nie onAuthStateChanged) żeby uniknąć
// konfliktu z Firebase SDK które ma własne onAuthStateChanged.
function handleAuthChange(user) {
  if (user) {
    showToast('Synchronizacja z chmurą...', false);
    fbLoadAll(function(loaded) {
      // Upewnij się że nowe słówka mają karty SRS
      WORDS.forEach(w => {
        if (!srsData[w.hanzi]) srsData[w.hanzi] = SRS.defaultCard();
      });
      renderStreakBadge();
      updateNavMastered();
      renderHomeScreen();
      if (loaded) showToast('Zsynchronizowano ☁️', false, 'good');
    });
  } else {
    renderHomeScreen();
  }
  // renderAuthUI() jest już wywołane w firebase.js po handleAuthChange
}

// ── INIT ──────────────────────────────────────────
function init() {
  if (!Array.isArray(WORDS)) {
    console.error('WORDS is missing or not an array');
    return;
  }

  WORDS.forEach(w => {
    if (!srsData[w.hanzi]) srsData[w.hanzi] = SRS.defaultCard();
  });

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
window.startCustomSession = startCustomSession;
window.startCustomSession = startCustomSession;iwindow.startCustomSession = startCustomSession;nit();
