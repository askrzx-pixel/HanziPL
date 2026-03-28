// ── COURSE STAGES v3 ──────────────────────────────
// Data-driven: struktura kursu pochodzi z WORDS.sourceLesson.
// Nie ma hardkodowanych list lekcji — wszystko wynika z danych.
// Zależności: WORDS (words.js), srsData (storage.js), SRS (srs.js).

var SEGMENT_NAMES = {
  1:  'Podstawy komunikacji',
  2:  'Życzenia i okazje',
  3:  'Rodzina i relacje',
  4:  'Transport',
  5:  'Miejsca w mieście',
  6:  'Czasowniki ruchu',
  7:  'Ubrania i rzeczy osobiste',
  8:  'Jedzenie i picie',
  9:  'Codzienne czynności',
  10: 'Dom i wyposażenie',
  11: 'Zdrowie i samopoczucie',
  12: 'Zakupy i pieniądze',
  13: 'Ludzie, role, zawody',
  14: 'Nauka i rzeczy szkolne',
  15: 'Czas codzienny',
  16: 'Technologia i urządzenia',
  17: 'Gramatyka podstawowa',
  18: 'Classifiery i liczenie',
  19: 'Przymiotniki podstawowe',
  20: 'Czas rozszerzony',
  21: 'Gotowe frazy codzienne',
  22: 'Pogoda i warunki',
  23: 'Zwierzęta',
  24: 'Nazwy własne i geografia',
  25: 'Czasowniki rozszerzone',
  26: 'Kultura, nauka i rozrywka'
};

var SEGMENT_ICONS = {
  1:  '👋', 2:  '🎉', 3:  '👨‍👩‍👧', 4:  '🚌', 5:  '🏙️',
  6:  '🏃', 7:  '👕', 8:  '🥢',  9:  '📅', 10: '🏠',
  11: '💊', 12: '🛒', 13: '👨‍🏫', 14: '📚', 15: '🕐',
  16: '💻', 17: '📖', 18: '🔢', 19: '✨', 20: '📆',
  21: '💬', 22: '⛅', 23: '🐱', 24: '🌍', 25: '⚡',
  26: '🎭'
};

/**
 * Derives segments + lessons directly from WORDS.sourceLesson.
 * Returns [{ segNum, name, icon, lessons: [{key, segNum, subNum, name}] }]
 * Sorted by segNum; lessons sorted by subNum within each segment.
 */
function getV3Segments() {
  var lessonMap = Object.create(null);
  WORDS.forEach(function(w) {
    var sl = (w.sourceLesson || '').trim();
    if (!sl || lessonMap[sl]) return;
    var m = sl.match(/^(\d+)\.(\d+)\s+(.+)$/);
    if (!m) return;
    lessonMap[sl] = {
      key:    sl,
      segNum: parseInt(m[1], 10),
      subNum: parseInt(m[2], 10),
      name:   sl
    };
  });

  var allLessons = Object.keys(lessonMap)
    .map(function(k) { return lessonMap[k]; })
    .sort(function(a, b) {
      return a.segNum !== b.segNum ? a.segNum - b.segNum : a.subNum - b.subNum;
    });

  var segMap = Object.create(null);
  allLessons.forEach(function(l) {
    if (!segMap[l.segNum]) segMap[l.segNum] = [];
    segMap[l.segNum].push(l);
  });

  return Object.keys(segMap)
    .map(Number)
    .sort(function(a, b) { return a - b; })
    .map(function(n) {
      return {
        segNum:  n,
        name:    SEGMENT_NAMES[n] || ('Segment ' + n),
        icon:    SEGMENT_ICONS[n] || '📖',
        lessons: segMap[n]
      };
    });
}

/**
 * Returns 'new' | 'in-progress' | 'done' | 'empty' for a sourceLesson key.
 */
function getLessonStatusByKey(lessonKey) {
  var lw = WORDS.filter(function(w) { return w.sourceLesson === lessonKey; });
  if (!lw.length) return 'empty';
  var newCount = lw.filter(function(w) { return SRS.isNew(srsData[w.id]); }).length;
  if (newCount === lw.length) return 'new';
  if (newCount > 0)           return 'in-progress';
  return 'done';
}

/**
 * Starts a session for all words in a given sourceLesson key.
 */
function startLessonSessionByKey(lessonKey) {
  var words = WORDS.filter(function(w) { return w.sourceLesson === lessonKey; });
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
