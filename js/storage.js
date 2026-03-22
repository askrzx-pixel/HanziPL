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
