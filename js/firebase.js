// ── FIREBASE.JS ───────────────────────────────────
// Handles Google login and Firestore synchronization.
// Loaded BEFORE storage.js and app.js.
// Exposes: currentUser, fbSaveAll(), fbLoadAll(), signInWithGoogle(), signOut()

// ── Firebase config (Twój projekt HanziPL) ───────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAALuZ3Sdh-Lvp38n3nw6TpzKNolZ4rU_0",
  authDomain:        "hanzipl-42ef0.firebaseapp.com",
  projectId:         "hanzipl-42ef0",
  storageBucket:     "hanzipl-42ef0.firebasestorage.app",
  messagingSenderId: "876038817557",
  appId:             "1:876038817557:web:67d572632b25589f554b1c"
};

// ── Firebase SDK (ładowane przez CDN z index.html) ─
// Zmienne firebase, firestore i auth są dostępne globalnie
// po załadowaniu skryptów CDN w index.html

var firebaseApp  = null;
var firestoreDB  = null;
var firebaseAuth = null;
var currentUser  = null;   // null = niezalogowany

// ── Inicjalizacja ─────────────────────────────────
function initFirebase() {
  try {
    firebaseApp  = firebase.initializeApp(FIREBASE_CONFIG);
    firestoreDB  = firebase.firestore();
    firebaseAuth = firebase.auth();

    // Nasłuchuj na zmiany stanu logowania
    firebaseAuth.onAuthStateChanged(function(user) {
      currentUser = user;
      onAuthStateChanged(user);
    });

    console.log('Firebase zainicjalizowany');
  } catch (e) {
    console.warn('Firebase niedostępny, tryb offline:', e.message);
  }
}

// ── Wywoływane gdy zmienia się stan logowania ─────
// (nadpisywane w app.js)
function onAuthStateChanged(user) {
  // placeholder — app.js nadpisze tę funkcję
}

// ── Logowanie przez Google ────────────────────────
function signInWithGoogle() {
  if (!firebaseAuth) { showToast('Firebase niedostępny', true); return; }
  var provider = new firebase.auth.GoogleAuthProvider();
  firebaseAuth.signInWithPopup(provider).catch(function(err) {
    console.error('Błąd logowania:', err);
    showToast('Błąd logowania: ' + err.message, true);
  });
}

// ── Wylogowanie ───────────────────────────────────
function signOutUser() {
  if (!firebaseAuth) return;
  firebaseAuth.signOut().then(function() {
    currentUser = null;
    renderAuthUI();
    showToast('Wylogowano');
  });
}

// ── Zapis do Firestore ────────────────────────────
// Zapisuje cały stan aplikacji jako jeden dokument
// w kolekcji "users/{uid}/data/progress"
function fbSaveAll() {
  if (!firestoreDB || !currentUser) return; // tryb offline — nic nie rób

  var uid = currentUser.uid;
  var payload = {
    srsData:    srsData,
    appConfig:  appConfig,
    dailyLog:   dailyLog,
    streakData: streakData,
    updatedAt:  new Date().toISOString()
  };

  firestoreDB
    .collection('users')
    .doc(uid)
    .set(payload)
    .catch(function(err) {
      console.warn('Błąd zapisu Firestore:', err.message);
    });
}

// ── Odczyt z Firestore ────────────────────────────
// Ładuje dane użytkownika z chmury i nadpisuje lokalne
function fbLoadAll(callback) {
  if (!firestoreDB || !currentUser) {
    if (callback) callback(false);
    return;
  }

  var uid = currentUser.uid;
  firestoreDB
    .collection('users')
    .doc(uid)
    .get()
    .then(function(doc) {
      if (doc.exists) {
        var data = doc.data();

        // Nadpisz lokalne zmienne danymi z chmury
        if (data.srsData)    srsData    = data.srsData;
        if (data.appConfig)  appConfig  = data.appConfig;
        if (data.dailyLog)   dailyLog   = data.dailyLog;
        if (data.streakData) streakData = data.streakData;

        // Zapisz też lokalnie jako backup
        DB.save('cn_srs',    srsData);
        DB.save('cn_cfg',    appConfig);
        DB.save('cn_daily',  dailyLog);
        DB.save('cn_streak', streakData);

        console.log('Dane załadowane z Firestore');
        if (callback) callback(true);
      } else {
        // Nowy użytkownik — brak danych w chmurze
        console.log('Brak danych w Firestore — nowy użytkownik');
        if (callback) callback(false);
      }
    })
    .catch(function(err) {
      console.warn('Błąd odczytu Firestore:', err.message);
      if (callback) callback(false);
    });
}

// ── Renderowanie UI logowania ─────────────────────
function renderAuthUI() {
  var btn = document.getElementById('auth-btn');
  var info = document.getElementById('auth-info');
  if (!btn) return;

  if (currentUser) {
    // Zalogowany — pokaż imię i przycisk wylogowania
    btn.textContent = 'Wyloguj';
    btn.onclick = signOutUser;
    if (info) info.textContent = currentUser.displayName || currentUser.email;
  } else {
    // Niezalogowany — przycisk logowania
    btn.textContent = '🔑 Zaloguj przez Google';
    btn.onclick = signInWithGoogle;
    if (info) info.textContent = 'Niezalogowany — postępy tylko lokalnie';
  }
}

// Inicjuj Firebase od razu po załadowaniu skryptu
initFirebase();
