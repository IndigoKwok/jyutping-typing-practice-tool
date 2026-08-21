(() => {
  "use strict";

  const SESSION_OPTIONS = [5, 10, 15, 20];
  const SETTINGS_KEY = "jyutping-practice-settings";
  const STATS_KEY = "jyutping-practice-stats-v1";
  const MAJOR_TAGS = ["歌曲", "廣告", "電影", "流行文化", "電視劇"];
  const INITIALS = ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "ng", "h", "gw", "kw", "w", "z", "c", "s", "j"];
  const CODA_LIST = ["i", "u", "m", "n", "ng", "p", "t", "k"];
  const NUCLEI = new Set(["aa", "a", "e", "i", "o", "u", "oe", "eo", "yu"]);
  const FINAL_KEYS = Array.from(new Set([...Object.keys(FINAL_EXAMPLES), "a"]));
  const FINALS = new Set(FINAL_KEYS);
  const FINAL_GROUPS = [
    { label: "單元音", finals: ["aa", "a", "e", "i", "o", "u", "oe", "yu"] },
    { label: "複元音", finals: ["aai", "ai", "aau", "au", "ei", "eoi", "iu", "oi", "ou", "ui", "eu"] },
    { label: "鼻音<br>韻尾", finals: ["aam", "aan", "aang", "am", "an", "ang", "em", "eng", "im", "in", "ing", "m", "ng", "on", "ong", "eon", "oeng", "un", "ung", "yun"] },
    { label: "爆發音<br>韻尾", finals: ["aap", "aat", "aak", "ap", "at", "ak", "ep", "et", "ek", "ip", "it", "ik", "ot", "ok", "eot", "oet", "oek", "ut", "uk", "yut"] }
  ];
  const ACTIVE_BANK =
    typeof USER_SENTENCE_BANK !== "undefined" &&
    Array.isArray(USER_SENTENCE_BANK) &&
    USER_SENTENCE_BANK.length > 0
      ? USER_SENTENCE_BANK
      : SENTENCE_BANK;
  const VOCAB_CATS = Object.keys(FAANZYUN_VOCAB).concat(
    typeof EDB_VOCAB !== "undefined" ? Object.keys(EDB_VOCAB) : []
  );
  const SENTENCE_CATS = Object.keys(POLYU_SENTENCES);

  const BOOKS = [
    {
      id: "faanzyun-vocab",
      name: "翻轉粵語教室—詞彙篇",
      type: "vocab",
      chapters: ["問候", "稱謂", "日期與時間", "數字與貨幣", "量詞", "提問", "交通", "方位", "飲食", "購物"]
        .map((key) => ({ key, label: key }))
    },
    {
      id: "faanzyun-sentences",
      name: "翻轉粵語教室—句子篇",
      type: "sentences",
      chapters: ["提問", "交通", "方位", "飲食", "購物"]
        .map((key) => ({ key, label: key }))
    },
    {
      id: "laan-jam",
      name: "懶音診療室",
      type: "vocab",
      chapters: [
        { key: "聲母混讀：n/l", label: "聲母混讀：n/l" },
        { key: "聲母混讀：ng/零聲母", label: "聲母混讀：ng/零聲母" },
        { key: "聲母混讀：gw/kw 與 g/k", label: "聲母混讀：gw/kw 與 g/k" },
        { key: "韻母混讀：n/ng 韻尾", label: "韻母混讀：n/ng" },
        { key: "韻母混讀：t/k 韻尾", label: "韻母混讀：t/k" }
      ]
    },
    {
      id: "learnduck",
      name: "LearnDuck 粵拼打字入門",
      type: "vocab",
      chapters: ["家庭", "學校", "運動", "香港", "買東西", "醫院", "工作", "文化節日", "安全", "食物", "大自然", "數學", "社區生活", "政府部門", "權利", "認識自己", "口語用字"]
        .map((key) => ({ key, label: key }))
    },
    {
      id: "edb",
      name: "香港小學學習字詞表",
      type: "vocab",
      chapters: [
        { key: "小學-KS1", label: "KS1" },
        { key: "小學-KS2", label: "KS2" },
        { key: "小學-四字詞語", label: "四字詞語" },
        { key: "小學-多字熟語", label: "多字熟語" },
        { key: "小學-文言詞語", label: "文言詞語" },
        { key: "小學-專名術語", label: "專名術語" },
        { key: "小學-音譯外來詞語", label: "音譯外來詞語" },
        { key: "小學-人名地名用字", label: "人名地名用字" }
      ]
    },
    {
      id: "pop-culture",
      name: "流行文化",
      type: "tags",
      chapters: ["歌曲", "廣告", "電影", "流行文化", "電視劇"]
        .map((key) => ({ key, label: key }))
    },
    {
      id: "wrong-book",
      name: "錯詞本",
      type: "wrong",
      chapters: []
    }
  ];

  const WORD_MAP = (() => {
    const map = new Map();
    const addAll = (vocab) => {
      Object.keys(vocab).forEach((cat) => {
        vocab[cat].forEach((item) => {
          if (!map.has(item.word)) map.set(item.word, item);
        });
      });
    };
    addAll(FAANZYUN_VOCAB);
    if (typeof EDB_VOCAB !== "undefined") addAll(EDB_VOCAB);
    return map;
  })();

  function findBook(bookId) {
    return BOOKS.find((book) => book.id === bookId) || null;
  }

  function findChapterRef(bookId, chapterKey) {
    const book = findBook(bookId);
    if (!book) return null;
    const chapter = book.chapters.find((item) => item.key === chapterKey);
    return chapter ? { book, chapter } : null;
  }

  function locateChapter(legacyType, chapterKey) {
    for (const book of BOOKS) {
      if (book.type === "wrong") continue;
      if (legacyType === "vocab" && book.type !== "vocab") continue;
      const chapter = book.chapters.find((item) => item.key === chapterKey);
      if (chapter) return { book, chapter };
    }
    return null;
  }

  function wrongBookChapters() {
    return wrongBookGroups().map((group) => ({ key: group.label, label: group.label }));
  }

  function draftWrongChapters() {
    return wrongBookChapters();
  }

  function draftChapterLabel(draft) {
    if (!draft) return "";
    if (draft.bookId === "wrong-book") return "錯詞本";
    const ref = findChapterRef(draft.bookId, draft.chapter);
    return ref ? ref.chapter.label : "";
  }

  const app = document.getElementById("app");
  const state = {
    screen: "start",
    sentences: [],
    sentenceIndex: 0,
    charIndex: 0,
    currentInput: "",
    answers: [],
    records: [],
    correctCount: 0,
    totalCount: 0,
    locked: false,
    lastFeedback: null,
    settingsOpen: false,
    chapterOpen: false,
    chapterDraft: null
  };

  const phonemeWeights = { initials: [], finals: [], codas: [] };

  function defaultSettings() {
    return {
      bookId: "faanzyun-vocab",
      chapter: "問候",
      sentenceCount: 10,
      soundEnabled: true,
      theme: "light",
      wrongRemoveStreak: 3
    };
  }

  function loadSettings() {
    const defaults = defaultSettings();
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      let bookId = findBook(parsed.bookId) ? parsed.bookId : null;
      let chapter = parsed.chapter;
      if (!bookId || !findChapterRef(bookId, chapter)) {
        const legacyType = parsed.chapterType === "vocab" ? "vocab" : "sentences";
        const located = typeof chapter === "string" ? locateChapter(legacyType, chapter) : null;
        if (located) {
          bookId = located.book.id;
          chapter = located.chapter.key;
        } else {
          bookId = defaults.bookId;
          chapter = defaults.chapter;
        }
      }
      return {
        bookId,
        chapter,
        sentenceCount: parsed.sentenceCount === "inf" || SESSION_OPTIONS.includes(parsed.sentenceCount)
          ? parsed.sentenceCount
          : defaults.sentenceCount,
        soundEnabled: typeof parsed.soundEnabled === "boolean" ? parsed.soundEnabled : defaults.soundEnabled,
        theme: ["light", "dark", "system"].includes(parsed.theme) ? parsed.theme : defaults.theme,
        wrongRemoveStreak: [1, 3].includes(parsed.wrongRemoveStreak) ? parsed.wrongRemoveStreak : defaults.wrongRemoveStreak
      };
    } catch (e) {
      return defaults;
    }
  }

  let settings = loadSettings();

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {}
  }

  function loadStats() {
    const empty = { phonemes: { initials: {}, finals: {}, codas: {} }, words: {} };
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return empty;
      return {
        phonemes: {
          initials: parsed.phonemes && parsed.phonemes.initials || {},
          finals: parsed.phonemes && parsed.phonemes.finals || {},
          codas: parsed.phonemes && parsed.phonemes.codas || {}
        },
        words: parsed.words && typeof parsed.words === "object" ? parsed.words : {}
      };
    } catch (e) {
      return empty;
    }
  }

  let stats = loadStats();

  function saveStats() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  function clearStats() {
    stats = { phonemes: { initials: {}, finals: {}, codas: {} }, words: {} };
    try {
      localStorage.removeItem(STATS_KEY);
    } catch (e) {}
  }

  function tallyPhoneme(bucket, key, correct) {
    if (!key) return;
    const entry = stats.phonemes[bucket][key] || { r: 0, w: 0 };
    if (correct) entry.r += 1;
    else entry.w += 1;
    stats.phonemes[bucket][key] = entry;
  }

  function recordCharStats(expectedRaw, typedRaw) {
    const expected = parseSyllable(expectedRaw);
    const actual = parseSyllable(typedRaw);
    if (expected.initial) tallyPhoneme("initials", expected.initial, expected.initial === actual.initial);
    else if (actual.initial) tallyPhoneme("initials", "零聲母", false);
    if (expected.final) tallyPhoneme("finals", expected.final, expected.final === actual.final);
    if (expected.coda) tallyPhoneme("codas", expected.coda, expected.coda === actual.coda);
    saveStats();
  }

  function recordWordAttempt(word, correct, chapterLabel) {
    if (!word) return;
    const entry = stats.words[word] || { r: 0, w: 0, streak: 0, ch: "", at: 0 };
    if (correct) {
      entry.r += 1;
      entry.streak += 1;
    } else {
      entry.w += 1;
      entry.streak = 0;
      entry.ch = chapterLabel;
    }
    entry.at = Date.now();
    stats.words[word] = entry;
    saveStats();
  }

  function currentChapterRef() {
    if (settings.bookId === "wrong-book") {
      const book = findBook("wrong-book");
      const label = wrongBookGroups().length ? wrongBookGroups()[0].label : "錯詞本";
      return { book, chapter: { key: label, label: "錯詞本" } };
    }
    return findChapterRef(settings.bookId, settings.chapter) ||
      { book: findBook(defaultSettings().bookId), chapter: { key: defaultSettings().chapter, label: defaultSettings().chapter } };
  }

  function currentChapterLabel() {
    const ref = currentChapterRef();
    return ref.book.type === "wrong" ? "錯詞本" : ref.chapter.label;
  }

  function wordFinalsWeakness(item) {
    const jps = (item.chars || []).map((c) => c.jp).filter(Boolean);
    if (!jps.length) return 0.5;
    let sum = 0;
    jps.forEach((jp) => {
      const final = parseSyllable(jp).final;
      const entry = stats.phonemes.finals[final] || { r: 0, w: 0 };
      sum += (entry.w + 1) / (entry.r + entry.w + 2);
    });
    return sum / jps.length;
  }

  function itemWeight(item) {
    const unseen = stats.words[item.word || item.text] ? 1 : 3;
    return unseen * (1 + 6 * wordFinalsWeakness(item));
  }

  function drawWeighted(pool, count) {
    const picked = [];
    const work = pool.slice();
    while (picked.length < count && work.length) {
      let total = 0;
      const weights = work.map((item) => {
        const w = itemWeight(item);
        total += w;
        return w;
      });
      let roll = Math.random() * total;
      let index = 0;
      while (index < weights.length - 1) {
        roll -= weights[index];
        if (roll <= 0) break;
        index += 1;
      }
      picked.push(work.splice(index, 1)[0]);
    }
    return picked;
  }

  function wrongBookWords() {
    return Object.keys(stats.words).filter((word) => {
      const entry = stats.words[word];
      return entry.w >= 1 && entry.streak < settings.wrongRemoveStreak;
    });
  }

  function wrongBookGroups() {
    const groups = new Map();
    wrongBookWords().forEach((word) => {
      const label = stats.words[word].ch || "其他";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(word);
    });
    return [...groups.entries()]
      .map(([label, words]) => ({
        label,
        words: words.sort((a, b) => (stats.words[b].at || 0) - (stats.words[a].at || 0))
      }))
      .sort((a, b) => b.words.length - a.words.length || a.label.localeCompare(b.label));
  }

  function weakFinals(limit) {
    return Object.entries(stats.phonemes.finals)
      .map(([final, entry]) => ({
        final,
        r: entry.r,
        w: entry.w,
        weak: (entry.w + 1) / (entry.r + entry.w + 2)
      }))
      .filter((entry) => entry.r + entry.w >= 3)
      .sort((a, b) => b.weak - a.weak || b.w - a.w)
      .slice(0, limit);
  }

  function wordJpDisplay(word) {
    const item = WORD_MAP.get(word);
    if (!item) return "";
    return item.chars.map((c) => c.jp).filter(Boolean).join(" ");
  }

  function resolvedTheme() {
    if (settings.theme !== "system") return settings.theme;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme() {
    document.documentElement.dataset.theme = resolvedTheme();
  }

  function resetPhonemeWeights() {
    phonemeWeights.initials = INITIALS.map((phoneme) => ({ phoneme, weight: 0 }));
    phonemeWeights.finals = FINAL_KEYS.map((phoneme) => ({ phoneme, weight: 0 }));
    phonemeWeights.codas = CODA_LIST.map((phoneme) => ({ phoneme, weight: 0 }));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function isChineseChar(ch) {
    return /[\u3400-\u9FFF]/.test(ch);
  }

  function normalizeInput(raw) {
    return String(raw).trim().toLowerCase().replace(/[1-6]/g, "");
  }

  function splitFinal(final) {
    if (final === "m" || final === "ng") {
      return { nucleus: final, coda: "" };
    }
    const codas = CODA_LIST.slice().sort((a, b) => b.length - a.length);
    for (const coda of codas) {
      if (final.length > coda.length && final.endsWith(coda)) {
        const nucleus = final.slice(0, -coda.length);
        if (NUCLEI.has(nucleus)) {
          return { nucleus, coda };
        }
      }
    }
    return { nucleus: final, coda: "" };
  }

  function parseSyllable(raw) {
    const value = normalizeInput(raw);
    if (!value) {
      return { initial: "", final: "", nucleus: "", coda: "" };
    }
    if (value === "m" || value === "ng") {
      return { initial: "", final: value, nucleus: value, coda: "" };
    }
    let initial = "";
    let rest = value;
    const initials = INITIALS.slice().sort((a, b) => b.length - a.length);
    for (const ini of initials) {
      if (rest.startsWith(ini)) {
        initial = ini;
        rest = rest.slice(ini.length);
        break;
      }
    }
    const { nucleus, coda } = splitFinal(rest);
    return { initial, final: rest, nucleus, coda };
  }

  function initialMessage(expected, actual) {
    if (expected && !actual) {
      return `正確聲母 ${expected}，你冇打聲母。`;
    }
    if (!expected && actual) {
      return `呢個字冇聲母，你打咗 ${actual}。`;
    }
    const pairs = [
      ["n", "l"], ["g", "k"], ["gw", "g"], ["kw", "k"],
      ["z", "c"], ["c", "s"], ["z", "j"], ["b", "p"], ["d", "t"]
    ];
    const pair = pairs.find(
      ([a, b]) => (a === expected && b === actual) || (a === actual && b === expected)
    );
    if (pair) {
      return `正確 ${expected}，你輸入 ${actual}（${expected}/${actual} 混淆）`;
    }
    return `正確聲母 ${expected}，你輸入 ${actual}。`;
  }

  function finalMessage(expected, actual) {
    if (!actual.final) {
      return "你冇打韻母。";
    }
    if (!FINALS.has(actual.final)) {
      return `你輸入的 ${actual.final} 唔係有效粵拼韻母；正確應為 ${expected.final}。`;
    }
    if (expected.nucleus === actual.nucleus && expected.coda !== actual.coda) {
      const from = expected.coda || "冇韻尾";
      const to = actual.coda || "冇韻尾";
      return `正確韻尾 ${from}，你輸入 ${to}（${from}/${to} 混淆）`;
    }
    if (expected.coda === actual.coda && expected.nucleus !== actual.nucleus) {
      if (expected.nucleus === "aa" && actual.nucleus === "a") {
        return "正確長元音 aa，你輸入短元音 a（aa/a 長短元音錯誤）";
      }
      if (expected.nucleus === "a" && actual.nucleus === "aa") {
        return "正確短元音 a，你輸入長元音 aa（aa/a 長短元音錯誤）";
      }
      return `正確韻腹 ${expected.nucleus}，你輸入 ${actual.nucleus}。`;
    }
    return `正確韻母 ${expected.final}，你輸入 ${actual.final}。`;
  }

  function analyze(expectedRaw, typedRaw) {
    const expected = parseSyllable(expectedRaw);
    const actual = parseSyllable(typedRaw);
    const initialOk = expected.initial === actual.initial;
    const finalOk = expected.final === actual.final;
    const correct = initialOk && finalOk;

    if (correct) {
      return { correct: true, errorType: "正確", analysis: "" };
    }

    let errorType = "韻母錯誤";
    if (!initialOk && !finalOk) {
      errorType = "聲母及韻母錯誤";
    } else if (!initialOk) {
      errorType = "聲母錯誤";
    }

    const parts = [];
    if (!initialOk) {
      parts.push(initialMessage(expected.initial, actual.initial));
    }
    if (!finalOk) {
      parts.push(finalMessage(expected, actual));
    }

    return {
      correct: false,
      errorType,
      analysis: parts.join("；")
    };
  }

  function formatExamples(arr) {
    return arr.map((item) => `「${item}」`).join("、");
  }

  function parseSimple(raw) {
    const value = normalizeInput(raw);
    if (!value) return { initial: "", final: "" };
    if (FINAL_KEYS.includes(value)) return { initial: "", final: value };
    const initials = INITIALS.slice().sort((a, b) => b.length - a.length);
    for (const ini of initials) {
      if (value.startsWith(ini)) {
        const final = value.slice(ini.length);
        if (final.length > 0) return { initial: ini, final };
      }
    }
    return { initial: "", final: value };
  }

  function jSpecialTip(expectedInitial, actualInitial) {
    if ((expectedInitial === "j" && actualInitial === "") || (expectedInitial === "" && actualInitial === "j")) {
      return '粵拼入面，英文 "yes" 的 "y" 音係用「j」嚟表示嘅，例如【一】jat、【人】jan。';
    }
    return null;
  }

  function initialTip(expected, actual) {
    const typedInvalid = actual && !INITIALS.includes(actual);
    if (typedInvalid) {
      return expected
        ? `粵拼入面冇${actual}，我估你係指${expected}？`
        : `粵拼入面冇${actual}，呢個字冇聲母。`;
    }
    if (expected === actual) return null;
    if (!expected) return "呢個字冇聲母。";
    if (!actual) {
      const examples = INITIAL_EXAMPLES[expected] || [];
      return examples.length ? `呢個字係${expected}聲母，例如${formatExamples(examples)}。` : null;
    }
    const expectedExamples = INITIAL_EXAMPLES[expected] || [];
    const actualExamples = INITIAL_EXAMPLES[actual] || [];
    if (expectedExamples.length && actualExamples.length) {
      return `${expected}的例子有${formatExamples(expectedExamples)}，${actual}則是${formatExamples(actualExamples)}`;
    }
    return null;
  }

  function finalTip(expected, actual) {
    const typedInvalid = actual && !FINAL_KEYS.includes(actual);
    if (typedInvalid) {
      return `粵拼入面冇${actual}，我估你係指${expected}？`;
    }
    if (expected === actual) return null;
    const expectedExamples = FINAL_EXAMPLES[expected] || [];
    const actualExamples = FINAL_EXAMPLES[actual] || [];
    if (expectedExamples.length && actualExamples.length) {
      return `${expected}與${formatExamples(expectedExamples)}同韻，${actual}則與${formatExamples(actualExamples)}同韻`;
    }
    return null;
  }

  function buildTip(expectedRaw, typedRaw) {
    const expected = parseSimple(expectedRaw);
    const actual = parseSimple(typedRaw);
    const parts = [];
    const special = jSpecialTip(expected.initial, actual.initial);
    if (special) parts.push(special);
    const initial = initialTip(expected.initial, actual.initial);
    if (initial) parts.push(initial);
    const final = finalTip(expected.final, actual.final);
    if (final) parts.push(final);
    return parts.join(" ");
  }

  function adjustPhonemeWeights(expectedRaw, typedRaw) {
    const expected = parseSyllable(expectedRaw);
    const actual = parseSyllable(typedRaw);

    const adjust = (list, phoneme, delta) => {
      const item = list.find((entry) => entry.phoneme === phoneme);
      if (item) item.weight = Math.max(-4, Math.min(1, item.weight + delta));
    };

    if (expected.initial) {
      if (expected.initial === actual.initial) {
        adjust(phonemeWeights.initials, expected.initial, 2);
      } else {
        adjust(phonemeWeights.initials, expected.initial, -1);
        if (actual.initial && INITIALS.includes(actual.initial)) adjust(phonemeWeights.initials, actual.initial, -1);
      }
    }
    if (expected.final) {
      if (expected.final === actual.final) {
        adjust(phonemeWeights.finals, expected.final, 2);
      } else {
        adjust(phonemeWeights.finals, expected.final, -1);
        if (actual.final && FINALS.has(actual.final)) adjust(phonemeWeights.finals, actual.final, -1);
      }
    }
    if (expected.coda) {
      if (expected.coda === actual.coda) {
        adjust(phonemeWeights.codas, expected.coda, 2);
      } else {
        adjust(phonemeWeights.codas, expected.coda, -1);
        if (actual.coda && CODA_LIST.includes(actual.coda)) adjust(phonemeWeights.codas, actual.coda, -1);
      }
    }
  }

  function cellStyle(weight) {
    if (weight === 0) {
      return { bg: "var(--cell-bg)", fg: "var(--muted)", border: "var(--line)" };
    }
    const t = Math.min(Math.abs(weight) / 10, 1);
    if (weight > 0) {
      const light = Math.round(86 - 24 * t);
      return {
        bg: `hsl(145, 42%, ${light}%)`,
        fg: t > 0.55 ? "#fff" : "#1f7a45",
        border: "transparent"
      };
    }
    const light = Math.round(88 - 22 * t);
    return {
      bg: `hsl(4, 45%, ${light}%)`,
      fg: t > 0.55 ? "#fff" : "#a53a3a",
      border: "transparent"
    };
  }

  function cleanExample(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";
    const first = String(arr[0]);
    const head = first.indexOf("（") === -1 ? first : first.slice(0, first.indexOf("（"));
    const chars = head.match(/[\u3400-\u9fff]/g);
    return chars ? chars.join("") : "";
  }

  function phonemeChartHtml() {
    const rows = [
      { label: "聲母", items: phonemeWeights.initials, examples: INITIAL_EXAMPLES },
      ...FINAL_GROUPS.map((group) => ({
        label: group.label,
        items: group.finals
          .map((phoneme) => phonemeWeights.finals.find((item) => item.phoneme === phoneme))
          .filter(Boolean),
        examples: FINAL_EXAMPLES
      }))
    ];
    return `
      <section class="phoneme-chart" aria-label="聲母、韻母、韻尾強弱">
        ${rows.map((row) => `
          <div class="chart-row">
            <div class="chart-label">${row.label}</div>
            <div class="chart-cells">
              ${row.items.map((cell) => {
                const style = cellStyle(cell.weight);
                const example = cleanExample(row.examples[cell.phoneme]);
                const clickable = example ? " clickable" : "";
                const title = example ? `${cell.phoneme}・${example}` : cell.phoneme;
                return `<span class="chart-cell${clickable}"${example ? ` data-speak="${escapeHtml(example)}"` : ""} style="background:${style.bg};color:${style.fg};border-color:${style.border}" title="${escapeHtml(title)}">${cell.phoneme}</span>`;
              }).join("")}
            </div>
          </div>
        `).join("")}
      </section>
    `;
  }
  function currentSentence() {
    return state.sentences[state.sentenceIndex];
  }

  function currentChar() {
    return currentSentence().chars[state.charIndex];
  }

  function nextChineseIndex(sentence, fromIndex) {
    let index = fromIndex;
    while (index < sentence.chars.length && !isChineseChar(sentence.chars[index].c)) {
      index += 1;
    }
    return index;
  }

  function gearSvg() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    `;
  }

  function speakerSvg() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H2v6h4l5 4V5z"></path>
        <path d="M15.5 8.5a5 5 0 0 1 0 7"></path>
        <path d="M18.5 5.5a9 9 0 0 1 0 13"></path>
      </svg>
    `;
  }

  function headerHtml(progressLabel, showSettle) {
    return `
      <header class="topbar">
        <div class="brand"><span class="brand-mark">粵拼</span>打字練習</div>
        ${progressLabel ? `<div class="topbar-note">${progressLabel}</div>` : ""}
        <div class="topbar-actions">
          ${showSettle ? `<button type="button" class="icon-btn text-btn" id="settle-btn">結算</button>` : ""}
          <button type="button" class="icon-btn text-btn" id="chapter-btn">章節</button>
          <button type="button" class="icon-btn" id="settings-btn" aria-label="設定" title="設定">${gearSvg()}</button>
        </div>
      </header>
    `;
  }

  function bindHeader() {
    const chapterButton = document.getElementById("chapter-btn");
    if (chapterButton) {
      chapterButton.addEventListener("click", openChapterModal);
    }
    const settleButton = document.getElementById("settle-btn");
    if (settleButton) {
      settleButton.addEventListener("click", settleSession);
    }
    const button = document.getElementById("settings-btn");
    if (button) {
      button.addEventListener("click", () => {
        state.settingsOpen = true;
        render();
      });
    }
  }

  function settingsHtml() {
    const countOptions = SESSION_OPTIONS.map((n) =>
      `<option value="${n}" ${settings.sentenceCount === n ? "selected" : ""}>${n} 句</option>`
    ).join("") + `<option value="inf" ${settings.sentenceCount === "inf" ? "selected" : ""}>無限（隨時結算）</option>`;
    const themes = [["light", "淺色"], ["dark", "深色"], ["system", "系統"]];
    const themeButtons = themes.map(([value, label]) =>
      `<button type="button" data-theme="${value}" class="${settings.theme === value ? "active" : ""}">${label}</button>`
    ).join("");
    return `
      <div class="modal-backdrop" data-close-settings>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="modal-head">
            <h2 id="settings-title">設定</h2>
            <button type="button" class="modal-close" data-close-settings aria-label="關閉">×</button>
          </div>
          <div class="setting-row">
            <label for="setting-count">每輪句數</label>
            <select id="setting-count">${countOptions}</select>
          </div>
          <div class="setting-row">
            <span>聲音</span>
            <label class="switch">
              <input type="checkbox" id="setting-sound" ${settings.soundEnabled ? "checked" : ""}>
              <span class="switch-track"></span>
            </label>
          </div>
          <div class="setting-row">
            <span>主題</span>
            <div class="segmented" id="setting-theme">${themeButtons}</div>
          </div>
          <div class="setting-row">
            <span>錯詞移出</span>
            <div class="segmented" id="setting-streak">
              <button type="button" data-streak="1" class="${settings.wrongRemoveStreak === 1 ? "active" : ""}">連對 1 次</button>
              <button type="button" data-streak="3" class="${settings.wrongRemoveStreak === 3 ? "active" : ""}">連對 3 次</button>
            </div>
          </div>
          <div class="setting-row">
            <span>學習進度</span>
            <button type="button" class="btn-ghost danger" id="reset-stats">清空本地學習進度</button>
          </div>
        </div>
      </div>
    `;
  }

  function chapterModalHtml() {
    const draft = state.chapterDraft || { bookId: settings.bookId, chapter: settings.chapter };
    const fallbackBook = findBook(settings.bookId) || BOOKS[0];
    const legacyType = draft.legacyType || (fallbackBook.type === "vocab" ? "vocab" : "sentences");
    const pool = BOOKS.filter((item) =>
      legacyType === "vocab" ? item.type === "vocab" || item.type === "wrong" : item.type !== "vocab" && item.type !== "wrong"
    );
    const book = (draft.bookId && pool.find((item) => item.id === draft.bookId)) || pool[0];
    const chapters = book.type === "wrong" ? draftWrongChapters() : book.chapters;
    draft.legacyType = legacyType;
    draft.bookId = book.id;
    const bookOptions = pool.map((item) =>
      `<option value="${escapeHtml(item.id)}" ${item.id === book.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");
    const options = chapters.map((chapter) => ({ value: chapter.key, label: chapter.label }));
    const chapterSelect = options.map((option) =>
      `<option value="${escapeHtml(option.value)}" ${draft.chapter === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
    ).join("");
    return `
      <div class="modal-backdrop" data-close-chapter>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="chapter-title">
          <div class="modal-head">
            <h2 id="chapter-title">章節選擇</h2>
            <button type="button" class="modal-close" data-close-chapter aria-label="關閉">×</button>
          </div>
          <div class="setting-row">
            <span>學習類型</span>
            <div class="segmented" id="chapter-type">
              <button type="button" data-chapter-type="sentences" class="${legacyType === "sentences" ? "active" : ""}">學習句子</button>
              <button type="button" data-chapter-type="vocab" class="${legacyType === "vocab" ? "active" : ""}">學習詞彙</button>
            </div>
          </div>
          <div class="setting-row">
            <label for="book-select">詞書</label>
            <select id="book-select">${bookOptions}</select>
          </div>
          <div class="setting-row">
            <label for="chapter-select">章節</label>
            <select id="chapter-select">${chapterSelect}</select>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" data-close-chapter>取消</button>
            <button type="button" class="btn-primary" id="chapter-confirm">確定</button>
          </div>
        </div>
      </div>
    `;
  }

  function openChapterModal() {
    state.chapterDraft = { bookId: settings.bookId, chapter: settings.chapter };
    state.chapterOpen = true;
    render();
  }

  function bindChapterModal() {
    document.querySelectorAll("[data-close-chapter]").forEach((el) => {
      if (el.classList.contains("modal-backdrop")) return;
      el.addEventListener("click", () => {
        state.chapterOpen = false;
        state.chapterDraft = null;
        render();
      });
    });
    const backdrop = document.querySelector(".modal-backdrop[data-close-chapter]");
    if (backdrop) {
      backdrop.addEventListener("mousedown", (event) => {
        if (event.target === backdrop) {
          state.chapterOpen = false;
          state.chapterDraft = null;
          render();
        }
      });
    }
    document.querySelectorAll("#chapter-type button").forEach((button) => {
      button.addEventListener("click", () => {
        const draft = state.chapterDraft;
        draft.legacyType = button.dataset.chapterType;
        const pool = BOOKS.filter((book) =>
          book.type === "wrong" ? false : draft.legacyType === "vocab" ? book.type === "vocab" : book.type !== "vocab"
        );
        if (!pool.some((book) => book.id === draft.bookId)) {
          draft.bookId = pool[0].id;
        }
        const book = findBook(draft.bookId);
        const chapters = book.type === "wrong" ? draftWrongChapters() : book.chapters;
        if (!chapters.some((chapter) => chapter.key === draft.chapter)) {
          draft.chapter = chapters.length ? chapters[0].key : null;
        }
        render();
      });
    });
    const bookSelect = document.getElementById("book-select");
    if (bookSelect) {
      bookSelect.addEventListener("change", () => {
        const draft = state.chapterDraft;
        draft.bookId = bookSelect.value;
        const book = findBook(draft.bookId);
        const chapters = book.type === "wrong" ? draftWrongChapters() : book.chapters;
        draft.chapter = chapters.length ? chapters[0].key : null;
        render();
      });
    }
    const chapterSelect = document.getElementById("chapter-select");
    if (chapterSelect) {
      chapterSelect.addEventListener("change", () => {
        state.chapterDraft.chapter = chapterSelect.value;
      });
    }
    const confirmButton = document.getElementById("chapter-confirm");
    if (confirmButton) {
      confirmButton.addEventListener("click", () => {
        if (state.chapterDraft.chapter == null) return;
        settings.bookId = state.chapterDraft.bookId;
        settings.chapter = state.chapterDraft.chapter;
        saveSettings();
        state.chapterOpen = false;
        state.chapterDraft = null;
        if (state.screen === "practice") {
          startSession();
        } else {
          render();
        }
      });
    }
  }

  function bindSettings() {
    document.querySelectorAll("[data-close-settings]").forEach((el) => {
      if (el.classList.contains("modal-backdrop")) return;
      el.addEventListener("click", () => {
        state.settingsOpen = false;
        render();
      });
    });
    const backdrop = document.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.addEventListener("mousedown", (event) => {
        if (event.target === backdrop) {
          state.settingsOpen = false;
          render();
        }
      });
    }
    const count = document.getElementById("setting-count");
    if (count) {
      count.addEventListener("change", () => {
        settings.sentenceCount = count.value === "inf" ? "inf" : Number(count.value);
        saveSettings();
        if (state.screen === "practice") {
          startSession();
        } else {
          render();
        }
      });
    }
    document.querySelectorAll("#setting-streak button").forEach((button) => {
      button.addEventListener("click", () => {
        settings.wrongRemoveStreak = Number(button.dataset.streak);
        saveSettings();
        render();
      });
    });
    const resetButton = document.getElementById("reset-stats");
    if (resetButton) {
      resetButton.addEventListener("click", () => {
        if (window.confirm("確定清空所有本地學習進度？（韻母統計、錯詞本都會消失，唔可以還原）")) {
          clearStats();
          render();
        }
      });
    }
    const sound = document.getElementById("setting-sound");
    if (sound) {
      sound.addEventListener("change", () => {
        settings.soundEnabled = sound.checked;
        saveSettings();
      });
    }
    document.querySelectorAll("#setting-theme button").forEach((button) => {
      button.addEventListener("click", () => {
        settings.theme = button.dataset.theme;
        saveSettings();
        applyTheme();
        render();
      });
    });
  }

  function buildSessionBank() {
    const ref = currentChapterRef();
    const { book, chapter } = ref;
    if (book.type === "wrong") {
      return wrongBookWords()
        .map((word) => WORD_MAP.get(word))
        .filter(Boolean)
        .map((item) => ({ text: item.word, chars: item.chars, word: item.word }));
    }
    if (book.type === "vocab") {
      const vocabChapter =
        FAANZYUN_VOCAB[chapter.key] ||
        (typeof EDB_VOCAB !== "undefined" ? EDB_VOCAB[chapter.key] : null) ||
        [];
      return vocabChapter.map((item) => ({
        text: item.word,
        chars: item.chars,
        word: item.word
      }));
    }
    if (book.type === "sentences") {
      const bank = POLYU_SENTENCES[chapter.key] || [];
      return bank.map((item) => ({
        text: item.sentence,
        chars: item.chars
      }));
    }
    return ACTIVE_BANK.filter((sentence) => (sentence.tags || []).includes(chapter.key));
  }

  function speakChinese(text) {
    if (!text) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const findVoice = () => {
      const voices = synth.getVoices() || [];
      const score = (voice) => {
        const lang = (voice.lang || "").toLowerCase();
        const name = (voice.name || "").toLowerCase();
        let value = 0;
        if (lang.startsWith("yue") || lang.includes("zh-hk") || lang.includes("zh_hk")) value += 100;
        if (/cantonese/.test(name)) value += 50;
        if (/yue/.test(name)) value += 30;
        if (/heung-yee|sin-ji/.test(name)) value += 30;
        if (/hong ?kong/.test(name) && !lang.startsWith("en")) value += 20;
        if (lang.startsWith("zh") && !lang.includes("cn")) value += 10;
        return value;
      };
      const candidates = voices
        .filter((voice) => !(voice.lang || "").toLowerCase().startsWith("en"))
        .sort((a, b) => score(b) - score(a));
      return candidates[0] && score(candidates[0]) > 0 ? candidates[0] : null;
    };
    const speak = () => {
      const voice = findVoice();
      const utterance = new SpeechSynthesisUtterance(text);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || "zh-HK";
      } else {
        utterance.lang = "zh-HK";
      }
      synth.cancel();
      synth.speak(utterance);
    };
    if (findVoice()) {
      speak();
    } else {
      synth.addEventListener("voiceschanged", speak, { once: true });
      setTimeout(speak, 250);
    }
  }

  function startSession() {
    resetPhonemeWeights();
    const bank = buildSessionBank();
    const ref = currentChapterRef();
    const infinite = settings.sentenceCount === "inf" || ref.book.type === "wrong";
    const weighted = ref.book.type === "vocab" || ref.book.type === "wrong";
    state.sessionInfinite = infinite;
    if (!bank.length) {
      state.screen = "start";
      render();
      return;
    }
    const batchSize = infinite
      ? Math.min(20, bank.length)
      : Math.min(settings.sentenceCount, bank.length);
    state.screen = "practice";
    state.sessionPool = weighted ? bank.slice() : shuffle(bank);
    state.drawNext = () => {
      if (!state.sessionPool.length) {
        state.sessionPool = weighted ? bank.slice() : shuffle(bank);
      }
      const take = Math.min(infinite ? 20 : settings.sentenceCount, state.sessionPool.length);
      if (weighted) {
        const picked = drawWeighted(state.sessionPool, take);
        const rest = state.sessionPool.filter((item) => !picked.includes(item));
        state.sessionPool = rest;
        return picked;
      }
      return state.sessionPool.splice(0, take);
    };
    state.sentences = state.drawNext();
    state.sentenceIndex = 0;
    state.charIndex = 0;
    state.currentInput = "";
    state.answers = [];
    state.records = [];
    state.correctCount = 0;
    state.totalCount = 0;
    state.locked = false;
    state.lastFeedback = null;
    render();
  }

  function renderStart() {
    app.innerHTML = `
      ${headerHtml("")}
      <main class="start">
        <h1>粵拼打字練習</h1>
        <p class="subtitle">睇住句子逐字打粵拼，唔使打聲調。</p>
        <button id="start-btn" class="btn-primary" type="button">開始練習</button>
        <button id="report-btn" class="btn-ghost" type="button">學習報告</button>
      </main>
    `;
    bindHeader();
    document.getElementById("start-btn").addEventListener("click", startSession);
    document.getElementById("report-btn").addEventListener("click", () => {
      state.screen = "report";
      render();
    });
  }

  function settleSession() {
    state.screen = "results";
    renderResults();
  }

  function renderPractice() {
    const sentence = currentSentence();
    const chineseCount = sentence.chars.filter((item) => isChineseChar(item.c)).length;
    const answeredCount = state.answers.filter(Boolean).length;
    const progress = state.sessionInfinite
      ? (answeredCount / Math.max(chineseCount, 1)) * 100
      : (
          (state.sentenceIndex + answeredCount / Math.max(chineseCount, 1)) /
          state.sentences.length
        ) * 100;

    const cells = sentence.chars.map((item, index) => {
      if (!isChineseChar(item.c)) {
        const className = /[A-Za-z0-9]/.test(item.c) ? "inline-text" : "punct";
        return `<span class="${className}">${escapeHtml(item.c)}</span>`;
      }
      const answer = state.answers[index];
      let className = "char-cell";
      let slot = "";
      let full = "";
      if (answer) {
        className += answer.correct ? " ok" : " bad";
        slot = escapeHtml(answer.typed);
        full = `<div class="full-jp">${answer.correct ? "✓" : "✗"} ${escapeHtml(answer.expected)}</div>`;
      } else if (index === state.charIndex) {
        className += " current";
        slot = escapeHtml(state.currentInput);
      }
      return `
        <div class="${className}">
          <div class="slot">${slot}</div>
          <button type="button" class="char-btn" data-char-index="${index}" aria-label="聽 ${escapeHtml(item.c)} 的發音">${escapeHtml(item.c)}</button>
          ${full}
        </div>
      `;
    }).join("");

    const feedback = state.lastFeedback
      ? `
        <div class="feedback ${state.lastFeedback.correct ? "ok" : "bad"}">
          ${state.lastFeedback.correct
            ? `✓ 正確：${escapeHtml(state.lastFeedback.expected)}`
            : `✗ 正確：${escapeHtml(state.lastFeedback.expected)} · ${escapeHtml(state.lastFeedback.errorType)}`}
          ${state.lastFeedback.correct
            ? ""
            : `<div class="analysis">${escapeHtml(state.lastFeedback.tip || state.lastFeedback.analysis)}</div>`}
        </div>
      `
      : "";

    const progressNote = state.sessionInfinite
      ? `無限 · 第 ${state.sessionDone + 1} 句`
      : `第 ${state.sentenceIndex + 1} / ${state.sentences.length} 句`;
    app.innerHTML = `
      ${headerHtml(progressNote, true)}
      <main class="practice">
        <div class="progress-row">
          <span>字 ${Math.min(answeredCount + 1, chineseCount)} / ${chineseCount}</span>
          <span>答對 ${state.correctCount} / ${state.totalCount}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.min(progress, 100)}%"></div></div>
        ${phonemeChartHtml()}
        <section class="sentence-panel">
          <div class="keyboard-hint">
          <button type="button" class="btn-icon" id="speak-btn" aria-label="聽發音" title="聽發音">${speakerSvg()}</button>
        </div>
          
          <div class="sentence">${cells}</div>
          <div class="feedback-slot">
            ${feedback}
          </div>
        
        </section>
      </main>
    `;

    bindHeader();
    const speakBtn = document.getElementById("speak-btn");
    if (speakBtn) {
      speakBtn.addEventListener("click", () => speakChinese(currentSentence().text));
    }
    document.querySelectorAll(".chart-cell.clickable").forEach((el) => {
      el.addEventListener("click", () => speakChinese(el.dataset.speak));
    });
  }

  function summarizeRecords(records) {
    const charMap = new Map();
    const initialMap = new Map();
    const finalMap = new Map();
    const tally = (map, key, correct, wrong) => {
      if (!map.has(key)) map.set(key, { count: 0, correct, wrong });
      map.get(key).count += 1;
    };

    for (const record of records) {
      if (!charMap.has(record.char)) {
        charMap.set(record.char, { count: 0, jyutpings: new Set(), sentences: new Set() });
      }
      const charInfo = charMap.get(record.char);
      charInfo.count += 1;
      charInfo.jyutpings.add(record.expected);
      if (record.sentence) charInfo.sentences.add(record.sentence);

      const expected = parseSyllable(record.expected);
      const actual = parseSyllable(record.typed);

      if (expected.initial !== actual.initial) {
        tally(initialMap, `${expected.initial || "∅"} → ${actual.initial || "∅"}`, expected.initial, actual.initial);
      }
      if (expected.final !== actual.final || expected.coda !== actual.coda) {
        let label = `${expected.final || "∅"} → ${actual.final || "∅"}`;
        if (expected.nucleus !== actual.nucleus) {
          label += `（${expected.nucleus || "∅"} → ${actual.nucleus || "∅"}）`;
        }
        tally(finalMap, label, expected.final, actual.final);
        if (expected.coda !== actual.coda) {
          tally(finalMap, `${expected.coda || "∅"} → ${actual.coda || "∅"}`, expected.final, actual.final);
        }
      }
    }

    const exampleChar = (arr) => (Array.isArray(arr) ? arr : []).find((ch) => /[\u3400-\u9fff]/.test(ch));
    const toItems = (map, exampleMap) => [...map.entries()]
      .map(([label, value]) => ({
        label,
        count: value.count,
        correct: { key: value.correct || "", char: exampleChar(exampleMap[value.correct] || []) },
        wrong: { key: value.wrong || "", char: exampleChar(exampleMap[value.wrong] || []) }
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const chars = [...charMap.entries()]
      .map(([char, info]) => ({ char, count: info.count, jyutpings: [...info.jyutpings], sentences: [...info.sentences] }))
      .sort((a, b) => b.count - a.count || a.char.localeCompare(b.char));

    return {
      chars,
      initials: toItems(initialMap, INITIAL_EXAMPLES),
      finals: toItems(finalMap, FINAL_EXAMPLES)
    };
  }

  function patternRows(list) {
    if (!list.length) return "";
    const example = (side, tag) => {
      if (!side) return "";
      const key = side.key ? escapeHtml(side.key) : "零聲母";
      const char = side.char ? escapeHtml(side.char) : "";
      const speak = side.char ? `<button type="button" class="mini-speak" data-sentence="${escapeHtml(side.char)}" aria-label="聽「${escapeHtml(side.char)}」的發音" title="聽「${escapeHtml(side.char)}」的發音">${speakerSvg()}</button>` : "";
      return `<span class="px-side">${escapeHtml(tag)}</span><span class="px-key">${key}</span>${char ? `<span class="px-char">${char}</span>` : ""}${speak}`;
    };
    return `
      <div class="pattern-list">
        ${list.map((item) => `
          <div class="pattern-row">
            <span class="pattern">${escapeHtml(item.label)}</span>
            <span class="pattern-count">×${item.count}</span>
            <span class="pattern-example">
              <span class="px-item">${example(item.correct, "正")}</span>
              <span class="px-item">${example(item.wrong, "你讀")}</span>
            </span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderResults() {
    const wrong = state.records;

    if (!wrong.length) {
      app.innerHTML = `
        ${headerHtml("完成")}
        <main class="results">
          <p class="all-correct">全部正確</p>
          <button id="retry-btn" class="btn-primary" type="button">再練一次</button>
        </main>
      `;
      bindHeader();
      document.getElementById("retry-btn").addEventListener("click", startSession);
      return;
    }

    const accuracy = state.totalCount ? Math.round((state.correctCount / state.totalCount) * 100) : 100;
    const summary = summarizeRecords(wrong);

    const charChips = summary.chars.map((item) => `
      <span class="chip">
        <span class="chip-char">${escapeHtml(item.char)}</span>
        <span class="chip-count">×${item.count}</span>
        <span class="chip-jp">${item.jyutpings.map((jp) => escapeHtml(jp)).join(" / ")}</span>
        <button type="button" class="mini-speak" data-sentence="${escapeHtml(item.sentences[0] || "")}" aria-label="聽 ${escapeHtml(item.char)} 的發音">${speakerSvg()}</button>
      </span>
    `).join("");

    const recordsHtml = `
      <section class="records">
        <h2>錯誤記錄</h2>
        <div class="record-head">
          <span>字</span><span>你的輸入</span><span>正確 Jyutping</span><span>錯誤類型</span><span>音系分析</span>
        </div>
        ${wrong.map((item) => `
          <div class="record-row">
            <span class="char">${escapeHtml(item.char)}</span>
            <span class="jp">${escapeHtml(item.typedRaw)}</span>
            <span class="jp">${escapeHtml(item.expected)}</span>
            <span class="type">${escapeHtml(item.errorType)}</span>
            <span class="analysis">
              ${item.tip ? `<span class="tip-line">${escapeHtml(item.tip)}</span>` : ""}
              <span class="analysis-line">${escapeHtml(item.analysis)}</span>
            </span>
          </div>
        `).join("")}
      </section>
    `;

    app.innerHTML = `
      ${headerHtml("完成")}
      <main class="results">
        <h1>練習結果</h1>
        <div class="score">
          <div class="score-num">${accuracy}%</div>
          <div class="score-label">正確率</div>
        </div>
        <div class="score-meta">答對 ${state.correctCount} / ${state.totalCount} 字</div>
        <section class="summary">
          <h2>錯誤總結</h2>
          <div class="summary-block">
            <h3>打錯的漢字</h3>
            <div class="chip-list">${charChips}</div>
          </div>
          ${summary.initials.length ? `
            <div class="summary-block">
              <h3>聲母弱點</h3>
              ${patternRows(summary.initials)}
            </div>
          ` : ""}
          ${summary.finals.length ? `
            <div class="summary-block">
              <h3>韻母／韻尾弱點</h3>
              ${patternRows(summary.finals)}
            </div>
          ` : ""}
        </section>
        ${recordsHtml}
        <button id="retry-btn" class="btn-primary" type="button">再練一次</button>
      </main>
    `;

    bindHeader();
    document.querySelectorAll(".mini-speak").forEach((button) => {
      button.addEventListener("click", () => speakChinese(button.dataset.sentence));
    });
    document.getElementById("retry-btn").addEventListener("click", startSession);
  }

  function renderReport() {
    const weak = weakFinals(10);
    const groups = wrongBookGroups();
    if (!state.reportExpanded) state.reportExpanded = new Set();

    const weakRows = weak.map((entry) => {
      const example = cleanExample(FINAL_EXAMPLES[entry.final]);
      const pct = Math.round(entry.weak * 100);
      return `
        <div class="weak-row">
          <button type="button" class="weak-cell" data-speak="${escapeHtml(example || "")}" ${example ? "" : "disabled"} title="${escapeHtml(example ? `${entry.final}・${example}` : entry.final)}">${escapeHtml(entry.final)}</button>
          <div class="weak-bar"><div class="weak-fill" style="width:${pct}%"></div></div>
          <span class="weak-meta">${pct}% · 錯 ${entry.w} / 計 ${entry.r + entry.w}</span>
        </div>
      `;
    }).join("");

    const groupHtml = groups.length ? groups.map((group) => {
      const open = state.reportExpanded.has(group.label);
      const items = open
        ? group.words.map((word) => `
            <div class="wrong-item">
              <button type="button" class="wrong-word" data-speak="${escapeHtml(word)}">${escapeHtml(word)}</button>
              <span class="wrong-jp">${escapeHtml(wordJpDisplay(word))}</span>
              <span class="wrong-count">錯 ${stats.words[word].w} 次</span>
            </div>
          `).join("")
        : "";
      return `
        <div class="wrong-group">
          <button type="button" class="wrong-head" data-group="${escapeHtml(group.label)}">
            <span>${escapeHtml(group.label)}</span>
            <span class="wrong-head-count">${group.words.length} 詞 ${open ? "▲" : "▼"}</span>
          </button>
          ${open ? `<div class="wrong-list">${items}</div>` : ""}
        </div>
      `;
    }).join("") : '<p class="report-empty">而家冇錯詞，繼續保持！</p>';

    app.innerHTML = `
      ${headerHtml("學習報告")}
      <main class="report">
        <h1>學習報告</h1>
        <section class="report-card">
          <h2>薄弱韻母 Top 10</h2>
          ${weak.length ? `<div class="weak-list">${weakRows}</div>` : '<p class="report-empty">仲未夠數據，每個韻母練夠 3 次先會上榜。</p>'}
        </section>
        <section class="report-card">
          <h2>錯詞本</h2>
          ${groupHtml}
          <button type="button" class="btn-primary" id="wrongbook-start-btn" ${groups.length ? "" : "disabled"}>錯詞複習（無限）</button>
        </section>
        <button id="report-back-btn" class="btn-ghost" type="button">返回主頁</button>
      </main>
    `;

    bindHeader();
    app.querySelectorAll("[data-speak]").forEach((el) => {
      el.addEventListener("click", () => speakChinese(el.dataset.speak));
    });
    app.querySelectorAll(".wrong-head").forEach((el) => {
      el.addEventListener("click", () => {
        const label = el.dataset.group;
        if (state.reportExpanded.has(label)) state.reportExpanded.delete(label);
        else state.reportExpanded.add(label);
        render();
      });
    });
    const wrongBtn = document.getElementById("wrongbook-start-btn");
    if (wrongBtn && groups.length) {
      wrongBtn.addEventListener("click", () => {
        settings.bookId = "wrong-book";
        settings.chapter = groups[0].label;
        saveSettings();
        startSession();
      });
    }
    document.getElementById("report-back-btn").addEventListener("click", () => {
      state.screen = "start";
      render();
    });
  }

  function render() {
    document.body.dataset.screen = state.screen;
    document.body.dataset.modal = state.settingsOpen || state.chapterOpen ? "open" : "none";
    if (state.screen === "start") {
      renderStart();
    } else if (state.screen === "report") {
      renderReport();
    } else if (state.screen === "practice") {
      renderPractice();
    } else {
      renderResults();
    }
    if (state.settingsOpen) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = settingsHtml();
      app.appendChild(wrapper.firstElementChild);
      bindSettings();
    } else if (state.chapterOpen) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = chapterModalHtml();
      app.appendChild(wrapper.firstElementChild);
      bindChapterModal();
    }
  }

  function updateSlot() {
    const slot = document.querySelector(".char-cell.current .slot");
    if (slot) slot.textContent = state.currentInput;
  }

  function submit() {
    if (state.locked) return;
    const char = currentChar();
    if (!char || !char.jp) {
      advance();
      return;
    }
    const typedRaw = state.currentInput.trim().toLowerCase();
    const typed = normalizeInput(typedRaw);
    if (!typed) return;

    const result = analyze(char.jp, typed);
    const tip = buildTip(char.jp, typed);
    recordCharStats(char.jp, typed);
    const record = {
      char: char.c,
      typedRaw,
      typed,
      expected: char.jp,
      correct: result.correct,
      errorType: result.errorType,
      analysis: result.analysis,
      tip
    };

    state.answers[state.charIndex] = record;
    state.totalCount += 1;
    if (result.correct) {
      state.correctCount += 1;
    } else {
      state.records.push({ ...record, sentence: currentSentence().text });
    }
    adjustPhonemeWeights(char.jp, typed);
    state.lastFeedback = record;
    state.locked = true;

    renderPractice();
  }

  function advance() {
    const sentence = currentSentence();
    const next = nextChineseIndex(sentence, state.charIndex + 1);
    if (next < sentence.chars.length) {
      state.charIndex = next;
      state.currentInput = "";
      state.locked = false;
      state.lastFeedback = null;
      renderPractice();
      return;
    }

    if (sentence.word) {
      const answered = sentence.chars
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => isChineseChar(item.c) && item.jp);
      const allCorrect = answered.every(({ index }) => state.answers[index] && state.answers[index].correct);
      recordWordAttempt(sentence.word, allCorrect, currentChapterLabel());
    }
    if (settings.soundEnabled) speakChinese(sentence.text);
    state.sentenceIndex += 1;
    state.sessionDone = (state.sessionDone || 0) + 1;
    if (state.sentenceIndex >= state.sentences.length) {
      if (state.sessionInfinite) {
        state.sentences = state.drawNext();
        state.sentenceIndex = 0;
      } else {
        state.screen = "results";
        renderResults();
        return;
      }
    }

    state.charIndex = 0;
    state.currentInput = "";
    state.answers = [];
    state.locked = false;
    state.lastFeedback = null;
    renderPractice();
  }

  function handleGlobalKeydown(event) {
    if (state.chapterOpen) {
      if (event.key === "Escape") {
        state.chapterOpen = false;
        state.chapterDraft = null;
        render();
      }
      return;
    }
    if (state.settingsOpen) {
      if (event.key === "Escape") {
        state.settingsOpen = false;
        render();
      }
      return;
    }
    if (state.screen !== "practice") return;

    if (state.locked) {
      if (/^[a-z0-9]$/i.test(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        const key = event.key.toLowerCase();
        advance();
        state.currentInput = key;
        updateSlot();
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        advance();
      }
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      state.currentInput = state.currentInput.slice(0, -1);
      updateSlot();
      return;
    }
    if (/^[a-z0-9]$/i.test(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      state.currentInput += event.key.toLowerCase();
      updateSlot();
    }
  }

  applyTheme();
  resetPhonemeWeights();
  window.addEventListener("keydown", handleGlobalKeydown);
  render();
})();

