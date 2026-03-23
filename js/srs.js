// ── SRS — simplified SM-2 ────────────────────────
// Scheduling, due-date calculation, and status helpers.
// Depends on: today(), addDays() (defined below),
//             srsData (from storage.js), WORDS (from words.js)

const SRS = {
  defaultCard() {
    return { ef: 2.5, interval: 0, reps: 0, due: today(), reviews: 0, correct: 0 };
  },

  // rating: 0=Again  1=Hard  2=Good  3=Easy
  schedule(card, rating) {
    let { ef, interval, reps } = card;
    card.reviews = (card.reviews || 0) + 1;
    card.correct = (card.correct || 0) + (rating >= 2 ? 1 : 0);

    if (rating === 0) {
      reps = 0;
      interval = 1;
    } else if (rating === 1) {
      ef = Math.max(1.3, ef - 0.15);
      interval = Math.max(1, Math.round(interval * 1.2));
      reps++;
    } else if (rating === 2) {
      if (reps === 0) interval = 1;
      else if (reps === 1) interval = 4;
      else interval = Math.round(interval * ef);
      ef = Math.max(1.3, ef + 0.1);
      reps++;
    } else {
      if (reps === 0) interval = 4;
      else interval = Math.round(interval * ef * 1.3);
      ef = Math.min(3.0, ef + 0.15);
      reps++;
    }

    interval = Math.max(1, interval);
    card.ef = ef;
    card.interval = interval;
    card.reps = reps;
    card.due = addDays(today(), interval);
    return card;
  },

  previewIntervals(card) {
    return [0, 1, 2, 3].map(r => {
      const c = SRS.schedule({ ...card }, r);
      return fmtInterval(c.interval);
    });
  },

  isDue(card) {
    return !card.due || card.due <= today();
  },

  isNew(card) {
    return card.reps === 0;
  },

  isMastered(card) {
    return card.interval >= 21;
  },
};

// ── Date helpers ──────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(d, n) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

function fmtInterval(n) {
  if (n < 1) return '<1d';
  if (n === 1) return '1d';
  if (n < 7) return n + 'd';
  if (n < 30) return Math.round(n / 7) + 'tyg';
  return Math.round(n / 30) + 'mies';
}

// ── Levenshtein (used by typing mode) ────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i ? (j ? 0 : i) : j))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

// ── Daily session word selection ──────────────────
function getDailyWords() {
  ensureDailyLog();
  const goal = appConfig.dailyGoal;

  const due = WORDS.filter(w => {
    const c = srsData[w.hanzi];
    return !SRS.isNew(c) && SRS.isDue(c);
  });

  const newWords = WORDS.filter(w => SRS.isNew(srsData[w.hanzi]));
  const newLimit = Math.max(0, goal - due.length);
  const newSlice = newWords.slice(0, newLimit);

  return {
    due,
    newWords: newSlice,
    total: due.length + newSlice.length,
  };
}
