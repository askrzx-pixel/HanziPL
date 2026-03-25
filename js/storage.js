// ── STORAGE.JS ────────────────────────────────────
// Warstwa persystencji — localStorage jako primary,
// Firestore jako sync (obsługiwany w firebase.js).
// Eksportuje: DB, srsData, appConfig, dailyLog, streakData,
//             saveAll(), ensureDailyLog()

const DB = {
  load(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  },
  save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },
};

// ── Stan aplikacji ładowany z localStorage ────────
var srsData    = DB.load('cn_srs',    {});
var appConfig  = DB.load('cn_cfg',    { dailyGoal: 10, onboarded: false });
var dailyLog   = DB.load('cn_daily',  { date: '', done: 0, newDone: 0 });
var streakData = DB.load('cn_streak', { current: 0, lastDate: '' });

// ── Zapis — lokalnie ZAWSZE, do chmury jeśli zalogowany ──
function saveAll() {
  // Zawsze zapisz lokalnie (działa offline)
  DB.save('cn_srs',    srsData);
  DB.save('cn_cfg',    appConfig);
  DB.save('cn_daily',  dailyLog);
  DB.save('cn_streak', streakData);
  // Znacznik świeżości — używany przez fbLoadAll() do porównania z chmurą
  try { localStorage.setItem('cn_updatedAt', new Date().toISOString()); } catch(e) {}

  // Jeśli zalogowany — zapisz też w Firestore
  // fbSaveAll() jest zdefiniowane w firebase.js
  if (typeof fbSaveAll === 'function') fbSaveAll();

  // Odśwież licznik opanowanych w navbarze
  // Odśwież UI tylko jeśli DOM jest gotowy
  try {
    if (typeof updateNavMastered === 'function') updateNavMastered();
  } catch(e) {
    console.warn('updateNavMastered error:', e);
  }
}

// ── Upewnij się że daily log dotyczy dzisiejszego dnia ──
function ensureDailyLog() {
  if (typeof today !== 'function') return;
  if (dailyLog.date !== today()) {
    dailyLog = { date: today(), done: 0, newDone: 0 };
    DB.save('cn_daily', dailyLog);
  }
}

// ── Migracja SRS: stare klucze hanzi → nowe klucze id ─
// Uruchamiana raz przy ładowaniu storage.js, zanim app.js użyje danych.
// Idempotentna: jeśli nie ma starych kluczy, kończy się natychmiast.
// words.js jest ładowany przed storage.js, więc WORDS jest dostępne.
(function migrateSrsHanziToId() {
  if (typeof WORDS === 'undefined' || !Array.isArray(WORDS)) return;

  // Zbiór znanych kluczy id (w0001…w1188)
  var knownIds = Object.create(null);
  WORDS.forEach(function(w) { if (w.id) knownIds[w.id] = true; });

  // Stare klucze = wszystko poza kluczami id
  var oldKeys = Object.keys(srsData).filter(function(k) { return !knownIds[k]; });
  if (!oldKeys.length) return; // nic do migracji

  // Mapa hanzi → [id, …] (kolejność z WORDS; pierwszy = pierwszy rekord)
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
    if (!ids || !ids.length) return; // hanzi nieznany w WORDS — odrzuć
    // Progres trafia do pierwszego rekordu z tym hanzi.
    // Jeśli slot jest już zajęty (nowy format), nie nadpisuj.
    // Duplikaty hanzi (ids[1]…) dostaną świeżą kartę przy init().
    if (!srsData[ids[0]]) { srsData[ids[0]] = oldCard; migrated++; }
  });

  DB.save('cn_srs', srsData);
  console.log('[HanziPL] SRS migration: ' + migrated + ' wpisów → klucze id (' + oldKeys.length + ' starych kluczy usunięto)');
}());
