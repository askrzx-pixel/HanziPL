// ── COURSE STAGES ─────────────────────────────────
// Źródło prawdy dla struktury kursowej.
// Helpery: getWordStageId, getWordLessonId, getStageById, getStageWords.
// Zależności: WORDS (words.js musi być załadowany wcześniej).

var COURSE_STAGES = [
  {
    id: 'start',
    order: 1,
    name: 'Start',
    shortLabel: 'Start',
    icon: '🌱',
    description: 'To Twój pierwszy krok w chińskim. Tutaj poznajesz podstawowe zwroty i słówka, które pozwalają się przywitać, przedstawić i zacząć rozumieć najprostsze komunikaty.',
    canDo: [
      'Przywitać się i pożegnać po chińsku',
      'Podziękować, przeprosić i użyć podstawowych zwrotów grzecznościowych',
      'Powiedzieć, jak masz na imię i zapytać o imię drugiej osoby',
      'Rozpoznać podstawowe zaimki: ja, ty, on, ona, my, oni',
      'Nazwać kilka krajów i języków',
      'Liczyć i rozumieć podstawowe liczby'
    ],
    valueText: 'Budujesz fundament pod pierwsze proste zdania — od powitania przez przedstawienie się po liczby.',
    hskNote: 'Materiał zbliżony do pierwszych zakresów HSK.',
    nextStageText: 'W kolejnym etapie wejdziesz w słownictwo związane z ludźmi, rodziną i prostą codzienną komunikacją.',
    uiSummary: 'Po etapie Start potrafisz się przywitać, przedstawić, podziękować, policzyć i nazwać kraje.',
    lessons: [
      { id: 'start_greetings',          order: 1, name: 'Powitania i pożegnania',       summary: 'Przywitaj się i pożegnaj po chińsku.' },
      { id: 'start_courtesy',           order: 2, name: 'Uprzejmość',                   summary: 'Dziękuję, przepraszam i inne zwroty grzecznościowe.' },
      { id: 'start_intro',              order: 3, name: 'Przedstawianie się',            summary: 'Jak masz na imię? Powiedz coś o sobie.' },
      { id: 'start_pronouns',           order: 4, name: 'Ja i inni',                    summary: 'Podstawowe zaimki osobowe.' },
      { id: 'start_countries_languages',order: 5, name: 'Kraje i języki',               summary: 'Pierwsze słowa o krajach i językach.' },
      { id: 'start_numbers',            order: 6, name: 'Liczby podstawowe',            summary: 'Liczby potrzebne na samym początku.' },
      { id: 'start_basic_questions',    order: 7, name: 'Pytania i wskazywanie',        summary: 'To, tamto, który? Pierwsze pytania.' }
    ]
  },
  {
    id: 'daily_basics',
    order: 2,
    name: 'Podstawy codzienności',
    shortLabel: 'Codzienność',
    icon: '🏠',
    description: 'Tutaj uczysz się mówić o ludziach i najprostszych elementach codziennego życia.',
    canDo: [
      'Nazwać członków rodziny i bliskie osoby',
      'Rozumieć proste codzienne czasowniki',
      'Rozumieć słowa o zdrowiu i samopoczuciu',
      'Wyrażać najprostsze potrzeby i preferencje',
      'Lepiej rozumieć proste mini-sytuacje z życia codziennego'
    ],
    valueText: 'Zaczynasz budować słownictwo, które brzmi bardziej życiowo i użytecznie niż same zwroty startowe.',
    hskNote: 'Materiał wczesnego poziomu — podstawowe słownictwo codzienne.',
    nextStageText: 'W kolejnym etapie zaczniesz lepiej rozumieć czas, liczby, daty i proste odniesienia do planu dnia.',
    uiSummary: 'Po tym etapie lepiej rozumiesz słownictwo o ludziach, rodzinie i prostych sytuacjach dnia codziennego.',
    lessons: [
      { id: 'daily_family',    order: 1, name: 'Rodzina',             summary: 'Najbliżsi i podstawowe relacje.' },
      { id: 'daily_people',    order: 2, name: 'Ludzie i role',       summary: 'Słowa o osobach i rolach społecznych.' },
      { id: 'daily_verbs',     order: 3, name: 'Codzienne czasowniki',summary: 'Najprostsze czasowniki przydatne na co dzień.' },
      { id: 'daily_home',      order: 4, name: 'Dom i codzienność',   summary: 'Słownictwo o domu i prostych sytuacjach.' },
      { id: 'daily_questions', order: 5, name: 'Proste pytania',      summary: 'Pytania potrzebne w najprostszych rozmowach.' }
    ]
  },
  {
    id: 'time_numbers',
    order: 3,
    name: 'Czas i liczby',
    shortLabel: 'Czas i liczby',
    icon: '🕐',
    description: 'Tutaj uczysz się rozumieć i nazywać liczby, czas, daty oraz podstawowe odniesienia do codziennego planu.',
    canDo: [
      'Rozpoznawać i lepiej używać liczb',
      'Rozumieć podstawowe słowa o dniach, datach i porach dnia',
      'Kojarzyć pytania „kiedy" i odniesienia do czasu',
      'Orientować się w prostych komunikatach o planie dnia',
      'Rozumieć praktyczne słownictwo o ilościach i rozmiarach'
    ],
    valueText: 'Wchodzisz poziom wyżej niż same podstawowe słówka i zaczynasz rozumieć język bardziej użytkowo.',
    hskNote: 'Wzmacnia podstawowe słownictwo związane z liczbami, czasem i codziennym użyciem języka.',
    nextStageText: 'W kolejnym etapie przejdziesz do jedzenia, zakupów i praktycznych codziennych sytuacji.',
    uiSummary: 'Po tym etapie lepiej rozumiesz liczby, dni, daty i podstawowe słownictwo związane z czasem.',
    lessons: [
      { id: 'time_days_dates', order: 1, name: 'Dni i daty',          summary: 'Podstawy kalendarza i dat.' },
      { id: 'time_hours',      order: 2, name: 'Godziny i pory dnia', summary: 'Słowa potrzebne do mówienia o czasie.' },
      { id: 'time_when',       order: 3, name: 'Kiedy?',              summary: 'Pytania i odpowiedzi związane z czasem.' },
      { id: 'time_where',      order: 4, name: 'Gdzie?',              summary: 'Podstawowe pytania o miejsce.' },
      { id: 'time_plan',       order: 5, name: 'Plan dnia',           summary: 'Słownictwo o planie i organizacji.' }
    ]
  },
  {
    id: 'food_daily_situations',
    order: 4,
    name: 'Jedzenie i sytuacje codzienne',
    shortLabel: 'Jedzenie i sytuacje',
    icon: '🥢',
    description: 'To etap bardzo praktyczny. Uczysz się słownictwa przydatnego w jedzeniu, zamawianiu i prostych codziennych sytuacjach.',
    canDo: [
      'Rozpoznawać podstawowe słowa związane z jedzeniem i piciem',
      'Lepiej rozumieć proste sytuacje zakupowe',
      'Kojarzyć słownictwo przy zamawianiu i codziennych wyborach',
      'Wyrażać najprostsze potrzeby i preferencje',
      'Czuć, że język ma realne zastosowanie poza samą nauką'
    ],
    valueText: 'Materiał staje się bardziej praktyczny i żywy, a słownictwo zaczyna mieć wyraźne zastosowanie.',
    hskNote: 'Praktyczne słownictwo codzienne — przygotowuje grunt pod dalsze poziomy.',
    nextStageText: 'Po tym etapie możesz przejść do rozszerzenia materiału i bardziej uporządkowanej ścieżki.',
    uiSummary: 'Po tym etapie rozumiesz więcej praktycznego słownictwa o jedzeniu, zakupach i prostej komunikacji.',
    lessons: [
      { id: 'food_food',        order: 1, name: 'Jedzenie',                summary: 'Słownictwo związane z jedzeniem.' },
      { id: 'food_drinks',      order: 2, name: 'Picie',                   summary: 'Podstawowe słowa o napojach.' },
      { id: 'food_ordering',    order: 3, name: 'Zamawianie',              summary: 'Zwroty przy zamawianiu.' },
      { id: 'food_shopping',    order: 4, name: 'Zakupy',                  summary: 'Podstawowe słownictwo sytuacyjne.' },
      { id: 'food_preferences', order: 5, name: 'Co lubię i czego chcę',   summary: 'Najprostsze potrzeby i preferencje.' }
    ]
  }
];

// ── Mapowanie sourceLesson → { stageId, lessonId } ────
var LESSON_STAGE_MAP = {
  // Nowe mikro-moduły etapu Start
  'lekcja_powitania':      { stageId: 'start', lessonId: 'start_greetings' },
  'lekcja_uprzejmosc':     { stageId: 'start', lessonId: 'start_courtesy' },
  'lekcja_przedstawianie': { stageId: 'start', lessonId: 'start_intro' },
  'lekcja_ja_i_inni':      { stageId: 'start', lessonId: 'start_pronouns' },
  // Stare numery lekcji — zachowane jako fallback lub dla reszty słówek
  '第一课':   { stageId: 'start',                 lessonId: 'start_greetings' },
  '第二课':   { stageId: 'start',                 lessonId: 'start_pronouns' },
  '第三课':   { stageId: 'start',                 lessonId: 'start_countries_languages' },
  '第四课':   { stageId: 'start',                 lessonId: 'start_basic_questions' },
  '第五课':   { stageId: 'daily_basics',          lessonId: 'daily_family' },
  '第六课':   { stageId: 'daily_basics',          lessonId: 'daily_verbs' },
  '第七课':   { stageId: 'start',                 lessonId: 'start_numbers' },
  '第八课':   { stageId: 'time_numbers',          lessonId: 'time_when' },
  '第九课':   { stageId: 'daily_basics',          lessonId: 'daily_verbs' },
  '第十课':   { stageId: 'food_daily_situations', lessonId: 'food_food' },
  '第十一课': { stageId: 'time_numbers',          lessonId: 'time_hours' },
  '第十二课': { stageId: 'daily_basics',          lessonId: 'daily_people' },
  '第十三课': { stageId: 'food_daily_situations', lessonId: 'food_ordering' },
  '第十四课': { stageId: 'food_daily_situations', lessonId: 'food_shopping' },
  '第十五课': { stageId: 'food_daily_situations', lessonId: 'food_ordering' },
  '第十六课': { stageId: 'time_numbers',          lessonId: 'time_plan' },
  '第十七课': { stageId: 'daily_basics',          lessonId: 'daily_people' },
  '第十八课': { stageId: 'food_daily_situations', lessonId: 'food_preferences' }
};

// ── Helpery ───────────────────────────────────────

function getWordStageId(w) {
  var m = LESSON_STAGE_MAP[(w.sourceLesson || '').trim()];
  return m ? m.stageId : null;
}

function getWordLessonId(w) {
  var m = LESSON_STAGE_MAP[(w.sourceLesson || '').trim()];
  return m ? m.lessonId : null;
}

function getStageById(stageId) {
  return COURSE_STAGES.find(function(s) { return s.id === stageId; }) || null;
}

function getStageWords(stageId) {
  return WORDS.filter(function(w) { return getWordStageId(w) === stageId; });
}

function getStageLessonWords(stageId, lessonId) {
  return WORDS.filter(function(w) {
    return getWordStageId(w) === stageId && getWordLessonId(w) === lessonId;
  });
}
