// ── STORAGE ──────────────────────────────────────
// All localStorage read/write logic lives here.
// Structured so data can be synced to a backend later.

const DB = {
  load(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  },
  save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },
};

// ── App-level state loaded from storage ──────────
var srsData    = DB.load('cn_srs',    {});
var appConfig  = DB.load('cn_cfg',    { dailyGoal: 10, onboarded: false });
var dailyLog   = DB.load('cn_daily',  { date: '', done: 0, newDone: 0 });
var streakData = DB.load('cn_streak', { current: 0, lastDate: '' });

// ── Persist everything ────────────────────────────
function saveAll() {
  DB.save('cn_srs',    srsData);
  DB.save('cn_cfg',    appConfig);
  DB.save('cn_daily',  dailyLog);
  DB.save('cn_streak', streakData);
  updateNavMastered();
}

// ── Daily log helpers ─────────────────────────────
function ensureDailyLog() {
  if (dailyLog.date !== today()) {
    dailyLog = { date: today(), done: 0, newDone: 0 };
    DB.save('cn_daily', dailyLog);
  }
}
