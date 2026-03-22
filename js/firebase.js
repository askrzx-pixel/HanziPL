// ── FIREBASE.JS ───────────────────────────────────
// Opcjonalna warstwa synchronizacji z chmurą.
// Jeśli Firebase nie załaduje się lub rzuci błąd —
// aplikacja działa normalnie w trybie offline (localStorage).
//
// WAŻNE: Ten plik NIE blokuje startowania aplikacji.
// Wszystkie operacje Firebase są asynchroniczne i
// owinięte w try/catch.

var currentUser  = null;
var _fbReady     = false;  // czy Firebase załadował się poprawnie
var _fbSaveTimer = null;   // timer do debouncingu zapisu

// ── Konfiguracja projektu HanziPL ─────────────────
var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAALuZ3Sdh-Lvp38n3nw6TpzKNolZ4rU_0",
  authDomain:        "hanzipl-42ef0.firebaseapp.com",
  projectId:         "hanzipl-42ef0",
  storageBucket:     "hanzipl-42ef0.firebasestorage.app",
  messagingSenderId: "876038817557",
  appId:             "1:876038817557:web:67d572632b25589f554b1c"
};

// ── Inicjalizacja — wywoływana po załadowaniu strony ─
function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK nie załadowany — tryb offline');
      return;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    _fbReady = true;

    // Nasłuchuj na zmiany stanu logowania
    firebase.auth().onAuthStateChanged(function(user) {
      currentUser = user;
      // Wywołaj handler w app.js (jest tam zdefiniowany)
      if (typeof handleAuthChange === 'function') {
        handleAuthChange(user);
      }
      renderAuthUI();
    });

    console.log('Firebase OK');
  } catch(e) {
    console.warn('Firebase init failed:', e.message);
    _fbReady = false;
  }
}

// ── Logowanie przez Google ────────────────────────
function signInWithGoogle() {
  if (!_fbReady) { showToast('Firebase niedostępny', true); return; }
  try {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(function(err) {
      showToast('Błąd logowania: ' + err.message, true);
    });
  } catch(e) {
    showToast('Błąd logowania', true);
  }
}

// ── Wylogowanie ───────────────────────────────────
function signOutUser() {
  if (!_fbReady) return;
  firebase.auth().signOut().then(function() {
    currentUser = null;
    renderAuthUI();
    showToast('Wylogowano');
  });
}

// ── Zapis do Firestore (debounced — max raz na 4s) ─
function fbSaveAll() {
  if (!_fbReady || !currentUser) return;

  // Anuluj poprzedni timer
  if (_fbSaveTimer) clearTimeout(_fbSaveTimer);

  _fbSaveTimer = setTimeout(function() {
    _fbSaveTimer = null;
    try {
      var payload = {
        srsData:    srsData,
        appConfig:  appConfig,
        dailyLog:   dailyLog,
        streakData: streakData,
        updatedAt:  new Date().toISOString()
      };
      firebase.firestore()
        .collection('users')
        .doc(currentUser.uid)
        .set(payload)
        .catch(function(e) { console.warn('Firestore save error:', e.message); });
    } catch(e) {
      console.warn('fbSaveAll error:', e.message);
    }
  }, 4000);
}

// ── Odczyt z Firestore ────────────────────────────
function fbLoadAll(callback) {
  if (!_fbReady || !currentUser) {
    if (callback) callback(false);
    return;
  }
  try {
    firebase.firestore()
      .collection('users')
      .doc(currentUser.uid)
      .get()
      .then(function(doc) {
        if (doc.exists) {
          var data = doc.data();
          if (data.srsData)    srsData    = data.srsData;
          if (data.appConfig)  appConfig  = data.appConfig;
          if (data.dailyLog)   dailyLog   = data.dailyLog;
          if (data.streakData) streakData = data.streakData;
          // Backup lokalny
          DB.save('cn_srs',    srsData);
          DB.save('cn_cfg',    appConfig);
          DB.save('cn_daily',  dailyLog);
          DB.save('cn_streak', streakData);
          if (callback) callback(true);
        } else {
          if (callback) callback(false);
        }
      })
      .catch(function(e) {
        console.warn('Firestore load error:', e.message);
        if (callback) callback(false);
      });
  } catch(e) {
    console.warn('fbLoadAll error:', e.message);
    if (callback) callback(false);
  }
}

// ── UI przycisku logowania ────────────────────────
function renderAuthUI() {
  var btn  = document.getElementById('auth-btn');
  var info = document.getElementById('auth-info');
  if (!btn) return;

  if (currentUser) {
    btn.textContent = 'Wyloguj';
    btn.onclick = signOutUser;
    if (info) info.textContent = currentUser.displayName || currentUser.email || '';
  } else {
    btn.textContent = '🔑 Zaloguj';
    btn.onclick = signInWithGoogle;
    if (info) info.textContent = '';
  }
}

// ── Inicjuj Firebase po załadowaniu DOM ───────────
// Używamy window.addEventListener zamiast inicjować od razu,
// żeby mieć pewność że wszystkie inne skrypty już się załadowały.
window.addEventListener('load', function() {
  initFirebase();
});
