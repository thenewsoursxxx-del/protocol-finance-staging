const tg = window.Telegram?.WebApp;
tg?.expand();

// AUTO: Надёжное сохранение chat_id для уведомлений в бот-чат
// IMPORTANT: use user.id because we send private messages to the user-bot chat
// (chat.id может быть ID группы, в которую бот не имеет доступа).
//
// Идемпотентность: saveUserChatId делает upsert по telegram_id, поэтому
// многократные вызовы безопасны - последний всегда выигрывает.
const ensureChatIdSaved = () => {
  if (!tg?.initDataUnsafe?.user) return;

  const telegramId = tg.initDataUnsafe.user.id;
  const chatId = telegramId; // для личных сообщений chat_id = user.id

  console.log(
    '%c[ChatID] Автоматически сохраняем chat_id:',
    'color: #10b981; font-weight: bold',
    chatId
  );

  if (typeof window.saveUserChatId === 'function') {
    window.saveUserChatId(chatId);
  } else {
    console.warn('[ChatID] saveUserChatId ещё не загружена, пробуем через 500ms...');
    setTimeout(() => {
      if (typeof window.saveUserChatId === 'function') {
        window.saveUserChatId(chatId);
      } else {
        console.error('[ChatID] saveUserChatId всё ещё недоступна - supabase.js не загрузился');
      }
    }, 500);
  }
};

// Вызываем сразу и после готовности WebApp
ensureChatIdSaved();
if (tg) {
  try { tg.ready(); } catch (e) { console.warn('[ChatID] tg.ready() кинул:', e); }
  // tg.onEvent поддерживает не все строки - оборачиваем в try/catch,
  // чтобы возможный throw не остановил выполнение последующих setTimeout'ов.
  try { tg.onEvent('ready', ensureChatIdSaved); } catch (e) {
    console.warn('[ChatID] tg.onEvent("ready") не поддерживается:', e);
  }
  // Дополнительно - на всякий случай
  setTimeout(ensureChatIdSaved, 800);
  setTimeout(ensureChatIdSaved, 1500);
}

// OPTIMIZATION: Global DOM cache - устраняет повторный обход дерева DOM
// для часто запрашиваемых элементов внутри hot-paths (recalcPlan, syncFlexibleUI,
// renderGoals, renderAccountsUI, applyFlexibleSideVisibility, renderFlexModelSummary).
// Топ-level `const`-ссылки на DOM (incomeInput, goalInput, ...) НЕ заменяются -
// они один раз кэшируют ноды при загрузке.
const domCache = {};
function getEl(id) {
  var el = domCache[id];
  if (el && el.isConnected) return el;
  el = document.getElementById(id);
  if (el) domCache[id] = el;
  return el;
}

// OPTIMIZATION: Lightweight debounce (250ms) для дросселирования тяжёлых каскадов
// updateState() + recalcPlan() + syncFlexibleUI(), вызываемых на каждое нажатие
// клавиши в input-полях гибкой модели (fixedIncomeInput / fixedExpenseInput).
function debounce(fn, wait) {
  var timer = null;
  var w = (wait == null ? 250 : wait);
  return function () {
    var ctx = this;
    var args = arguments;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; fn.apply(ctx, args); }, w);
  };
}

// OPTIMIZATION: Helper - устраняет 4+ дублирующихся блоков сохранения позиции
// курсора при форматировании числового input. Поведение полностью идентично
// исходному (см. блоки fixedIncomeInput, fixedExpenseInput, expAmtInput и др.).
function formatNumericInput(inputEl) {
  if (!inputEl) return;
  var p = inputEl.selectionStart;
  var b = inputEl.value.length;
  inputEl.value = formatNumber(inputEl.value);
  var a = inputEl.value.length;
  inputEl.selectionEnd = p + (a - b);
}

const buttons = document.querySelectorAll(".nav-btn");
const screens = document.querySelectorAll(".screen");
const indicator = document.querySelector(".nav-indicator");

/* ===== NAV ICON ANIMATIONS ===== */
var navCalcLottie = null;
var navProtocolLottie = null;
var navAccountsLottie = null;
var navGoalsLottie = null;
var navExpensesLottie = null;

(function initNavIcons() {
  if (typeof lottie === "undefined") return;
  var navIcons = [
    { id: "nav-calc-lottie", path: "assets/animation/Coins-2.json", ref: "navCalcLottie" },
    { id: "nav-protocol-lottie", path: "assets/animation/trend-up-ai_.json", ref: "navProtocolLottie" },
    { id: "nav-accounts-lottie", path: "assets/animation/Wallet-doublle.json", ref: "navAccountsLottie" },
    { id: "nav-goals-lottie", path: "assets/animation/Marker.json", ref: "navGoalsLottie" },
    { id: "nav-expenses-lottie", path: "assets/animation/Align-bottom.json", ref: "navExpensesLottie" }
  ];
  navIcons.forEach(function (cfg) {
    var el = document.getElementById(cfg.id);
    if (el) {
      var anim = lottie.loadAnimation({
        container: el,
        renderer: "svg",
        loop: false,
        autoplay: false,
        path: cfg.path
      });
      if (cfg.ref === "navCalcLottie") navCalcLottie = anim;
      else if (cfg.ref === "navProtocolLottie") navProtocolLottie = anim;
      else if (cfg.ref === "navAccountsLottie") navAccountsLottie = anim;
      else if (cfg.ref === "navGoalsLottie") navGoalsLottie = anim;
      else if (cfg.ref === "navExpensesLottie") navExpensesLottie = anim;
    }
  });
})();

function isAnimationsEnabled() {
  return !document.body.classList.contains("reduce-motion");
}

function replayNavIconForScreen(screenName) {
  if (!isAnimationsEnabled()) return;
  var anim = null;
  if (screenName === "calc") anim = navCalcLottie;
  else if (screenName === "advice") anim = navProtocolLottie;
  else if (screenName === "accounts") anim = navAccountsLottie;
  else if (screenName === "goals") anim = navGoalsLottie;
  else if (screenName === "ai") anim = navExpensesLottie;
  if (anim) {
    anim.goToAndStop(0, true);
    anim.play();
  }
}

if (window.Telegram?.WebApp) {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
  Telegram.WebApp.onEvent("viewportChanged", function () {
    Telegram.WebApp.expand();
    runFlipFixOnReturn();
  });
}

/* Защита от вертикального смещения во время горизонтального flip-свайпа */
var _startX = 0;
var _startY = 0;
var _isHorizontalSwipe = false;

document.addEventListener("touchstart", function (e) {
  if (!e.touches || !e.touches.length) return;
  _startX = e.touches[0].clientX;
  _startY = e.touches[0].clientY;
  _isHorizontalSwipe = false;
}, { passive: true });

document.addEventListener("touchmove", function (e) {
  if (!e.touches || !e.touches.length) return;
  var deltaX = e.touches[0].clientX - _startX;
  var deltaY = e.touches[0].clientY - _startY;
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    _isHorizontalSwipe = true;
  }
  if (_isHorizontalSwipe) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener("touchend", function () { _isHorizontalSwipe = false; }, { passive: true });
document.addEventListener("touchcancel", function () { _isHorizontalSwipe = false; }, { passive: true });

function fixFlipRendering(done) {
  var focused = document.activeElement;
  var isInputFocused = focused && (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA");
  if (isInputFocused) {
    if (typeof done === "function") done();
    return;
  }

  var cards = document.querySelectorAll(".flip-inner");
  var states = [];
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    states.push({ el: card, transform: card.style.transform });
    card.style.transform = "none";
    void card.offsetHeight;
  }
  requestAnimationFrame(function () {
    for (var j = 0; j < states.length; j++) {
      states[j].el.style.transform = states[j].transform;
    }
    if (typeof done === "function") done();
  });
}

function runFlipFixOnReturn() {
  var body = document.body;
  if (!body) return;
  var focused = document.activeElement;
  if (focused && (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA")) {
    return;
  }
  body.classList.add("flip-fix-pending");
  requestAnimationFrame(function () {
    fixFlipRendering(function () {
      requestAnimationFrame(function () {
        body.classList.remove("flip-fix-pending");
      });
    });
  });
}

document.addEventListener("pointerdown", e => {
  if (
    e.target.closest("input") ||
    e.target.closest("textarea") ||
    e.target.closest(".mode-btn") ||
    e.target.closest(".nav-btn") ||
    e.target.closest("#profileBtn") ||
    e.target.closest(".protocol-back") ||
    e.target.closest("button")
  ) {
    return;
  }

  document.activeElement?.blur();
});

/* ===== FORMAT ===== */
function formatNumber(v) {
  var d = v.replace(/\D/g, "");
  var sep = (window._protocolNumberFormat === "dots") ? "." : " ";
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}
function parseNumber(v) {
  return Number(v.replace(/[\.\s\u00A0]/g, ""));
}
/* ═════════════════════════════════════════════════
   Multi-Currency System
   ─────────────────────────────────────────────────
   baseCurrency   - all data stored & calculated here
   displayCurrency - UI-only dynamic conversion
   ═════════════════════════════════════════════════ */

function _currencySymbol(code) {
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return "₽";
}

function getBaseCurrency() {
  var s = (typeof getState === "function") ? getState().settings : null;
  return (s && s.baseCurrency) || "RUB";
}

function getCurrencySymbol() {
  return _currencySymbol(_getEffectiveCurrency());
}

function _getEffectiveCurrency() {
  var s = (typeof getState === "function") ? getState().settings : null;
  if (s && s.displayCurrencyEnabled && s.displayCurrency) return s.displayCurrency;
  return (s && s.baseCurrency) || "RUB";
}

/* ── Exchange rate cache ── */
var _exchangeRates = { USD: null, EUR: null, _ts: 0 };
var _RATE_CACHE_KEY = "protocol_exchange_rates";
var _RATE_TTL_MS = 43200000; // 12 hours

(function _loadCachedRates() {
  try {
    var raw = localStorage.getItem(_RATE_CACHE_KEY);
    if (raw) {
      var cached = JSON.parse(raw);
      if (cached && cached.USD && cached.EUR && cached._ts) {
        _exchangeRates = cached;
        console.log("[Protocol] Using cached exchange rates");
      }
    }
  } catch (e) { /* ignore */ }
})();

function _saveRatesToCache() {
  try {
    localStorage.setItem(_RATE_CACHE_KEY, JSON.stringify(_exchangeRates));
  } catch (e) { /* ignore */ }
}

function _persistRatesToState() {
  if (typeof updateState === "function") {
    updateState({ settings: {
      exchangeRates: {
        USD: _exchangeRates.USD,
        EUR: _exchangeRates.EUR,
        lastUpdated: _exchangeRates._ts
      }
    }});
  }
}

function fetchExchangeRates(forceRefresh, callback) {
  if (!forceRefresh && _exchangeRates._ts && Date.now() - _exchangeRates._ts < _RATE_TTL_MS) {
    if (callback) callback(true);
    return;
  }

  fetch("https://open.er-api.com/v6/latest/RUB")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data && data.result === "success" && data.rates) {
        _exchangeRates.USD = data.rates.USD || _exchangeRates.USD;
        _exchangeRates.EUR = data.rates.EUR || _exchangeRates.EUR;
        _exchangeRates._ts = Date.now();
        _saveRatesToCache();
        _persistRatesToState();
        console.log("[Protocol] Exchange rates fetched:", {
          USD: _exchangeRates.USD, EUR: _exchangeRates.EUR
        });
        _refreshAfterRateChange();
        if (callback) callback(true);
      } else {
        console.warn("[Protocol] Rate API returned unexpected format");
        if (callback) callback(false);
      }
    })
    .catch(function (err) {
      console.warn("[Protocol] Exchange rate fetch failed, using cached/fallback:", err.message);
      if (callback) callback(false);
    });
}

function _refreshAfterRateChange() {
  var eff = _getEffectiveCurrency();
  var base = getBaseCurrency();
  if (eff !== base) {
    if (typeof applyLanguageToDOM === "function") applyLanguageToDOM();
    if (typeof renderAccountsUI === "function") try { renderAccountsUI(); } catch(e){}
    if (typeof renderGoals === "function") try { renderGoals(); } catch(e){}
    if (typeof renderExpensesScreen === "function") try { renderExpensesScreen(); } catch(e){}
  }
}

fetchExchangeRates();

/* ── Conversion helpers ── */

// _rateFromRub("USD") → how many USD per 1 RUB (e.g. 0.011)
function _rateFromRub(currencyCode) {
  if (!currencyCode || currencyCode === "RUB") return 1;
  var rate = _exchangeRates[currencyCode];
  if (rate && rate > 0) return rate;
  return null;
}

function convert(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  var num = Number(amount) || 0;

  var fromRate = _rateFromRub(fromCurrency);
  var toRate = _rateFromRub(toCurrency);
  if (!fromRate || !toRate) return num;

  // Convert via RUB as intermediary: amount → RUB → target
  var amountInRub = (fromCurrency === "RUB") ? num : num / fromRate;
  return (toCurrency === "RUB") ? amountInRub : amountInRub * toRate;
}

function getDisplayAmount(amount) {
  var base = getBaseCurrency();
  var eff = _getEffectiveCurrency();
  if (eff === base) return Number(amount) || 0;
  return convert(amount, base, eff);
}

function formatMoney(amount, currencyOverride) {
  var cur = currencyOverride || _getEffectiveCurrency();
  var num = Number(amount) || 0;
  var sep = (window._protocolNumberFormat === "dots") ? "." : "\u00A0";
  var str = Math.round(Math.abs(num)).toString();
  var formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return (num < 0 ? "−" : "") + formatted + " " + _currencySymbol(cur);
}

function fmtConverted(n) {
  var num = Number(n) || 0;
  return fmtNum(getDisplayAmount(num));
}

function protocolFormatAmount(n) {
  var num = Number(n) || 0;
  return formatMoney(getDisplayAmount(num));
}

/* ── Base currency change (one-time conversion of ALL stored values) ── */

function changeBaseCurrency(newBase, callback) {
  var oldBase = getBaseCurrency();
  if (newBase === oldBase) { if (callback) callback(true); return; }

  fetchExchangeRates(true, function (ok) {
    var fromRate = _rateFromRub(oldBase);
    var toRate = _rateFromRub(newBase);

    if (!fromRate || !toRate) {
      console.warn("[Protocol] Cannot convert - rates unavailable. Fallback used.");
      if (callback) callback(false);
      return;
    }

    function cvt(val) {
      var n = Number(val) || 0;
      if (n === 0) return 0;
      return Math.round(convert(n, oldBase, newBase));
    }

    var s = getState();

    // ── Convert accounts ──
    var newAccounts = {
      main: cvt(s.accounts.main),
      reserve: cvt(s.accounts.reserve)
    };

    // ── Convert goals ──
    var newGoals = (s.goals || []).map(function (g) {
      return Object.assign({}, g, {
        amount: cvt(g.amount),
        saved: cvt(g.saved),
        monthlyShare: cvt(g.monthlyShare)
      });
    });

    // ── Convert completed goals ──
    var newCompletedGoals = (s.completedGoals || []).map(function (g) {
      return Object.assign({}, g, {
        amount: cvt(g.amount),
        saved: cvt(g.saved)
      });
    });

    // ── Convert debts ──
    var newDebts = (s.debts || []).map(function (d) {
      return Object.assign({}, d, {
        totalAmount: cvt(d.totalAmount),
        remainingAmount: cvt(d.remainingAmount),
        monthlyPayment: cvt(d.monthlyPayment),
        paidInCurrentPeriod: cvt(d.paidInCurrentPeriod),
        creditLimit: d.creditLimit ? cvt(d.creditLimit) : undefined,
        freeLimit: d.freeLimit ? cvt(d.freeLimit) : undefined
      });
    });

    // ── Convert debt payment history ──
    var newDebtHistory = (s.debtPaymentHistory || []).map(function (h) {
      return Object.assign({}, h, {
        amount: cvt(h.amount),
        totalInput: h.totalInput ? cvt(h.totalInput) : undefined
      });
    });

    // ── Convert expenses log ──
    var newExpenses = (s.expensesLog || []).map(function (e) {
      return Object.assign({}, e, { amount: cvt(e.amount) });
    });

    // ── Convert fact history ──
    var newFactHistory = (s.factHistory || []).map(function (f) {
      return Object.assign({}, f, { value: cvt(f.value) });
    });

    // ── Convert plan/calc values ──
    var newPlannedMonthly = cvt(s.plannedMonthly);
    var newPlanStartValue = cvt(s.planStartValue);
    var newInitialBalance = cvt(s.initialBalance);

    var newLastCalc = {};
    if (s.lastCalc && typeof s.lastCalc === "object") {
      newLastCalc = Object.assign({}, s.lastCalc);
      if (newLastCalc.monthlySave) newLastCalc.monthlySave = cvt(newLastCalc.monthlySave);
      if (newLastCalc.free) newLastCalc.free = cvt(newLastCalc.free);
    }

    // ── Convert input fields ──
    var newIncome = s.income ? String(cvt(parseNumber(String(s.income)))) : s.income;
    var newExpensesVal = s.expenses ? String(cvt(parseNumber(String(s.expenses)))) : s.expenses;
    var newGoal = s.goal ? String(cvt(parseNumber(String(s.goal)))) : s.goal;
    var newSaved = s.saved ? String(cvt(parseNumber(String(s.saved)))) : s.saved;
    var newFixedIncome = s.fixedIncomeAmount ? String(cvt(parseNumber(String(s.fixedIncomeAmount)))) : s.fixedIncomeAmount;
    var newFixedExpense = s.fixedExpenseAmount ? String(cvt(parseNumber(String(s.fixedExpenseAmount)))) : s.fixedExpenseAmount;

    // ── Apply all converted values ──
    updateState({
      accounts: newAccounts,
      goals: newGoals,
      completedGoals: newCompletedGoals,
      debts: newDebts,
      debtPaymentHistory: newDebtHistory,
      expensesLog: newExpenses,
      factHistory: newFactHistory,
      plannedMonthly: newPlannedMonthly,
      planStartValue: newPlanStartValue,
      initialBalance: newInitialBalance,
      lastCalc: newLastCalc,
      income: newIncome,
      expenses: newExpensesVal,
      goal: newGoal,
      saved: newSaved,
      fixedIncomeAmount: newFixedIncome,
      fixedExpenseAmount: newFixedExpense,
      settings: { baseCurrency: newBase }
    });

    // Sync in-memory vars
    accounts.main = newAccounts.main;
    accounts.reserve = newAccounts.reserve;
    factHistory = newFactHistory;
    lastCalc = newLastCalc;
    plannedMonthly = newPlannedMonthly;
    planStartValue = newPlanStartValue;
    initialBalance = newInitialBalance;

    if (incomeInput && newIncome) incomeInput.value = newIncome;
    if (expensesInput && newExpensesVal) expensesInput.value = newExpensesVal;
    if (goalInput && newGoal) goalInput.value = newGoal;

    saveFullState();
    applyLanguageToDOM();

    if (typeof renderAccountsUI === "function") try { renderAccountsUI(); } catch(e){}
    if (typeof renderGoals === "function") try { renderGoals(); } catch(e){}
    if (typeof renderExpensesScreen === "function") try { renderExpensesScreen(); } catch(e){}

    console.log("[Protocol] Base currency changed:", oldBase, "→", newBase);
    if (callback) callback(true);
  });
}

/* ===== ELEMENTS ===== */
const incomeInput = document.getElementById("income");
const expensesInput = document.getElementById("expenses");
const goalInput = document.getElementById("goal");
const editGoalBtn = document.getElementById("editGoalBtn");
const goalEditorSheet = document.getElementById("goalEditorSheet");
const goalEditorOverlay = document.getElementById("goalEditorOverlay");
const goalEditHint = document.getElementById("goalEditHint");
const accountsAddBtn = document.getElementById("accountsAddBtn");
const addAccountBack = document.getElementById("addAccountBack");

const goalEditTitle = document.getElementById("goalEditTitle");
const goalEditAmount = document.getElementById("goalEditAmount");
const goalEditSave = document.getElementById("goalEditSave");
const savedInput = document.getElementById("saved");
const calculateBtn = document.getElementById("calculate");
const protocolBack = document.getElementById("protocolBack");

if (protocolBack) {
protocolBack.addEventListener("click", () => {
haptic("light");

openScreen("calc", buttons[0]);

document.querySelectorAll(
"#screen-calc label, #screen-calc .input-wrap, .mode-buttons, #calculate"
).forEach(el => el.style.display = "");

planSummary.style.display = "none";

hideBottomNav();
});
}

// ===== PLAN SUMMARY ELEMENTS =====
const planSummary = document.getElementById("planSummary");

const summaryMonthly = document.getElementById("summaryMonthly");
const summaryMonths = document.getElementById("summaryMonths");
const summaryMode = document.getElementById("summaryMode");

let selectedMode = "calm"; // calm | medium | aggressive

const modeButtons = document.querySelectorAll(".mode-buttons .mode-btn");

modeButtons.forEach(btn => {
btn.onclick = () => {
haptic("light");
modeButtons.forEach(b => b.classList.remove("active"));
btn.classList.add("active");
selectedMode = btn.dataset.mode;
saveMode = btn.dataset.mode;
saveFullState();
};
});

const adviceCard = document.getElementById("adviceCard");
const loader = document.getElementById("loader");

const sheet = document.getElementById("sheet");
const sheetOverlay = document.getElementById("sheetOverlay");
const noBuffer = document.getElementById("noBuffer");
const withBuffer = document.getElementById("withBuffer");

const lockText = document.getElementById("lockText");
const resetBtn = document.getElementById("resetPlan");
const calcLock = document.getElementById("calcLock");

const confirmReset = document.getElementById("confirmReset");
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");

/* ===== NAV ===== */
const bottomNav = document.querySelector(".bottom-nav");
const advancedBtn = document.getElementById("advancedBtn");
const advancedBack = document.getElementById("advancedBack");
// ❌ скрываем bottom-nav при старте (экран расчёта)
bottomNav.style.opacity = "0";
bottomNav.style.pointerEvents = "none";
bottomNav.style.transform = "translateY(140%)";

/* ===== NAV INDICATOR ===== */
function moveIndicator(btn) {
indicator.style.opacity = "1";
if (!btn) return;

const navRect = bottomNav.getBoundingClientRect();
const btnRect = btn.getBoundingClientRect();

const x =
btnRect.left -
navRect.left +
(btnRect.width - indicator.offsetWidth) / 2;

indicator.style.transform = `translateX(${x}px) translateY(-50%)`;
}

/* ===== NAV NEVER MOVES ===== */
bottomNav.style.position = "fixed";
const NAV_BASE_BOTTOM_PX = 26;
bottomNav.style.bottom = `${NAV_BASE_BOTTOM_PX}px`;
bottomNav.style.left = "20px";
bottomNav.style.right = "20px";

// Не даём bottom-nav "подпрыгивать" над клавиатурой (mobile webview)
let layoutViewportHeight = window.innerHeight;
function updateBottomNavForKeyboard() {
  if (!bottomNav) return;
  const vv = window.visualViewport;
  if (!vv) return;

  const keyboardOffset = Math.max(
    0,
    layoutViewportHeight - vv.height - (vv.offsetTop || 0)
  );

  // Компенсируем уменьшение visual viewport отрицательным bottom,
  // чтобы панель оставалась на месте и могла быть перекрыта клавиатурой.
  bottomNav.style.bottom = `${NAV_BASE_BOTTOM_PX - keyboardOffset}px`;
}

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateBottomNavForKeyboard);
  window.visualViewport.addEventListener("scroll", updateBottomNavForKeyboard);
  window.addEventListener("orientationchange", () => {
    layoutViewportHeight = window.innerHeight;
    setTimeout(updateBottomNavForKeyboard, 50);
  });
  updateBottomNavForKeyboard();
}

const PROTOCOL_COLORS = [
"#3a7bfd", // основной синий
"#60a5fa", // светлый
"#1e3a8a", // тёмный
"#ffffff" // акцент
];

// PREMIUM GOAL COMPLETION - изумрудная палитра для левой стороны конфетти.
// Используется только в firePremiumCelebration() (правая сторона - синие PROTOCOL_COLORS).
const EMERALD_CONFETTI_COLORS = [
  "#10b981", // основной emerald
  "#34d399", // светлый
  "#6ee7b7", // мятный
  "#a7f3d0", // пастельный
  "#047857", // глубокий
  "#059669"  // насыщенный
];

/* ===== STATE ===== */
let lastCalc = {};
let chosenPlan = null;
let plannedMonthly = 0;
let factRatio = null;
let factHistory = [];
let planStartValue = 0;
let isInitialized = false;
let goalCompleted = false;
let saveMode = "calm";
let selectedScenario = null;
let lastScreenBeforeProfile = "calc";
let lastNavBtnBeforeProfile = buttons[0];
let accounts = {
main: 0,
reserve: 0
};
let initialBalance = 0;
let goalMeta = {
title: ""
};

/* ===== MULTI-GOAL SYSTEM ===== */
var activeGoalIndex = 0;

/** Returns live reference to goals in state-manager. Never cache - always call. */
function getGoals() {
  var s = getState();
  if (!Array.isArray(s.goals)) { s.goals = []; }
  return s.goals;
}

/** Writes goals array back into state-manager and persists. */
function persistGoals(goals) {
  updateState({ goals: goals.map(function (g) { return { ...g }; }) });
  saveFullState();
}

function syncGoalsFromPrimary() {
  var goals = getGoals();
  if (!goals.length) return;
  var g = goals[0];
  g.title = goalMeta.title;
  g.amount = parseNumber(goalInput?.value || "0");
  g.saved = accounts.main;
}

function ensureDefaultGoal() {
  var goals = getGoals();
  if (goals.length === 0) {
    var goalAmount = parseNumber(goalInput?.value || "0");
    var goalSaved = accounts.main || 0;
    goals.push({
      id: "goal_1",
      title: goalMeta.title || t("advGoals.mainGoal"),
      amount: goalAmount,
      saved: goalSaved,
      priority: 1,
      monthlyShare: 0,
      monthsLeft: 0,
      paused: false
    });
    persistGoals(goals);
  }
}

function reorderGoalsByPriority() {
  var goals = getGoals();
  goals.sort(function (a, b) { return a.priority - b.priority; });
}

function getGoalById(id) {
  var goals = getGoals();
  for (var i = 0; i < goals.length; i++) {
    if (goals[i].id === id) return goals[i];
  }
  return null;
}

function generateGoalId() {
  return "goal_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
}

/**
 * Distributes monthlyContribution across goals by weighted priority.
 * Weight = 1 / priority. Completed goals (saved >= amount) get 0,
 * their share redistributes to remaining goals.
 */
function computeGoalsAllocation(goals, monthlyContribution) {
  if (!goals || !goals.length || !monthlyContribution || monthlyContribution <= 0) {
    goals.forEach(function (g) { g.monthlyShare = 0; g.monthsLeft = 0; });
    return goals;
  }

  var active = [];
  goals.forEach(function (g) {
    if (g.paused) {
      g.monthlyShare = 0;
      g.monthsLeft = 0;
      return;
    }
    var remaining = Math.max(0, (g.amount || 0) - (g.saved || 0));
    if (remaining <= 0) {
      g.monthlyShare = 0;
      g.monthsLeft = 0;
    } else {
      active.push(g);
    }
  });

  if (active.length === 0) return goals;

  var overridden = [];
  var natural = [];
  var overriddenTotal = 0;

  active.forEach(function (g) {
    var remaining = Math.max(0, g.amount - (g.saved || 0));
    if (g.timelineOverrideMonths && g.timelineOverrideMonths > 0) {
      var needed = Math.ceil(remaining / g.timelineOverrideMonths);
      if (needed <= monthlyContribution && (overriddenTotal + needed) <= monthlyContribution) {
        g.monthlyShare = needed;
        g.monthsLeft = g.timelineOverrideMonths;
        overriddenTotal += needed;
        overridden.push(g);
        return;
      }
    }
    natural.push(g);
  });

  var poolForNatural = Math.max(0, monthlyContribution - overriddenTotal);

  if (natural.length > 0 && poolForNatural > 0) {
    var totalWeight = 0;
    natural.forEach(function (g) {
      totalWeight += 1 / (g.priority || 1);
    });
    natural.forEach(function (g) {
      var weight = (1 / (g.priority || 1)) / totalWeight;
      g.monthlyShare = Math.round(poolForNatural * weight);
      var remaining = Math.max(0, g.amount - (g.saved || 0));
      g.monthsLeft = g.monthlyShare > 0 ? Math.ceil(remaining / g.monthlyShare) : 0;
    });
  } else if (natural.length > 0) {
    natural.forEach(function (g) { g.monthlyShare = 0; g.monthsLeft = 0; });
  }

  return goals;
}

function computeMinAllowedMonths(goal, totalMonthlyPool) {
  var remaining = Math.max(0, (goal.amount || 0) - (goal.saved || 0));
  if (remaining <= 0) return 1;
  if (!totalMonthlyPool || totalMonthlyPool <= 0) return 1;
  return Math.max(1, Math.ceil(remaining / totalMonthlyPool));
}

function computeTimelinePreview(draftGoals, totalMonthly) {
  var preview = JSON.parse(JSON.stringify(draftGoals));
  computeGoalsAllocation(preview, totalMonthly);
  return preview;
}

/**
 * Distributes a given distributableAmount across active goals by priority weights.
 * Returns array of { goalId, amount }. Paused and completed goals get 0.
 * Final rounding remainder goes to the highest-priority active goal.
 */
function allocateFactByPriority(goals, distributableAmount) {
  if (!goals || !goals.length || !distributableAmount || distributableAmount <= 0) {
    return goals.map(function (g) { return { goalId: g.id, amount: 0 }; });
  }

  var active = [];
  var result = {};
  goals.forEach(function (g) {
    result[g.id] = 0;
    var remaining = Math.max(0, (g.amount || 0) - (g.saved || 0));
    if (!g.paused && remaining > 0) {
      active.push(g);
    }
  });

  if (active.length === 0) {
    return goals.map(function (g) { return { goalId: g.id, amount: 0 }; });
  }

  if (active.length === 1) {
    result[active[0].id] = distributableAmount;
    return goals.map(function (g) { return { goalId: g.id, amount: result[g.id] }; });
  }

  var totalWeight = 0;
  active.forEach(function (g) { totalWeight += 1 / (g.priority || 1); });

  var allocated = 0;
  active.forEach(function (g) {
    var weight = (1 / (g.priority || 1)) / totalWeight;
    var share = Math.round(distributableAmount * weight);
    result[g.id] = share;
    allocated += share;
  });

  var diff = distributableAmount - allocated;
  if (diff !== 0) {
    var highest = active.slice().sort(function (a, b) { return a.priority - b.priority; })[0];
    result[highest.id] += diff;
  }

  return goals.map(function (g) { return { goalId: g.id, amount: result[g.id] }; });
}

function getFactPreviewForGoal(goalIndex, rawInputAmount) {
  var goals = getGoals();
  if (!goals.length || goalIndex < 0 || goalIndex >= goals.length) return 0;

  var amount = rawInputAmount || 0;
  if (amount <= 0 && plannedMonthly > 0) {
    amount = plannedMonthly;
  }
  if (amount <= 0) return 0;

  var distributable = amount;
  if (chosenPlan === "buffer") {
    distributable = amount - Math.round(amount * 0.1);
  }

  var alloc = allocateFactByPriority(goals, distributable);
  for (var i = 0; i < alloc.length; i++) {
    if (alloc[i].goalId === goals[goalIndex].id) return alloc[i].amount;
  }
  return 0;
}

/* ===== CENTRALIZED STATE MANAGEMENT ===== */

/**
 * Единый объект состояния приложения
 * Все изменения состояния должны проходить через recalcPlan()
 */
const state = {
  goalTotal: 0,
  goalSaved: 0,
  reserveAmount: 0,
  monthlyContribution: 0,
  monthsLeft: 0,
  mode: null, // "buffer" | null
  hasReserve: false
};

/**
 * NEW: Robust amount parser shared between recalcPlan + assembleCashflowEvents.
 * Mirrors the parser used inside renderFlexModelSummary() - handles "10 000",
 * "10.000", "10000", "10,5", "10.5". Returns 0 if invalid.
 */
function parseFlexAmount(v) {
  if (v == null) return 0;
  var raw = String(v).replace(/[\u00A0\s]/g, "");
  if (!raw) return 0;
  var nf = "spaces";
  if (typeof window !== "undefined" && window._protocolNumberFormat) {
    nf = window._protocolNumberFormat;
  } else {
    var st = (typeof getState === "function") ? getState() : null;
    if (st && st.settings && st.settings.numberFormat) nf = st.settings.numberFormat;
  }
  if (nf === "dots") {
    raw = raw.replace(/\./g, "").replace(/,/g, ".");
  } else {
    var dots = (raw.match(/\./g) || []).length;
    if (dots >= 2) raw = raw.replace(/\./g, "");
    raw = raw.replace(/,/g, ".");
  }
  var n = parseFloat(raw);
  return isFinite(n) && n > 0 ? n : 0;
}

/**
 * NEW: Computes the next occurrence date (>= today) for a periodic schedule
 * anchored at `startDate` with the given `frequency`.
 *
 * Supports: monthly (same DOM, clamped), weekly (+7d), biweekly (+14d),
 * custom (next selected day-of-month, wrapping into next month if needed).
 *
 * Returns a Date object, or null if startDate is empty/invalid.
 */
function calculateNextOccurrence(startDate, frequency, monthDays) {
  if (!startDate) return null;

  var start = (startDate instanceof Date) ? new Date(startDate) : new Date(String(startDate));
  if (isNaN(start.getTime())) return null;
  start = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  var today = new Date();
  today = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (start.getTime() >= today.getTime()) return start;

  var DAY = 24 * 60 * 60 * 1000;

  if (frequency === "weekly") {
    var diff = Math.floor((today.getTime() - start.getTime()) / DAY);
    var step = Math.floor(diff / 7) + 1;
    var d = new Date(start);
    d.setDate(d.getDate() + step * 7);
    return d;
  }

  if (frequency === "biweekly") {
    var diff2 = Math.floor((today.getTime() - start.getTime()) / DAY);
    var step2 = Math.floor(diff2 / 14) + 1;
    var d2 = new Date(start);
    d2.setDate(d2.getDate() + step2 * 14);
    return d2;
  }

  if (frequency === "custom" && Array.isArray(monthDays) && monthDays.length) {
    var sorted = monthDays.slice().sort(function (a, b) { return a - b; });
    var todayDOM = today.getDate();
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i] >= todayDOM) {
        return new Date(today.getFullYear(), today.getMonth(), sorted[i]);
      }
    }
    return new Date(today.getFullYear(), today.getMonth() + 1, sorted[0]);
  }

  // Default: monthly - same day-of-month as start, clamped to month length.
  var origDay = start.getDate();
  var cursor = new Date(start);
  // Walk forward month by month until we pass today.
  var safety = 0;
  while (cursor.getTime() <= today.getTime() && safety < 600) {
    var y = cursor.getFullYear();
    var m = cursor.getMonth() + 1;
    var lastDay = new Date(y, m + 1, 0).getDate();
    cursor = new Date(y, m, Math.min(origDay, lastDay));
    safety++;
  }
  return cursor;
}

/**
 * Собирает FinancialEvent[] из legacy-источников (factHistory + skip из FinancialEvents).
 * Используется движком для расчёта балансов и проекций.
 *
 * NEW: логика fixed vs variable 11.05.2026 -
 *   • FIXED side  → inject a synthetic MONTHLY event sourced from the simple-model
 *     amount (s.income / s.expenses). This is read-only and matches what the user
 *     entered when opening the flexible model.
 *   • VARIABLE side → inject a synthetic recurring event from the user-configured
 *     periodic schedule (fixedIncomeAmount + incomeFrequency + incomeStartDate).
 *   User-created manual events are kept as-is in both modes (they layer on top).
 */
function assembleCashflowEvents() {
  var H = CashflowEngineHelpers;
  var s = getState() || {};

  var incomeIsFixed  = (s.incomeType  || "fixed") === "fixed";
  var expenseIsFixed = (s.expenseType || "fixed") === "fixed";

  var events = H.factHistoryToEvents(factHistory);

  // Pass through every user-created / persisted cashflow event verbatim.
  // (No type-based filtering anymore - manual one-offs are independent of the
  // fixed/variable toggle.)
  var fromState = s.cashflowEvents || [];
  for (var i = 0; i < fromState.length; i++) {
    events.push(H.normalizeEvent(fromState[i] || {}));
  }

  var nowIso = (new Date()).toISOString().slice(0, 10);

  // ── INCOME synthetic event ──────────────────────────────────────────────
  if (incomeIsFixed) {
    // FIXED: monthly recurring event sourced from the simple-model income field.
    var incFixedAmt = parseFlexAmount(s.income);
    if (incFixedAmt > 0) {
      events.push(H.normalizeEvent({
        type: H.EVENT_TYPE.INCOME,
        amount: incFixedAmt,
        frequency: "monthly",
        startDate: nowIso,
        meta: { kind: "periodic", source: "flexModel", side: "income", origin: "simple", anchorDate: nowIso }
      }));
    }
  } else {
    // VARIABLE: user-configured schedule.
    var incFreq = s.incomeFrequency || "monthly";
    // CUSTOM SCHEDULE LOGIC - для freq=custom периодическое событие НЕ генерируем.
    // Вместо него в forecast уходят one-time INCOME-события из customScheduleEntries
    // (отдельный блок ниже). Это даёт «по среднему последних ручных вводов».
    if (incFreq === "custom") {
      var csEntriesInc = Array.isArray(s.customScheduleEntries) ? s.customScheduleEntries : [];
      for (var ci = 0; ci < csEntriesInc.length; ci++) {
        var ceInc = csEntriesInc[ci];
        if (!ceInc || ceInc.side !== "income") continue;
        var ceAmtI = Number(ceInc.amount) || 0;
        if (ceAmtI <= 0) continue;
        events.push(H.normalizeEvent({
          id: "cs_" + ceInc.id,
          type: H.EVENT_TYPE.INCOME,
          amount: ceAmtI,
          frequency: "once",
          startDate: ceInc.date || nowIso,
          // userCreated: true → cashflow-engine включает one-time события в forecast.
          meta: { kind: "manual", source: "customSchedule", side: "income", userCreated: true, csId: ceInc.id, anchorDate: ceInc.date || nowIso }
        }));
      }
    } else {
      var incVarAmt = parseFlexAmount(s.fixedIncomeAmount);
      if (incVarAmt > 0) {
        var incStart = s.incomeStartDate || nowIso;
        var incMeta = { kind: "periodic", source: "flexModel", side: "income", origin: "variable", anchorDate: incStart };
        events.push(H.normalizeEvent({
          type: H.EVENT_TYPE.INCOME,
          amount: incVarAmt,
          frequency: incFreq,
          startDate: incStart,
          meta: incMeta
        }));
      }
    }
  }

  // ── EXPENSE synthetic event ─────────────────────────────────────────────
  if (expenseIsFixed) {
    var expFixedAmt = parseFlexAmount(s.expenses);
    if (expFixedAmt > 0) {
      events.push(H.normalizeEvent({
        type: H.EVENT_TYPE.EXPENSE,
        amount: expFixedAmt,
        frequency: "monthly",
        startDate: nowIso,
        meta: { kind: "periodic", source: "flexModel", side: "expense", origin: "simple", anchorDate: nowIso }
      }));
    }
  } else {
    var expFreq = s.expenseFrequency || "monthly";
    // CUSTOM SCHEDULE LOGIC - зеркальная логика для расходов.
    if (expFreq === "custom") {
      var csEntriesExp = Array.isArray(s.customScheduleEntries) ? s.customScheduleEntries : [];
      for (var cj = 0; cj < csEntriesExp.length; cj++) {
        var ceExp = csEntriesExp[cj];
        if (!ceExp || ceExp.side !== "expense") continue;
        var ceAmtE = Number(ceExp.amount) || 0;
        if (ceAmtE <= 0) continue;
        events.push(H.normalizeEvent({
          id: "cs_" + ceExp.id,
          type: H.EVENT_TYPE.EXPENSE,
          amount: ceAmtE,
          frequency: "once",
          startDate: ceExp.date || nowIso,
          meta: { kind: "manual", source: "customSchedule", side: "expense", userCreated: true, csId: ceExp.id, anchorDate: ceExp.date || nowIso }
        }));
      }
    } else {
      var expVarAmt = parseFlexAmount(s.fixedExpenseAmount);
      if (expVarAmt > 0) {
        var expStart = s.expenseStartDate || nowIso;
        var expMeta = { kind: "periodic", source: "flexModel", side: "expense", origin: "variable", anchorDate: expStart };
        events.push(H.normalizeEvent({
          type: H.EVENT_TYPE.EXPENSE,
          amount: expVarAmt,
          frequency: expFreq,
          startDate: expStart,
          meta: expMeta
        }));
      }
    }
  }

  if (typeof FinancialEvents !== "undefined") {
    var legacy = FinancialEvents.getEvents();
    for (var j = 0; j < legacy.length; j++) {
      var e = legacy[j];
      if (e.type === "unexpected_expense" && e.source === "skip") {
        events.push(H.normalizeEvent({
          id: e.id,
          type: H.EVENT_TYPE.UNEXPECTED_EXPENSE,
          amount: 0,
          startDate: e.date,
          meta: { source: "skip" }
        }));
      }
    }
  }

  return events;
}

function computeGraphState() {
  var factEvents = assembleCashflowEvents();
  var factBalance = Number(initialBalance) || 0;

  factEvents.forEach(function (e) {
    if (e.frequency && e.frequency !== "once") return;
    if (e.type === "contribution") {
      // Взносы в резерв не увеличивают линию «накоплено на цель» на графике.
      if (e.meta && e.meta.to === "reserve") return;
      factBalance += e.amount;
    }
    if (e.type === "unexpected_expense" && (!e.meta || e.meta.source !== "skip")) {
      factBalance -= e.amount;
    }
  });

  factBalance = Math.max(0, factBalance);

  var goals = getGoals();
  var activeGoal = goals[activeGoalIndex] || goals[0] || null;
  var goalMonths = lastCalc.months || 0;
  var activeMonthly = plannedMonthly || 0;
  var goalValue = parseNumber(goalInput ? goalInput.value || "0" : "0");

  if (activeGoal && goals.length > 1) {
    goalMonths = activeGoal.monthsLeft || goalMonths;
    activeMonthly = activeGoal.monthlyShare || activeMonthly;
    goalValue = activeGoal.amount || goalValue;
  }

  if (activeGoalIndex > 0 && activeGoal) {
    factBalance = activeGoal.saved || 0;
  }

  var goalTarget = goalValue || 1;
  var hasFact;
  if (activeGoalIndex > 0 && activeGoal) {
    hasFact = factBalance > 0 && (factBalance / goalTarget) > 0.005;
  } else {
    hasFact = factHistory && factHistory.length > 0;
  }

  var actualMonths = 0;
  var now = new Date();
  var nowMK = now.getFullYear() * 12 + now.getMonth();

  if (activeGoalIndex === 0 && factHistory && factHistory.length > 0) {
    var mainFacts = factHistory.filter(function (f) { return f.to === "main"; });
    if (mainFacts.length > 0) {
      var startMK = nowMK;
      mainFacts.forEach(function (f) {
        var d = new Date(f.date);
        var mk = d.getFullYear() * 12 + d.getMonth();
        if (mk < startMK) startMK = mk;
      });
      actualMonths = Math.max(1, nowMK - startMK + 1);
    }
  } else if (activeGoalIndex > 0 && hasFact) {
    var secondaryFacts = factHistory ? factHistory.filter(function (f) {
      return f.goalIndex === activeGoalIndex;
    }) : [];
    if (secondaryFacts.length > 0) {
      var startMKSec = nowMK;
      secondaryFacts.forEach(function (f) {
        var d = new Date(f.date);
        var mk = d.getFullYear() * 12 + d.getMonth();
        if (mk < startMKSec) startMKSec = mk;
      });
      actualMonths = Math.max(1, nowMK - startMKSec + 1);
    } else {
      actualMonths = 1;
    }
  }

  var visibleMonths = Math.max(3, actualMonths + 2, Math.min(goalMonths, actualMonths + 6));
  if (goalMonths > 0) visibleMonths = Math.min(visibleMonths, goalMonths);
  if (actualMonths > visibleMonths) visibleMonths = actualMonths;
  var minVisible = (goalMonths > 0 && goalMonths <= 3) ? Math.max(2, goalMonths) : 3;
  visibleMonths = Math.max(minVisible, visibleMonths);

  // Phase 2: доля вклада неполного первого месяца относительно полного месяца —
  // для косметического «надлома» линии плана (только основная цель, гибкая модель).
  var firstMonthRatio = 1;
  if (activeGoalIndex === 0 && lastCalc.isPartialMonth && activeMonthly > 0 && lastCalc.currentMonthToGoal != null) {
    firstMonthRatio = Math.max(0, Math.min(1, lastCalc.currentMonthToGoal / activeMonthly));
  }

  return {
    factBalance: factBalance,
    goalMonths: goalMonths,
    hasFact: hasFact,
    actualMonths: actualMonths,
    visibleMonths: visibleMonths,
    plannedMonthly: activeMonthly,
    firstMonthRatio: firstMonthRatio,
    goal: goalValue
  };
}

/**
 * Централизованная функция перерасчёта плана.
 * При активном плане использует CashflowEngine для пересчёта балансов,
 * месяцев и derivedState. Маппит результат в legacy-глобалы для UI.
 */
// ════════════════════════════════════════════════════════════════════════════
// REALISTIC DEBT LOGIC - Russian banks
// ────────────────────────────────────────────────────────────────────────────
// Блок helper-функций для реалистичной модели кредитов / рассрочек / карт
// российских банков (Сбер, Тинькофф, Альфа, ВТБ).
//
// Поддерживаемые расчёты:
//   • calculateAnnuityPayment(P, R, N)         - аннуитетный платёж
//   • calculateRemainingTerm(balance, P, R)    - пересчёт срока при досрочке
//   • calculateTotalInterest(P, payment, N)    - суммарная переплата
//   • calculateCardGraceInfo(debt)             - статус льготного периода карты
//   • getDebtStats(debt)                       - агрегированные UI-показатели
// ════════════════════════════════════════════════════════════════════════════

/**
 * REALISTIC DEBT LOGIC - Russian banks
 * Формула аннуитетного платежа (самая распространённая в РФ):
 *   monthly = P × [i × (1 + i)^n] / [(1 + i)^n - 1]
 * где P - сумма кредита, i - месячная ставка (годовая ÷ 12 ÷ 100), n - срок в месяцах.
 * При ставке 0 (беспроцентная рассрочка) возвращаем P / N.
 */
function calculateAnnuityPayment(loanAmount, annualRatePct, termMonths) {
  var P = Number(loanAmount) || 0;
  var Rpct = Number(annualRatePct) || 0;
  var N = Number(termMonths) || 0;
  if (P <= 0 || N <= 0) return 0;
  if (Rpct <= 0) return Math.round(P / N); // беспроцентная рассрочка
  var i = Rpct / 12 / 100;
  var pow = Math.pow(1 + i, N);
  var monthly = P * (i * pow) / (pow - 1);
  return Math.round(monthly);
}

/**
 * REALISTIC DEBT LOGIC - Russian banks
 * Пересчёт оставшегося срока кредита после досрочного частичного погашения:
 *   n = -log(1 - i × balance / payment) / log(1 + i)
 * Возвращает число месяцев (округлённое вверх). Если payment <= balance × i -
 * банк не даст погасить (платёж меньше начисляемых процентов), возвращаем Infinity.
 */
function calculateRemainingTerm(remainingBalance, monthlyPayment, annualRatePct) {
  var B = Number(remainingBalance) || 0;
  var P = Number(monthlyPayment) || 0;
  var Rpct = Number(annualRatePct) || 0;
  if (B <= 0) return 0;
  if (P <= 0) return Infinity;
  if (Rpct <= 0) return Math.ceil(B / P);
  var i = Rpct / 12 / 100;
  var ratio = 1 - (i * B) / P;
  if (ratio <= 0) return Infinity; // платёж покрывает только проценты
  var n = -Math.log(ratio) / Math.log(1 + i);
  return Math.ceil(n);
}

/**
 * REALISTIC DEBT LOGIC - Russian banks
 * Суммарная переплата = полный поток платежей − исходный кредит.
 * Используется в UI для строки «осталось переплатить X ₽».
 */
function calculateTotalInterest(loanAmount, monthlyPayment, termMonths) {
  var P = Number(loanAmount) || 0;
  var pay = Number(monthlyPayment) || 0;
  var N = Number(termMonths) || 0;
  if (P <= 0 || pay <= 0 || N <= 0) return 0;
  return Math.max(0, Math.round(pay * N - P));
}

/**
 * REALISTIC DEBT LOGIC - Russian banks
 * Статус льготного периода для кредитной карты.
 *
 * Логика РФ-банков:
 *   • Период считается от lastFullPayDate (последнее полное закрытие долга);
 *     если карта новая (нет lastFullPayDate) - от startDate; иначе - от сегодня.
 *   • В течение gracePeriodDays процент не начисляется.
 *   • После окончания grace - минимальный платёж = minPaymentPercent от долга
 *     плюс начисленные проценты (annualRate / 12 от остатка).
 *
 * Возвращает: {
 *   inGrace,            // true пока внутри льготного периода
 *   daysLeft,           // дней до окончания grace (0 если уже вышли)
 *   minPayment,         // минимальный платёж (после grace = % от долга + проценты)
 *   accruedInterest,    // начисленные проценты за прошедший месяц (после grace)
 *   graceEndDate        // ISO date окончания текущего grace-периода
 * }
 */
function calculateCardGraceInfo(debt) {
  var remaining = Number(debt.remainingAmount) || 0;
  var graceDays = Number(debt.gracePeriodDays) || 0;
  var minPct = Number(debt.minPaymentPercent) || 0;
  var annualRate = Number(debt.interestRate) || 0;

  if (remaining <= 0) {
    return { inGrace: false, daysLeft: 0, minPayment: 0, accruedInterest: 0, graceEndDate: "" };
  }

  // Точка отсчёта льготного периода.
  var startStr = debt.lastFullPayDate || debt.startDate || "";
  var graceStart = startStr ? new Date(startStr) : new Date();
  if (isNaN(graceStart.getTime())) graceStart = new Date();
  graceStart.setHours(0, 0, 0, 0);

  var graceEnd = new Date(graceStart);
  graceEnd.setDate(graceEnd.getDate() + graceDays);

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var msPerDay = 24 * 60 * 60 * 1000;
  var daysLeft = Math.max(0, Math.ceil((graceEnd.getTime() - today.getTime()) / msPerDay));
  var inGrace = today.getTime() <= graceEnd.getTime() && graceDays > 0;

  var monthlyInterest = inGrace ? 0 : Math.round(remaining * annualRate / 12 / 100);
  var pctPart = Math.round(remaining * minPct / 100);
  var minPayment = inGrace ? 0 : (pctPart + monthlyInterest);

  return {
    inGrace: inGrace,
    daysLeft: daysLeft,
    minPayment: minPayment,
    accruedInterest: monthlyInterest,
    graceEndDate: graceEnd.toISOString().slice(0, 10)
  };
}

/**
 * REALISTIC DEBT LOGIC - Russian banks
 * Агрегированные UI-показатели по одному долгу.
 *
 * Возвращает: {
 *   alreadyPaid,            // сколько уже выплачено (loanAmount − remaining)
 *   alreadyPaidPercent,     // процент выплаченности (0..100)
 *   totalInterest,          // общая переплата за весь срок (приблизительно)
 *   interestRemaining,      // сколько процентов осталось переплатить
 *   estimatedPayoffMonths,  // прогнозный срок полного погашения с текущим платежом
 *   estimatedPayoffDate,    // ISO date предполагаемого финального платежа
 *   isCard, grace           // только для type=card - расширенная инфа по grace
 * }
 */
function getDebtStats(debt) {
  if (!debt) return null;
  var isCard = debt.type === "card";
  var loanAmount = Number(debt.loanAmount) || Number(debt.totalAmount) || 0;
  var remaining = Number(debt.remainingAmount) || 0;
  var monthly = Number(debt.monthlyPayment) || 0;
  var rate = Number(debt.interestRate) || 0;
  var term = Number(debt.termMonths) || 0;

  var alreadyPaid = Math.max(0, loanAmount - remaining);
  var alreadyPaidPercent = loanAmount > 0 ? Math.min(100, Math.round((alreadyPaid / loanAmount) * 100)) : 0;

  var totalInterest = calculateTotalInterest(loanAmount, monthly, term);

  // Доля процентов в остатке: пропорционально остатку основного долга.
  // Это приближённая оценка - точный расчёт требует знания графика погашения.
  var interestRemaining = loanAmount > 0
    ? Math.round(totalInterest * (remaining / loanAmount))
    : 0;

  // Прогнозный срок: для кредитов - пересчёт по формуле, для остального - деление.
  var estimatedMonths;
  if (isCard) {
    // Для карты используем минимальный платёж, если ежемесячный не задан.
    var grace = calculateCardGraceInfo(debt);
    var effectiveMonthly = monthly > 0 ? monthly : grace.minPayment;
    estimatedMonths = effectiveMonthly > 0
      ? calculateRemainingTerm(remaining, effectiveMonthly, rate)
      : Infinity;
  } else {
    estimatedMonths = calculateRemainingTerm(remaining, monthly, rate);
  }

  var estimatedPayoffDate = "";
  if (estimatedMonths !== Infinity && estimatedMonths > 0) {
    var d = new Date();
    d.setMonth(d.getMonth() + estimatedMonths);
    estimatedPayoffDate = d.toISOString().slice(0, 10);
  }

  var stats = {
    alreadyPaid: alreadyPaid,
    alreadyPaidPercent: alreadyPaidPercent,
    totalInterest: totalInterest,
    interestRemaining: interestRemaining,
    estimatedPayoffMonths: estimatedMonths,
    estimatedPayoffDate: estimatedPayoffDate,
    isCard: isCard
  };
  if (isCard) {
    stats.grace = calculateCardGraceInfo(debt);
  }
  return stats;
}

function getDebtMonthlyTotal() {
  var s = getState();
  if (!s.debtPlanningMode) return 0;
  var debts = s.debts || [];
  var total = 0;
  debts.forEach(function (d) {
    if (d.isActive === false) return;
    // REALISTIC DEBT LOGIC - Russian banks - для кредитных карт в льготном
    // периоде ежемесячный платёж = 0 (банк не требует выплат, проценты не
    // начисляются). После окончания grace - минимальный платёж.
    if (d.type === "card") {
      var grace = calculateCardGraceInfo(d);
      if (grace.inGrace) return; // в льготном периоде - не учитываем
      // Если monthlyPayment задан вручную - используем его, иначе минимальный.
      var cardPay = (Number(d.monthlyPayment) || 0) > 0
        ? Number(d.monthlyPayment)
        : grace.minPayment;
      total += cardPay;
      return;
    }
    total += (Number(d.monthlyPayment) || 0);
  });
  return total;
}

/**
 * Distribute a repayment amount across active debts.
 * Priority: earliest nextPaymentDate first, then smallest remainingAmount.
 * Returns { applied: totalApplied, details: [{debtId, amount}] }.
 * Mutates debt objects in place (reduces remainingAmount, marks inactive if 0).
 */
function applyDebtRepayment(amount) {
  if (!amount || amount <= 0) return { applied: 0, details: [] };

  var s = getState();
  var debts = s.debts || [];
  var active = [];
  debts.forEach(function (d, idx) {
    if (d.isActive !== false && (Number(d.remainingAmount) || 0) > 0) {
      active.push({ debt: d, _origIdx: idx });
    }
  });

  if (active.length === 0) return { applied: 0, details: [] };

  active.sort(function (a, b) {
    var dateA = a.debt.nextPaymentDate ? new Date(a.debt.nextPaymentDate).getTime() : Infinity;
    var dateB = b.debt.nextPaymentDate ? new Date(b.debt.nextPaymentDate).getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;
    var remA = Number(a.debt.remainingAmount) || 0;
    var remB = Number(b.debt.remainingAmount) || 0;
    if (remA !== remB) return remA - remB;
    return a._origIdx - b._origIdx;
  });

  var remaining = amount;
  var details = [];

  active.forEach(function (entry) {
    if (remaining <= 0) return;
    var debt = entry.debt;
    var owed = Number(debt.remainingAmount) || 0;
    var pay = Math.min(remaining, owed);
    if (pay <= 0) return;

    debt.remainingAmount = Math.max(0, owed - pay);
    remaining -= pay;
    details.push({ debtId: debt.id, amount: pay });

    if (debt.remainingAmount <= 0) {
      debt.remainingAmount = 0;
      debt.isActive = false;
      // REALISTIC DEBT LOGIC - Russian banks - при полном погашении карты
      // фиксируем дату закрытия как точку отсчёта нового grace-периода
      // (если пользователь снова воспользуется лимитом).
      if (debt.type === "card") {
        debt.lastFullPayDate = new Date().toISOString().slice(0, 10);
      }
    } else if (debt.nextPaymentDate) {
      var nd = new Date(debt.nextPaymentDate);
      nd.setMonth(nd.getMonth() + 1);
      debt.nextPaymentDate = nd.toISOString().split("T")[0];
    }
  });

  var totalApplied = amount - remaining;
  if (totalApplied > 0) {
    updateState({ debts: debts });
    saveFullState();
  }

  return { applied: totalApplied, details: details };
}

/**
 * Returns total monthly debt payment for active debts (regardless of toggle).
 */
function getActiveDebtMonthlyPayment() {
  var debts = getState().debts || [];
  var total = 0;
  debts.forEach(function (d) {
    if (d.isActive !== false && (Number(d.remainingAmount) || 0) > 0) {
      total += (Number(d.monthlyPayment) || 0);
    }
  });
  return total;
}

function addDebtPaymentRecord(opts) {
  var s = getState();
  var history = Array.isArray(s.debtPaymentHistory) ? s.debtPaymentHistory.slice() : [];
  history.push({
    id: "dp_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    debtId: opts.debtId,
    amount: opts.amount,
    date: new Date().toISOString(),
    source: opts.source || "manual",
    totalInput: opts.totalInput || 0,
    savingsPart: opts.savingsPart || 0
  });
  updateState({ debtPaymentHistory: history });
  saveFullState();
}

var _debtBreakdownTimer = null;
function showDebtBreakdown(total, debtPart, savingsPart) {
  var el = document.getElementById("debtBreakdownBlock");
  if (!el) return;
  el.innerHTML =
    '<div class="debt-breakdown-title">' + t("debts.breakdown.from", {amount: fmtAmount(total)}) + '</div>' +
    '<div class="debt-breakdown-line"><span class="debt-breakdown-dot debt-breakdown-dot--debt"></span>' + fmtConverted(debtPart) + ' ' + getCurrencySymbol() + ' ' + t("debts.breakdown.toDebt") + '</div>' +
    '<div class="debt-breakdown-line"><span class="debt-breakdown-dot debt-breakdown-dot--save"></span>' + fmtConverted(savingsPart) + ' ' + getCurrencySymbol() + ' ' + t("debts.breakdown.toSavings") + '</div>';
  el.classList.remove("debt-breakdown--hidden");
  el.classList.add("debt-breakdown--visible");

  if (_debtBreakdownTimer) clearTimeout(_debtBreakdownTimer);
  _debtBreakdownTimer = setTimeout(function () {
    el.classList.remove("debt-breakdown--visible");
    el.classList.add("debt-breakdown--hidden");
  }, 8000);
}

/**
 * Returns a stable period key string for the given debt.
 * Uses nextPaymentDate month if available, otherwise current calendar month.
 */
function getDebtPeriodKey(debt) {
  if (debt.nextPaymentDate) {
    var d = new Date(debt.nextPaymentDate);
    if (!isNaN(d.getTime())) {
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    }
  }
  var now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
}

/**
 * Advances debt periods when the current date has moved past nextPaymentDate.
 * Resets paidInCurrentPeriod when a new cycle begins.
 * Also initializes period-tracking fields for debts that lack them.
 */
function advanceDebtPeriods() {
  var s = getState();
  var debts = s.debts || [];
  if (debts.length === 0) return;

  var changed = false;
  var now = new Date();
  now.setHours(0, 0, 0, 0);

  debts.forEach(function (d) {
    if (d.isActive === false) return;
    if ((Number(d.remainingAmount) || 0) <= 0) return;

    if (typeof d.paidInCurrentPeriod !== "number") { d.paidInCurrentPeriod = 0; changed = true; }
    if (typeof d.currentPeriodKey !== "string") { d.currentPeriodKey = ""; changed = true; }

    if (d.nextPaymentDate) {
      var dueDate = new Date(d.nextPaymentDate);
      dueDate.setHours(0, 0, 0, 0);
      while (now.getTime() > dueDate.getTime() && (Number(d.remainingAmount) || 0) > 0) {
        dueDate.setMonth(dueDate.getMonth() + 1);
        d.nextPaymentDate = dueDate.toISOString().split("T")[0];
        d.paidInCurrentPeriod = 0;
        changed = true;
      }
    }

    var expectedKey = getDebtPeriodKey(d);
    if (d.currentPeriodKey !== expectedKey) {
      d.paidInCurrentPeriod = 0;
      d.currentPeriodKey = expectedKey;
      changed = true;
    }
  });

  if (changed) {
    updateState({ debts: debts });
    saveFullState();
  }
}

/**
 * Returns current-period obligations for all active debts.
 * Each obligation has: debt ref, dueForPeriod, paidSoFar, stillOwed.
 * Sorted by earliest nextPaymentDate, then smallest remainingAmount, then creation order.
 */
function getCurrentDebtObligations() {
  var s = getState();
  var debts = s.debts || [];
  var obligations = [];
  var totalDue = 0;

  debts.forEach(function (d, idx) {
    if (d.isActive === false) return;
    var remaining = Number(d.remainingAmount) || 0;
    if (remaining <= 0) return;

    // REALISTIC DEBT LOGIC - Russian banks - для карт в льготном периоде
    // обязательств нет; после grace берём minPayment, если monthlyPayment не задан.
    var monthly;
    if (d.type === "card") {
      var grace = calculateCardGraceInfo(d);
      if (grace.inGrace) return; // в льготном периоде нет обязательств
      monthly = (Number(d.monthlyPayment) || 0) > 0
        ? Number(d.monthlyPayment)
        : grace.minPayment;
    } else {
      monthly = Number(d.monthlyPayment) || 0;
    }
    if (monthly <= 0) return;

    var dueForPeriod = Math.min(monthly, remaining);
    var paidSoFar = Number(d.paidInCurrentPeriod) || 0;
    var stillOwed = Math.max(0, dueForPeriod - paidSoFar);

    if (stillOwed > 0) {
      obligations.push({ debt: d, _origIdx: idx, dueForPeriod: dueForPeriod, paidSoFar: paidSoFar, stillOwed: stillOwed });
      totalDue += stillOwed;
    }
  });

  obligations.sort(function (a, b) {
    var dateA = a.debt.nextPaymentDate ? new Date(a.debt.nextPaymentDate).getTime() : Infinity;
    var dateB = b.debt.nextPaymentDate ? new Date(b.debt.nextPaymentDate).getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;
    var remA = Number(a.debt.remainingAmount) || 0;
    var remB = Number(b.debt.remainingAmount) || 0;
    if (remA !== remB) return remA - remB;
    return a._origIdx - b._origIdx;
  });

  return { obligations: obligations, totalDue: totalDue };
}

/**
 * Auto-repayment: covers only the CURRENT period's unpaid obligations.
 * Does NOT advance nextPaymentDate (that is handled by advanceDebtPeriods).
 * Returns { applied, details: [{debtId, amount}] }.
 */
function applyAutoDebtRepayment(amount) {
  if (!amount || amount <= 0) return { applied: 0, details: [] };

  advanceDebtPeriods();

  var info = getCurrentDebtObligations();
  if (info.totalDue <= 0) return { applied: 0, details: [] };

  var pool = Math.min(amount, info.totalDue);
  var remaining = pool;
  var details = [];

  var s = getState();
  var debts = s.debts || [];

  info.obligations.forEach(function (ob) {
    if (remaining <= 0) return;
    var pay = Math.min(remaining, ob.stillOwed);
    if (pay <= 0) return;

    ob.debt.remainingAmount = Math.max(0, (Number(ob.debt.remainingAmount) || 0) - pay);
    ob.debt.paidInCurrentPeriod = (Number(ob.debt.paidInCurrentPeriod) || 0) + pay;
    remaining -= pay;
    details.push({ debtId: ob.debt.id, amount: pay });

    if (ob.debt.remainingAmount <= 0) {
      ob.debt.remainingAmount = 0;
      ob.debt.isActive = false;
      // REALISTIC DEBT LOGIC - Russian banks - отметка полного закрытия карты
      // для перерасчёта grace-периода при последующих покупках.
      if (ob.debt.type === "card") {
        ob.debt.lastFullPayDate = new Date().toISOString().slice(0, 10);
      }
    }
  });

  var totalApplied = pool - remaining;
  if (totalApplied > 0) {
    updateState({ debts: debts });
    saveFullState();
  }

  return { applied: totalApplied, details: details };
}

// ─── Phase 2: неполный (стартовый) месяц ──────────────────────────────
// Ключ месяца: год*12 + индекс месяца (0-11). Удобно сравнивать «тот же месяц».
function _monthKey(d) {
  return d.getFullYear() * 12 + d.getMonth();
}

// Ответ пользователя про расход — ТОЛЬКО если он относится к текущему
// календарному месяцу. Иначе { status:null } — расход считается полным.
function _partialExpenseForNow() {
  var pe = state.partialExpense;
  if (!pe || pe.status == null) return { status: null, paidAmount: 0 };
  if (pe.monthKey !== _monthKey(new Date())) return { status: null, paidAmount: 0 };
  return { status: pe.status, paidAmount: Number(pe.paidAmount) || 0 };
}

// true, если гибкая модель начата В ТЕКУЩЕМ месяце и со 2-го числа или позже
// (месяц неполный) — условие показа плашки про расход в стартовом месяце.
function _startedMidCurrentMonth() {
  var iso = state.cashflowStartedAt;
  if (!iso) return false;
  var d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return _monthKey(d) === _monthKey(new Date()) && d.getDate() >= 2;
}

// Сохраняет ответ пользователя на плашку про расход и пересчитывает план/график.
function _savePartialExpense(status, paidAmount) {
  updateState({
    partialExpense: {
      monthKey: _monthKey(new Date()),
      status: status,
      paidAmount: Number(paidAmount) || 0
    }
  });
  if (typeof saveFullState === "function") saveFullState();
  if (typeof recalcPlan === "function") recalcPlan();
  if (typeof renderProtocolAdviceGraph === "function") renderProtocolAdviceGraph();
}
window._savePartialExpense = _savePartialExpense;

// Показ/скрытие плашки «расход уже потрачен?» на экране графика. Показывается
// только: гибкая модель + старт со 2-го числа текущего месяца + есть месячный
// расход + ещё не отвечено в этом месяце.
function updatePartialExpenseBanner() {
  var banner = document.getElementById("csPartialExpenseBanner");
  if (!banner) return;
  var s = (typeof getState === "function") ? getState() : state;
  var isCashflow = (s.financialModel === "cashflow");
  var answered = _partialExpenseForNow().status !== null;
  var expFull = (lastCalc && lastCalc.currentMonthExpenseFull) || 0;
  var onPrimaryGoal = (typeof activeGoalIndex === "undefined") || activeGoalIndex === 0;
  var show = isCashflow && onPrimaryGoal && _startedMidCurrentMonth() && expFull > 0 && !answered;

  if (!show) { banner.style.display = "none"; return; }

  var now = new Date();
  var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  var daysLeft = Math.max(0, lastDay - now.getDate());
  var cs = (typeof getCurrencySymbol === "function") ? getCurrencySymbol() : "₽";
  var qEl = document.getElementById("csPartialExpenseQ");
  if (qEl) {
    qEl.textContent = t("cs.partialExpense.q", {
      days: daysLeft,
      amount: ((typeof fmtNum === "function") ? fmtNum(expFull) : expFull) + " " + cs
    });
  }
  var pw = document.getElementById("csPartialExpensePartialWrap");
  if (pw) pw.style.display = "none";
  banner.style.display = "";
}
window.updatePartialExpenseBanner = updatePartialExpenseBanner;

function recalcPlan() {
  // ── Engine recalculation (когда план активен) ──
  if (isInitialized && chosenPlan && typeof CashflowEngine !== "undefined") {
    var goalVal = parseNumber(goalInput?.value || "0");
    var s = getState();
    var modelType = s.financialModel || "simple";
    var incomeVal = parseNumber(incomeInput?.value || "0");
    var expensesVal = parseNumber(expensesInput?.value || "0") + getDebtMonthlyTotal();

    // NEW: логика fixed vs variable 11.05.2026 - no override here.
    // • In FIXED mode the simple-model fields (incomeInput / expensesInput) are the single
    //   source of truth (already parsed into incomeVal/expensesVal above).
    // • In VARIABLE mode the engine runs in "cashflow" model_type and derives the forecast
    //   from cashflowEvents (see assembleCashflowEvents), so baseConfig.income is ignored.

    var canRecalc = goalVal > 0 && (incomeVal > expensesVal || modelType === "cashflow");
    if (canRecalc) {
      // Phase 2: фиксируем дату старта гибкой модели (один раз), чтобы понимать
      // неполный стартовый месяц для плашки про расход и ETA.
      // ВАЖНО: ставим только для НОВОГО старта (нет истории отложений), иначе
      // существующие пользователи при апгрейде получили бы дату «сегодня» и им
      // ошибочно показалась бы плашка. У уже копящих факт-история не пуста →
      // дату не ставим → плашка им не показывается. После «Начать сначала»
      // история очищается, поэтому новый неполный месяц учитывается корректно.
      var _noFactYet = !Array.isArray(factHistory) || factHistory.length === 0;
      if (modelType === "cashflow" && !state.cashflowStartedAt && _noFactYet) {
        updateState({ cashflowStartedAt: new Date().toISOString() });
      }
      var _pe = _partialExpenseForNow();

      var events = assembleCashflowEvents();
      var engine = new CashflowEngine({
        modelType: modelType,
        baseConfig: {
          goal: goalVal,
          income: incomeVal,
          expenses: expensesVal,
          saved: initialBalance,
          mode: saveMode,
          hasReserve: chosenPlan === "buffer",
          // Phase 2: ответ на плашку «расход уже потрачен?» в стартовом месяце.
          currentMonthExpenseStatus: _pe.status,
          currentMonthExpensePaidAmount: _pe.paidAmount
        },
        events: events
      });
      var derived = engine.recalculate();

      updateState({ derivedState: derived });

      if (derived.ok) {
        lastCalc.ok = true;
        lastCalc.free = derived.free;
        lastCalc.pace = derived.pace;
        lastCalc.monthlySave = derived.monthlySave;
        lastCalc.months = derived.monthsLeft;
        lastCalc.effectiveGoal = Math.max(0, derived.remainingGoal);
        lastCalc.forecastIncome = derived.forecastIncome || 0;
        lastCalc.forecastExpense = derived.forecastExpense || 0;
        // Phase 1: значения текущего (неполного) календарного месяца.
        lastCalc.currentMonthIncome = (derived.currentMonthIncome != null) ? derived.currentMonthIncome : null;
        lastCalc.currentMonthExpense = (derived.currentMonthExpense != null) ? derived.currentMonthExpense : 0;
        lastCalc.currentMonthFree = (derived.currentMonthFree != null) ? derived.currentMonthFree : 0;
        lastCalc.currentMonthSave = (derived.currentMonthSave != null) ? derived.currentMonthSave : 0;
        // Phase 2: вклад неполного месяца в цель + флаг неполного месяца (для графика/срока).
        lastCalc.currentMonthToGoal = (derived.currentMonthToGoal != null) ? derived.currentMonthToGoal : 0;
        lastCalc.currentMonthExpenseFull = (derived.currentMonthExpenseFull != null) ? derived.currentMonthExpenseFull : 0;
        lastCalc.isPartialMonth = !!derived.isPartialMonth;

        accounts.main = derived.currentGoalBalance;
        accounts.reserve = derived.reserveBalance;
        plannedMonthly = derived.plannedToGoal;
      }
    }
  }

  // ── Sync UI state ──
  // OPTIMIZATION: DOM cache в hot-path recalcPlan.
  state.goalTotal = parseNumber(getEl("goal")?.value || "0");
  state.goalSaved = accounts.main;
  state.reserveAmount = accounts.reserve;
  state.monthlyContribution = plannedMonthly;
  state.monthsLeft = lastCalc.months || 0;
  state.mode = chosenPlan;
  state.hasReserve = chosenPlan === "buffer";

  // ── Multi-goal allocation ──
  var goalsArr = getGoals();
  if (goalsArr.length > 0 && plannedMonthly > 0) {
    syncGoalsFromPrimary();
    computeGoalsAllocation(goalsArr, plannedMonthly);
    persistGoals(goalsArr);
  }

  // After allocation, sync state to active goal's derived values
  var activeGoalForState = goalsArr[activeGoalIndex] || null;
  if (goalsArr.length > 1 && activeGoalForState) {
    state.monthlyContribution = activeGoalForState.monthlyShare || 0;
    state.monthsLeft = activeGoalForState.monthsLeft || 0;
  }

  renderGoals();
  renderAccountsUI();

  // OPTIMIZATION: DOM cache в hot-path recalcPlan.
  const summaryMonthsEl = getEl("summaryMonths");
  if (summaryMonthsEl && state.monthsLeft) {
    summaryMonthsEl.innerText = state.monthsLeft;
  }

  if (lastCalc.ok) {
    checkMonthTransition();
    renderSVGGraph();
  }

  if (typeof updateGraphGoalIndicator === "function") updateGraphGoalIndicator();
  if (typeof updateAccountsLocalNav === "function") updateAccountsLocalNav();

  updatePlanHeader();
  syncFlexibleUI();
  saveFullState();
}

/**
 * Сохраняет все данные приложения через storage layer.
 * Синхронизирует глобальные переменные → appState → storage.
 * localStorage - мгновенно. Supabase - через debounce (1 с).
 */
var _supabaseSaveTimer = null;
var SUPABASE_SAVE_DELAY = 1000;

function saveFullState() {
  // OPTIMIZATION: DOM cache (saveFullState вызывается часто - после каждого изменения).
  var fixedIncomeEl = getEl("fixedIncomeInput");
  var fixedExpenseEl = getEl("fixedExpenseInput");
  syncGoalsFromPrimary();
  updateState({
    income: incomeInput?.value?.trim() || "",
    expenses: expensesInput?.value?.trim() || "",
    goal: goalInput?.value?.trim() || "",
    saved: savedInput?.value?.trim() || "",
    saveMode: saveMode || "calm",
    factHistory: factHistory,
    lastCalc: lastCalc?.ok ? lastCalc : {},
    accounts: { ...accounts },
    chosenPlan,
    plannedMonthly,
    planStartValue,
    initialBalance,
    factRatio,
    goalCompleted,
    selectedScenario,
    isInitialized: !!isInitialized,
    goalMeta: { ...goalMeta },
    activeGoalIndex: activeGoalIndex,
    uiState: { ...state },
    fixedIncomeAmount: fixedIncomeEl ? fixedIncomeEl.value.trim() : (getState().fixedIncomeAmount || ""),
    fixedExpenseAmount: fixedExpenseEl ? fixedExpenseEl.value.trim() : (getState().fixedExpenseAmount || "")
  });
  var serialized = saveState();

  if (window.saveAppState && serialized) {
    if (_supabaseSaveTimer) clearTimeout(_supabaseSaveTimer);
    var snapshot = JSON.parse(JSON.stringify(serialized));
    _supabaseSaveTimer = setTimeout(function () {
      _supabaseSaveTimer = null;
      var p = window.saveAppState(snapshot);
      if (p && typeof p.catch === "function") {
        p.catch(function (err) {
          console.error("[App] saveAppState:", err);
        });
      }
    }, SUPABASE_SAVE_DELAY);
  }

  // CLOUD STORAGE SYNC - debounced push в Telegram CloudStorage.
  // Кросс-устройственный sync без бэкенда: те же данные становятся
  // доступны на другом устройстве пользователя через Telegram.
  // scheduleSync сам обрабатывает available()-check и debounce.
  if (window.CloudSync && typeof window.CloudSync.scheduleSync === "function") {
    try { window.CloudSync.scheduleSync(); } catch (e) { /* graceful */ }
  }
}

/**
 * Загружает все данные из storage layer при запуске приложения.
 * Читает appState (заполнен через initState()) → синхронизирует глобальные переменные → восстанавливает UI.
 */
function loadFullState() {
  try {
    const s = initState();

    // Синхронизируем глобальные переменные ← appState
    if (s.income && incomeInput) incomeInput.value = s.income;
    if (s.expenses && expensesInput) expensesInput.value = s.expenses;
    if (s.goal && goalInput) goalInput.value = s.goal;
    if (s.saved && savedInput) savedInput.value = s.saved;
    var fixedIncomeInputEl = document.getElementById("fixedIncomeInput");
    var fixedExpenseInputEl = document.getElementById("fixedExpenseInput");
    if (fixedIncomeInputEl && (s.fixedIncomeAmount != null && s.fixedIncomeAmount !== "")) fixedIncomeInputEl.value = s.fixedIncomeAmount;
    if (fixedExpenseInputEl && (s.fixedExpenseAmount != null && s.fixedExpenseAmount !== "")) fixedExpenseInputEl.value = s.fixedExpenseAmount;

    if (s.saveMode) {
      saveMode = s.saveMode;
      selectedMode = s.saveMode;
      modeButtons.forEach(b => {
        b.classList.toggle("active", b.dataset.mode === s.saveMode);
      });
    }

    factHistory = s.factHistory || [];

    if (s.lastCalc && s.lastCalc.ok) lastCalc = s.lastCalc;
    if (s.accounts) {
      accounts.main = Number(s.accounts.main) || 0;
      accounts.reserve = Number(s.accounts.reserve) || 0;
    }
    if (s.chosenPlan != null) chosenPlan = s.chosenPlan;
    if (s.plannedMonthly != null) plannedMonthly = s.plannedMonthly;
    if (s.planStartValue != null) planStartValue = s.planStartValue;
    if (s.initialBalance != null) initialBalance = Number(s.initialBalance) || 0;
    if (s.factRatio != null) factRatio = Number(s.factRatio) || null;
    if (typeof s.goalCompleted === "boolean") goalCompleted = s.goalCompleted;
    if (s.selectedScenario != null) selectedScenario = s.selectedScenario;
    if (typeof s.isInitialized === "boolean") isInitialized = s.isInitialized;
    if (s.goalMeta && typeof s.goalMeta === "object") Object.assign(goalMeta, s.goalMeta);
    if (s.uiState && typeof s.uiState === "object") Object.assign(state, s.uiState);

    if (typeof s.activeGoalIndex === "number") activeGoalIndex = s.activeGoalIndex;

    if (s.settings) {
      window._protocolNumberFormat = s.settings.numberFormat || "spaces";
      document.body.classList.toggle("reduce-motion", !s.settings.animationsEnabled);
      if (s.settings.exchangeRates && s.settings.exchangeRates.USD) {
        _exchangeRates.USD = s.settings.exchangeRates.USD;
        _exchangeRates.EUR = s.settings.exchangeRates.EUR;
        _exchangeRates._ts = s.settings.exchangeRates.lastUpdated || 0;
      }
    }
    if (typeof applyLanguageToDOM === "function") applyLanguageToDOM();

    ensureDefaultGoal();
    advanceDebtPeriods();

    if (isInitialized) {
      lockTabs(false);
      planSummary.style.display = "block";
      if (summaryMonthly && lastCalc.monthlySave) summaryMonthly.innerText = fmtConverted(lastCalc.monthlySave);
      if (summaryMonths && lastCalc.months) summaryMonths.innerText = lastCalc.months;
      if (summaryMode) summaryMode.innerText = t("mode." + saveMode);
      document.querySelectorAll("#screen-calc label, #screen-calc .input-wrap, .mode-buttons, #calculate").forEach(el => el.style.display = "none");
      renderAccountsUI();
      renderGoals();

      if (chosenPlan && lastCalc?.ok) {
        if (!plannedMonthly || plannedMonthly === 0) {
          plannedMonthly = lastCalc.monthlySave;
          if (chosenPlan === "buffer") plannedMonthly = Math.round(plannedMonthly * 0.9);
        }

        // Восстанавливаем последнюю активную вкладку
        const targetScreen = s.lastActiveScreen || "advice";
        const screenToNavIndex = { calc: 0, advice: 1, accounts: 2, goals: 3, ai: 4 };
        const navIdx = screenToNavIndex[targetScreen] != null
          ? screenToNavIndex[targetScreen]
          : 1;

        openScreen(targetScreen, buttons[navIdx]);
        if (loader) loader.classList.add("hidden");

        // Навбар и стили кнопок - сразу, без rAF, чтобы не пропадал при восстановлении на любой вкладке
        lockTabs(false);
        showBottomNav();
        if (buttons[navIdx]) {
          buttons.forEach(b => b.classList.remove("active"));
          buttons[navIdx].classList.add("active");
          moveIndicator(buttons[navIdx]);
        }

        // Сразу подменяем «загрузку» на график, если восстановились на вкладку графика
        if (targetScreen === "advice") {
          try {
            renderProtocolAdviceGraph();
            if (factHistory.length) runBrain();
          } catch (err) {
            console.warn("Restore graph error:", err);
            if (adviceCard) adviceCard.innerHTML = "<p style='padding:20px'>" + t("protocol.loadFailed") + "</p>";
            if (loader) loader.classList.add("hidden");
          }
        }

        if (targetScreen === "ai" && typeof renderExpensesScreen === "function") {
          renderExpensesScreen();
        }

        requestAnimationFrame(() => {
          lockTabs(false);
          showBottomNav();
          ensureNavVisibleAfterRestore();
        });
      } else if (lastCalc?.ok) {
        const advice = CashflowEngine.buildAdvice(lastCalc);
        const baseMonthly = lastCalc.monthlySave;
        const bufferRate = 0.1;
        const scenarios = [
          {
            id: "direct",
            title: t("scenario.direct"),
            toGoal: baseMonthly,
            toBuffer: 0,
            months: lastCalc.months,
            risk: t("scenario.riskHigh")
          },
          {
            id: "buffer",
            title: t("scenario.buffer"),
            toGoal: Math.round(baseMonthly * (1 - bufferRate)),
            toBuffer: Math.round(baseMonthly * bufferRate),
            months: Math.ceil(
              lastCalc.effectiveGoal /
              Math.round(baseMonthly * (1 - bufferRate))
            ),
            risk: t("scenario.riskLow")
          }
        ];
        const scenariosHTML = scenarios.map(s => `
<div class="card scenario-card" data-id="${s.id}">
<div style="color:#fff;font-weight:600;font-size:19px;margin-bottom:12px">
${s.title}
</div>

${t("scenario.toGoal")}: ${fmtConverted(s.toGoal)} ${getCurrencySymbol()} ${t("scenario.perMonth")}<br>
${s.toBuffer ? `${t("scenario.toReserve")}: ${fmtConverted(s.toBuffer)} ${getCurrencySymbol()}<br>` : ""}
${t("scenario.term")}: ~${s.months} ${t("scenario.months")}<br>

<span style="opacity:.6">${t("scenario.risk")}: ${s.risk}</span>

${
s.id === "buffer"
? `
<div class="reserve-info reserve-ui">
<b>${t("scenario.reserveInfo")}</b><br>
${t("scenario.reserveDesc").replace(/\n/g, "<br>")}
</div>
`
: ""
}
</div>
`).join("");
        openScreen("advice", null);
        hideBottomNav();
        if (protocolBack) protocolBack.style.display = "block";
        renderProtocolResult({ scenariosHTML, advice });
      } else {
        openScreen("calc", buttons[0]);
        hideBottomNav();
      }
    } else {
      lockTabs(true);
      planSummary.style.display = "none";
    }
  } catch (e) {
    console.warn("Failed to load state:", e);
  }
}

// Загружаем сохранённые данные при запуске
loadFullState();

(async () => {
  try {
    if (!window.loadAppState) return;

    var remote = await window.loadAppState();

    if (!remote || !remote.data || typeof remote.data !== "object") {
      console.log("[Sync] No remote state found");
      return;
    }

    var localState = loadState();

    var localTimestamp = (localState && localState.lastSavedAt) ? localState.lastSavedAt : null;
    var remoteTimestamp = (remote.data && remote.data.lastSavedAt)
      ? remote.data.lastSavedAt
      : (remote.updated_at || null);

    console.log("[Sync] Local timestamp:", localTimestamp || "(none)");
    console.log("[Sync] Remote timestamp:", remoteTimestamp || "(none)");

    if (!localState) {
      console.log("[Sync] No local state - applying remote state");
      applyState(migrateState(remote.data));
      saveState();
      loadFullState();
      return;
    }

    if (!remoteTimestamp) {
      console.log("[Sync] No valid remote timestamp - keeping local state");
      return;
    }

    var localDate = localTimestamp ? new Date(localTimestamp) : null;
    var remoteDate = new Date(remoteTimestamp);

    if (isNaN(remoteDate.getTime())) {
      console.log("[Sync] Invalid remote timestamp - keeping local state");
      return;
    }

    if (!localDate || isNaN(localDate.getTime())) {
      console.log("[Sync] Invalid or missing local timestamp - applying remote state");
      applyState(migrateState(remote.data));
      saveState();
      loadFullState();
      return;
    }

    if (remoteDate.getTime() > localDate.getTime()) {
      console.log("[Sync] Remote is newer - applying remote state");
      applyState(migrateState(remote.data));
      saveState();
      loadFullState();
    } else {
      console.log("[Sync] Keeping local state (local is newer or equal)");
    }

  } catch (e) {
    console.error("[Sync] Error during remote state comparison:", e);
  }
})();

// CLOUD STORAGE SYNC - старт-pull из Telegram CloudStorage.
// ─────────────────────────────────────────────────────────────────────────────
// На старте сравниваем cloud.lastSavedAt с local.lastSavedAt. Если cloud
// новее (пользователь работал с другого устройства) - применяем cloud,
// перезаписываем localStorage и UI. Если local новее или равен - оставляем
// local и push'им local в cloud в фоне (чтобы синхронизировать обратное
// направление). Конфликтов нет - побеждает более свежий timestamp.
//
// pull инициализируется ПОСЛЕ Telegram WebApp.ready (когда CloudStorage
// гарантированно доступен) и ПОСЛЕ loadFullState (когда appState уже
// загружен из localStorage).
(function bootCloudSync() {
  function tryPull() {
    if (!window.CloudSync) return;
    if (!window.CloudSync.available()) {
      console.log("[CloudSync] CloudStorage недоступен - пропускаем pull");
      return;
    }
    window.CloudSync.pullFromCloud().then(function (applied) {
      if (!applied) {
        // local победил → отправляем local в cloud (если ещё не отправляли).
        window.CloudSync.scheduleSync();
      }
    }).catch(function (e) {
      console.warn("[CloudSync] pullFromCloud failed:", e && e.message);
    });
  }
  if (document.readyState === "complete") {
    setTimeout(tryPull, 600);
  } else {
    window.addEventListener("load", function () { setTimeout(tryPull, 600); });
  }
})();

// PREMIUM ACCESS CONTROL + ADMIN ONLY: community stats block
// ─────────────────────────────────────────────────────────────────────────────
// Синхронизация user-level access-флагов с таблицей users в Supabase:
//   • is_premium            - разблокирует 5 премиум-функций (Изменить темп,
//                             Долги, Гибкая модель, Расширенные настройки,
//                             Статистика счёта).
//   • show_community_stats  - админский флаг показа блока «Статистика
//                             сообщества» в профиле (default false; включается
//                             вручную владельцем / администратором в БД).
//
// Пробуем дважды: сразу и через ~1.5с, потому что строка users создаётся
// в saveCurrentUser() через setTimeout(500мс) на window.load.
(function syncUserAccessFlagsFromDB() {
  // SUBSCRIPTION MODEL: вычисляет эффективный isPremium как
  // (server_is_premium && (premium_until === null || premium_until > now())).
  // Если БД говорит is_premium=true, но premium_until прошёл -
  // подписка считается истёкшей: локально ставим false и пишем false в БД
  // (self-healing - БД сама приведёт себя в порядок при следующем открытии).
  function computeEffectivePremium(flags) {
    if (!flags || flags.isPremium !== true) return false;
    if (!flags.premiumUntil) return false;
    var until = new Date(flags.premiumUntil).getTime();
    if (isNaN(until)) return false;
    return until > Date.now();
  }

  async function tick(attempt) {
    try {
      if (typeof window.fetchUserAccessFlags !== "function") return;
      var flags = await window.fetchUserAccessFlags();
      if (!flags) {
        if (attempt < 2) {
          setTimeout(function () { tick(attempt + 1); }, 1500);
        }
        return;
      }

      var hasState = (typeof appState !== "undefined") && appState;
      var curPremium = !!(hasState && appState.isPremium);
      var curStats   = !!(hasState && appState.showCommunityStats);

      var effectivePremium = computeEffectivePremium(flags);

      if (flags.isPremium === true && !effectivePremium && flags.premiumUntil) {
        console.log("[AccessFlags] подписка истекла (premium_until=" + flags.premiumUntil + ")");
      }

      var premiumChanged = curPremium !== effectivePremium;
      var statsChanged   = curStats   !== flags.showCommunityStats;

      console.log("[AccessFlags] users-флаги из БД:",
        "is_premium=" + flags.isPremium,
        "premium_until=" + flags.premiumUntil,
        "auto_renew=" + flags.autoRenew,
        "→ effectivePremium=" + effectivePremium);

      if (typeof updateState === "function") {
        updateState({
          isPremium:          effectivePremium,
          premiumUntil:       flags.premiumUntil || null,
          autoRenew:          flags.autoRenew === true,
          showCommunityStats: flags.showCommunityStats
        });
      } else if (hasState) {
        appState.isPremium          = effectivePremium;
        appState.premiumUntil       = flags.premiumUntil || null;
        appState.autoRenew          = flags.autoRenew === true;
        appState.showCommunityStats = flags.showCommunityStats;
      }
      if (typeof saveFullState === "function") saveFullState();

      // Перерисовываем premium-зависимый UI только если поменялся именно
      // premium-флаг - иначе обходимся без лишних DOM-операций.
      if (premiumChanged) {
        if (typeof window._syncPremiumUI === "function") window._syncPremiumUI();
        if (typeof renderAccountBackCards === "function") renderAccountBackCards();
      }
      // Блок community stats обновляем всегда - он зависит от showCommunityStats.
      if (typeof refreshProfileStats === "function") refreshProfileStats();
      // SUBSCRIPTION MODEL: status-block в премиум-модалке - обновляем всегда,
      // т.к. может поменяться premium_until или auto_renew.
      if (typeof window._refreshPremiumStatusBlock === "function") {
        window._refreshPremiumStatusBlock();
      }
      // Statschanged используется только для логирования - UI обновляется выше всегда.
      void statsChanged;

      // SUBSCRIPTION MODEL - три DM-триггера, все условия проверяются server-side
      // (дедупликация через renewal_reminder_at / premium_expired_notice_at).
      //
      //   (a) Reminder за 3 дня до окончания - если подписка активна и кончается скоро.
      //   (b) Expired notice - если подписка была, но истекла. Клиент дёргает endpoint;
      //       backend проверяет premium_expired_notice_at и отправит только один раз
      //       за подписочный период.
      if (flags.premiumUntil) {
        var endsAt = new Date(flags.premiumUntil).getTime();
        if (!isNaN(endsAt)) {
          var msToExpiry = endsAt - Date.now();
          var THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

          if (effectivePremium && msToExpiry > 0 && msToExpiry <= THREE_DAYS) {
            if (typeof window.triggerRenewalReminder === "function") {
              window.triggerRenewalReminder().catch(function () { /* graceful */ });
            }
          }

          // (b) Подписка истекла (effectivePremium=false и premiumUntil в прошлом).
          // Backend сам решит, был ли уже отправлен expired-notice - мы только дёргаем.
          if (!effectivePremium && msToExpiry <= 0) {
            if (typeof window.triggerPremiumExpiredNotice === "function") {
              window.triggerPremiumExpiredNotice().catch(function () { /* graceful */ });
            }
          }
        }
      }
    } catch (e) {
      console.warn("[AccessFlags] syncUserAccessFlagsFromDB ошибка:", e && e.message);
    }
  }
  if (document.readyState === "complete") {
    setTimeout(function () { tick(1); }, 800);
  } else {
    window.addEventListener("load", function () { setTimeout(function () { tick(1); }, 800); });
  }
  window.syncUserAccessFlagsFromDB = function () { tick(1); };
})();

// REMINDERS — детект timezone браузера и запись в settings.tzOffsetMinutes.
// Это нужно Edge Function send-reminder чтобы понять, когда у пользователя
// наступает "час напоминаний" (settings.reminderTime - локальное время юзера).
// Запускаем после небольшой задержки, чтобы state уже был загружен с диска.
(function initTimezoneOffset() {
  function detect() {
    try {
      if (typeof getState !== "function" || typeof updateState !== "function") return;
      var s = getState();
      if (!s || !s.settings) return;
      var browserTz = -new Date().getTimezoneOffset(); // минуты к востоку от UTC (МСК = +180)
      if (!Number.isFinite(browserTz)) return;
      var saved = Number(s.settings.tzOffsetMinutes);
      if (saved === browserTz) return; // уже совпадает - ничего не делаем
      updateState({
        settings: Object.assign({}, s.settings, { tzOffsetMinutes: browserTz })
      });
    } catch (e) { /* noop - не критично */ }
  }
  if (document.readyState === "complete") {
    setTimeout(detect, 1200);
  } else {
    window.addEventListener("load", function () { setTimeout(detect, 1200); });
  }
})();

// Убираем зависший экран «Protocol анализирует данные…» (при повторном входе и при возврате без перезагрузки)
function repairAdviceScreenIfStuck() {
  const adviceScreen = document.getElementById("screen-advice");
  if (!adviceScreen || !adviceScreen.classList.contains("active")) return;
  if (!isInitialized || !chosenPlan || !lastCalc?.ok) return;
  const card = document.getElementById("adviceCard");
  if (!card || !card.querySelector("#fakeScreen")) return;
  if (loader) loader.classList.add("hidden");
  // SPLASH VIDEO BACKGROUND - на случай зависшего сплеша при возврате на экран.
  if (typeof hideSplashVideo === "function") hideSplashVideo();
  try {
    renderProtocolAdviceGraph();
    if (factHistory.length) runBrain();
    showBottomNav();
  } catch (e) {
    console.warn("repairAdviceScreenIfStuck:", e);
    card.innerHTML = "<p style='padding:20px'>" + t("protocol.loadError") + "</p><button type='button' id='repairGoToCalc'>" + t("protocol.goToCalc") + "</button>";
    document.getElementById("repairGoToCalc")?.addEventListener("click", function () {
      openScreen("calc", buttons[0]);
      hideBottomNav();
    });
  }
}

// Соответствие id экрана и индекса кнопки в навбаре
const SCREEN_TO_NAV_INDEX = { "screen-calc": 0, "screen-advice": 1, "screen-accounts": 2, "screen-goals": 3, "screen-ai": 4 };

// После повторного входа - показываем навбар, синхронизируем белый круг с открытой вкладкой, показываем зелёную кнопку на «Цели»
function ensureNavVisibleAfterRestore() {
  if (!isInitialized || !bottomNav) return;
  const activeScreen = document.querySelector(".screen.active");
  const id = activeScreen?.id;
  const isMainTab = id && ["screen-calc", "screen-advice", "screen-accounts", "screen-goals", "screen-ai"].includes(id);
  if (!isMainTab) return;
  showBottomNav();
  lockTabs(false);
  // Синхронизируем активную кнопку и индикатор с реально открытым экраном (исправляет «белый круг на Расчёте при открытых Целях»)
  const navIdx = SCREEN_TO_NAV_INDEX[id];
  if (navIdx != null && buttons[navIdx]) {
    buttons.forEach(b => b.classList.remove("active"));
    buttons[navIdx].classList.add("active");
    moveIndicator(buttons[navIdx]);
  }
  // Зелёная кнопка расширенных настроек - показывать только на вкладке «Цели»
  if (advancedBtn) {
    advancedBtn.style.display = "none";
  }
}

// После загрузки страницы - отложенная проверка (Telegram WebView может отрисовать DOM с задержкой)
setTimeout(function () {
  repairAdviceScreenIfStuck();
  ensureNavVisibleAfterRestore();
}, 350);
setTimeout(function () {
  repairAdviceScreenIfStuck();
  ensureNavVisibleAfterRestore();
}, 1000);

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") {
    document.body.classList.add("flip-fix-pending");
  } else if (document.visibilityState === "visible") {
    runFlipFixOnReturn();
    checkMonthTransition();
    setTimeout(repairAdviceScreenIfStuck, 100);
    setTimeout(ensureNavVisibleAfterRestore, 100);
  }
});
window.addEventListener("pageshow", function (e) {
  runFlipFixOnReturn();
  if (e.persisted) {
    setTimeout(repairAdviceScreenIfStuck, 100);
    setTimeout(ensureNavVisibleAfterRestore, 100);
  } else {
    setTimeout(repairAdviceScreenIfStuck, 350);
    setTimeout(ensureNavVisibleAfterRestore, 350);
  }
});

let goalEditBaseValue = null;
let goalEditHintTimeout = null;


/* ===== INPUT FORMAT ===== */
[incomeInput, expensesInput, goalInput, savedInput].forEach(input => {
input.addEventListener("input", e => {
const p = e.target.selectionStart;
const b = e.target.value.length;
e.target.value = formatNumber(e.target.value);
const a = e.target.value.length;
e.target.selectionEnd = p + (a - b);
});
});

function hideBottomNav() {
bottomNav.style.transform = "translateY(140%)";
bottomNav.style.opacity = "0";
bottomNav.style.pointerEvents = "none";
bottomNav.style.visibility = "hidden";
}

function showBottomNav() {
  bottomNav.style.transform = "translateY(0)";
  bottomNav.style.opacity = "1";
  bottomNav.style.pointerEvents = "auto";
  bottomNav.style.visibility = "visible";
  // Чтобы иконки не выглядели «заблокированными» после повторного входа
  buttons.forEach((b, i) => {
    b.style.pointerEvents = i === 0 && !isInitialized ? "none" : "auto";
    b.style.opacity = isInitialized ? "1" : (i === 0 ? "1" : "0.35");
  });
}

/* ============================================================
   ProtoSheet - Unified Sheet Helpers
   ============================================================ */

window.ProtoSheet = {
  open: function (sheetEl, overlayEl) {
    if (!sheetEl) return;
    sheetEl.style.transform = "";
    sheetEl.style.transition = "";
    if (overlayEl) overlayEl.style.display = "block";
    hideBottomNav();
    requestAnimationFrame(function () {
      sheetEl.classList.add("open");
    });
  },

  close: function (sheetEl, overlayEl, opts) {
    if (!sheetEl) return;
    opts = opts || {};
    sheetEl.style.transform = "";
    sheetEl.style.transition = "";
    sheetEl.classList.remove("open");
    setTimeout(function () {
      if (overlayEl) overlayEl.style.display = "none";
      showBottomNav();
      if (opts.onClosed) opts.onClosed();
    }, 500);
  },

  initSwipe: function (sheetEl, closeFn) {
    if (!sheetEl) return;
    var startY = 0;
    var dy = 0;
    var dragging = false;

    sheetEl.addEventListener("touchstart", function (e) {
      if (sheetEl.scrollTop > 5) return;
      startY = e.touches[0].clientY;
      dy = 0;
      dragging = true;
    }, { passive: true });

    sheetEl.addEventListener("touchmove", function (e) {
      if (!dragging) return;
      dy = e.touches[0].clientY - startY;
      if (dy < 0) { dy = 0; return; }
      sheetEl.style.transition = "none";
      sheetEl.style.transform = "translateY(" + dy + "px)";
    }, { passive: true });

    sheetEl.addEventListener("touchend", function () {
      if (!dragging) return;
      dragging = false;
      sheetEl.style.transition = "";
      if (dy > 80) {
        if (typeof haptic === "function") haptic("light");
        sheetEl.style.transform = "";
        closeFn();
      } else {
        sheetEl.style.transform = "";
        sheetEl.classList.add("open");
      }
    });
  },

  resetAll: function () {
    document.querySelectorAll(".proto-sheet").forEach(function (s) {
      s.classList.remove("open");
      s.style.transform = "";
      s.style.transition = "";
    });
    document.querySelectorAll(".proto-sheet-overlay").forEach(function (o) {
      o.style.display = "none";
    });
  }
};

/* ===== TAB LOCK ===== */
function lockTabs(lock) {
buttons.forEach((btn, i) => {
if (i === 0) return;
btn.style.opacity = lock ? "0.35" : "1";
btn.style.pointerEvents = lock ? "none" : "auto";
});
}
lockTabs(true);
calcLock.style.display = "none";
moveIndicator(buttons[0]);

/* ===== OPEN SCREEN ===== */
function openScreen(name, btn) {
  window.scrollTo(0, 0);

  var toast = document.getElementById("protocol-toast");
  if (toast) { clearTimeout(toast._toastTimeout); toast.remove(); }

  if (confirmReset) confirmReset.style.display = "none";

document.querySelectorAll(".screen")
  .forEach(s => s.classList.remove("active"));
document.getElementById("screen-" + name).classList.add("active");

moveProfileToActiveHeader();

buttons.forEach(b => b.classList.remove("active"));
if (btn) btn.classList.add("active");

if (btn) {
moveIndicator(btn);
} else {
indicator.style.opacity = "0";
}
clearFactInputError();

// туман только на экране «Расширенные настройки» - при любом другом экране снимаем
if (name !== "advanced") {
  document.body.classList.remove("advanced-active");
}

// floating кнопка + скрыта, вместо неё кнопка в блоке графика
if (advancedBtn) {
  advancedBtn.style.display = "none";
}

// Если перешли на вкладку графика, а там ещё «загрузка» (например после восстановления на Счета/Цели) - сразу рендерим график
if (name === "advice" && isInitialized && chosenPlan && lastCalc?.ok && adviceCard && adviceCard.querySelector("#fakeScreen")) {
  try {
    if (loader) loader.classList.add("hidden");
    // SPLASH VIDEO BACKGROUND - гарантированно скрываем сплеш при ручном возврате.
    if (typeof hideSplashVideo === "function") hideSplashVideo();
    renderProtocolAdviceGraph();
    if (factHistory.length) runBrain();
  } catch (e) {
    console.warn("openScreen advice render:", e);
  }
}

// Сохраняем последнюю активную вкладку в appState
const navScreens = ["calc", "advice", "accounts", "goals", "ai"];
if (navScreens.includes(name) && isInitialized) {
  const navIndex = navScreens.indexOf(name);
  updateState({ lastActiveScreen: name, lastActiveNavIndex: navIndex });
  saveFullState();
}

if (name === "advice") syncFlexibleUI();

// BUGFIX: при переходе на график граф НЕ всегда перерисовывается (только если
// в DOM остался #fakeScreen). Поэтому видимость поля факта / кнопок «Записать
// доход/расход» нужно синхронизировать здесь явно - иначе после настройки
// гибкой модели кнопки появлялись только после перезагрузки приложения.
if (name === "advice" && typeof updateFactInputVisibility === "function") {
  try { updateFactInputVisibility(); } catch (e) { /* noop */ }
}
if (name === "advice" && typeof updatePartialExpenseBanner === "function") {
  try { updatePartialExpenseBanner(); } catch (e) { /* noop */ }
}

// NEW: Full goal creation flow in Protocol tab - синхронизируем empty-state на Protocol
if (name === "advice" && typeof window._syncProtocolEmptyState === "function") {
  try { window._syncProtocolEmptyState(); } catch (e) { /* noop */ }
}

// FIX: goal completion UI - обновляем app-lock после смены экрана
//   (на #screen-new-goal лок снимается; на любом другом экране при пустой цели - включается)
if (typeof window._updateAppLock === "function") {
  try { window._updateAppLock(name); } catch (e) { /* noop */ }
}

replayNavIconForScreen(name);
}
// ===== TOP PROFILE FIX =====

buttons.forEach(btn => {
btn.onclick = () => {
haptic("light");

lastScreenBeforeProfile = btn.dataset.screen;
lastNavBtnBeforeProfile = btn;

openScreen(btn.dataset.screen, btn);

if (btn.dataset.screen === "goals") {
renderGoals();
}

if (btn.dataset.screen === "accounts") {
renderAccountsUI();
}

if (btn.dataset.screen === "ai") {
renderExpensesScreen();
}
};
});

const profileBack = document.getElementById("profileBack");
const historyBack = document.getElementById("historyBack");

if (historyBack) {
historyBack.onclick = () => {
haptic("light");
openScreen("accounts", buttons[2]); // вкладка "Счета"
};
}

if (profileBack) {
profileBack.onclick = () => {
haptic("light");

openScreen(lastScreenBeforeProfile, lastNavBtnBeforeProfile);

// показываем nav если план уже создан
if (isInitialized) {
showBottomNav();
} else {
hideBottomNav();
}
};
}

document.querySelectorAll(".account-block").forEach(block => {
  block.onclick = () => {

    const accountsScreen = document.getElementById("screen-accounts");
    if (!accountsScreen.classList.contains("active")) return;
    if (block._flipJustSwiped) return;

    const type = block.dataset.account;
    openAccountHistory(type);
  };
});

function openAccountHistory(type) {

const title = document.getElementById("historyTitle");
const list = document.getElementById("historyList");

title.innerText =
type === "reserve"
? t("history.reserveTitle")
: t("history.mainTitle");

list.innerHTML = "";

// 1️⃣ собираем операции
let entries = factHistory
.filter(f =>
type === "reserve"
? f.to === "reserve"
: f.to === "main"
)
.map(f => {
var displayDate = f.timestamp ? new Date(f.timestamp) : new Date(f.date);
if (isNaN(displayDate.getTime())) displayDate = new Date();
return {
  value: f.value,
  date: displayDate,
  isInitial: false,
  isSpent: f.value < 0
};
});

// 2️⃣ добавляем стартовый баланс как самую старую запись
if (type === "main" && initialBalance > 0) {
entries.push({
value: initialBalance,
date: new Date(0),
isInitial: true
});
}

// 3️⃣ если вообще пусто
if (entries.length === 0) {
list.innerHTML = `
<div class="card" style="opacity:.6;font-size:14px">
${t("history.noOps")}
</div>
`;
openScreen("progress", null);
return;
}

// 4️⃣ сортируем: новые сверху
entries.sort((a, b) => b.date - a.date);

// 5️⃣ рисуем
entries.forEach(e => {
var dd = String(e.date.getDate()).padStart(2, "0");
var mm = String(e.date.getMonth() + 1).padStart(2, "0");
var yyyy = e.date.getFullYear();
var formatted = dd + "." + mm + "." + yyyy;

if (e.isInitial) {
list.innerHTML += `
<div class="card" style="opacity:.85">
<div style="font-size:15px;font-weight:600">
${t("history.initialBalance")}: ${fmtConverted(e.value)} ${getCurrencySymbol()}
</div>
<div style="font-size:13px;opacity:.6;margin-top:4px">
${t("history.createdWithPlan")}
</div>
</div>
`;
} else if (e.isSpent) {
list.innerHTML += `
<div class="card">
<div style="font-size:15px;font-weight:600;color:#f59e0b">
−${fmtConverted(Math.abs(e.value))} ${getCurrencySymbol()}
</div>
<div style="font-size:13px;opacity:.6;margin-top:4px">
${formatted}
</div>
<div style="font-size:12px;opacity:.7;margin-top:2px">
${t("history.unplannedExpense")}
</div>
</div>
`;
} else {
list.innerHTML += `
<div class="card">
<div style="font-size:15px;font-weight:600">
+${fmtConverted(e.value)} ${getCurrencySymbol()}
</div>
<div style="font-size:13px;opacity:.6;margin-top:4px">
${formatted}
</div>
</div>
`;
}

});

openScreen("progress", null);
}

/* ===== BOTTOM SHEET ===== */
function openSheet() {
ProtoSheet.open(sheet, sheetOverlay);
}
function closeSheet() {
ProtoSheet.close(sheet, sheetOverlay);
}
ProtoSheet.initSwipe(sheet, closeSheet);

function renderProtocolResult({ scenariosHTML, advice }) {
var _actionsEl = document.getElementById("protocolActionsContainer");
if (_actionsEl) { _actionsEl.innerHTML = ""; _actionsEl.style.display = "none"; }
var _indicatorEl = document.getElementById("graphGoalIndicator");
if (_indicatorEl) { _indicatorEl.classList.remove("visible"); _indicatorEl.innerHTML = ""; }

adviceCard.innerHTML = `
<div style="margin-bottom:12px">
<div style="font-size:14px;opacity:.7;margin-bottom:6px">
${t("protocol.chooseScenario")}
</div>
${scenariosHTML}
</div>

<div style="
margin-top:10px;
padding:14px;
border-radius:14px;
background:#111;
border:1px solid #333;
font-size:15px;
line-height:1.4
">
${advice.text}
</div>
`;

document.querySelectorAll(".scenario-card").forEach(card => {
card.onclick = () => {
document
.querySelectorAll(".scenario-card")
.forEach(c => c.classList.remove("active"));

card.classList.add("active");

selectedScenario = card.dataset.id;

haptic("light");

protocolFlow(selectedScenario);
};
});
}

/* ===== CALCULATE ===== */
calculateBtn.onclick = () => {
haptic("medium");
hideBottomNav();

bottomNav.style.opacity = "0";
bottomNav.style.pointerEvents = "none";
bottomNav.style.transform = "translateY(140%)";

const validIncome = validateRequired(incomeInput);
const validExpenses = validateRequired(expensesInput);
const validGoal = validateRequired(goalInput);

if (!validIncome || !validExpenses || !validGoal) return;

// ── CashflowEngine: initial calculation ──
const engine = new CashflowEngine({
  modelType: "simple",
  baseConfig: {
    goal: parseNumber(goalInput.value),
    income: parseNumber(incomeInput.value),
    expenses: parseNumber(expensesInput.value),
    saved: parseNumber(savedInput?.value || "0"),
    mode: saveMode,
    hasReserve: false
  },
  events: []
});
const derived = engine.recalculate();

if (!derived.ok) {
  alert(t("engine.noBalance"));
  return;
}

lastCalc = {
  ok: true,
  free: derived.free,
  pace: derived.pace,
  monthlySave: derived.monthlySave,
  months: derived.monthsLeft,
  effectiveGoal: derived.remainingGoal
};

const advice = CashflowEngine.buildAdvice(lastCalc);

// ===== BUILD 2 SCENARIOS (DIRECT vs BUFFER) =====
const baseMonthly = lastCalc.monthlySave;
const bufferRate = 0.1; // 10% в подушку

const scenarios = [
{
id: "direct",
title: t("scenario.direct"),
toGoal: baseMonthly,
toBuffer: 0,
months: lastCalc.months,
risk: t("scenario.riskHigh")
},
{
id: "buffer",
title: t("scenario.buffer"),
toGoal: Math.round(baseMonthly * (1 - bufferRate)),
toBuffer: Math.round(baseMonthly * bufferRate),
months: Math.ceil(
lastCalc.effectiveGoal /
Math.round(baseMonthly * (1 - bufferRate))
),
risk: t("scenario.riskLow")
}
];

const scenariosHTML = scenarios.map(s => `
<div class="card scenario-card" data-id="${s.id}">
<div style="color:#fff;font-weight:600;font-size:19px;margin-bottom:12px">
${s.title}
</div>

${t("scenario.toGoal")}: ${fmtConverted(s.toGoal)} ${getCurrencySymbol()} ${t("scenario.perMonth")}<br>
${s.toBuffer ? `${t("scenario.toReserve")}: ${fmtConverted(s.toBuffer)} ${getCurrencySymbol()}<br>` : ""}
${t("scenario.term")}: ~${s.months} ${t("scenario.months")}<br>

<span style="opacity:.6">${t("scenario.risk")}: ${s.risk}</span>

${
s.id === "buffer"
? `
<div class="reserve-info reserve-ui">
<b>${t("scenario.reserveInfo")}</b><br>
${t("scenario.reserveDesc").replace(/\n/g, "<br>")}
</div>
`
: ""
}
</div>
`).join("");

renderProtocolResult({
scenariosHTML,
advice
});

isInitialized = true; // разрешаем переходы
ensureDefaultGoal();
syncGoalsFromPrimary();
openScreen("advice", null); // показываем экран с карточками
if (protocolBack) protocolBack.style.display = "block";

// показать summary
planSummary.style.display = "block";

// заполнить данные
summaryMonthly.innerText = fmtConverted(lastCalc.monthlySave);
summaryMonths.innerText = lastCalc.months;
summaryMode.innerText =
t("mode." + saveMode);

// спрятать форму
document.querySelectorAll(
"#screen-calc label, #screen-calc .input-wrap, .mode-buttons, #calculate"
).forEach(el => el.style.display = "none");

saveFullState();
};

/* ===== TIME HELPERS ===== */

function addMonths(date, n) {
const d = new Date(date);
d.setMonth(d.getMonth() + n);
return d;
}

function renderProtocolAdviceGraph() {
  // NEW: Full goal creation flow in Protocol tab - если primary goal пуст,
  // показываем empty-card вместо графика и выходим (не перерисовываем adviceCard,
  // чтобы избежать "мерцания" пустого графика).
  if (typeof window._syncProtocolEmptyState === "function" && window._syncProtocolEmptyState()) {
    return;
  }
  const advice = CashflowEngine.buildAdvice(lastCalc);
  const adviceBlockHtml = (advice && advice.text) ? `<div style="
margin-top:10px;
padding:10px 12px;
border-radius:14px;
background:#111;
border:1px solid #222;
font-size:14px;
">${advice.text}</div>` : "";

  adviceCard.innerHTML = `
<div id="planHeader">
<div
id="planMonthly"
style="font-size:16px;font-weight:600"
></div>

<div
id="planExplanation"
style="
margin-top:8px;
font-size:14px;
line-height:1.4;
opacity:0.75;
"
></div>
<div id="inflationHint" class="inflation-hint"></div>
</div>

${adviceBlockHtml}

<div class="graph-block">
<div class="timeline-controls">
<button id="timelineBackBtn" class="timeline-back-btn" type="button" style="display:none">← ${t("misc.overview")}</button>
</div>
<div class="chart-card"></div>
<!-- Неполный стартовый месяц: один раз уточняем, оплачен ли уже месячный расход,
     чтобы точно посчитать отложения в этом месяце. Видимость — updatePartialExpenseBanner(). -->
<div id="csPartialExpenseBanner" class="cs-partial-expense" style="display:none">
<div class="cs-partial-expense-head">
<span class="cs-partial-expense-icon" aria-hidden="true">🗓️</span>
<span class="cs-partial-expense-title">${t("cs.partialExpense.title")}</span>
</div>
<div class="cs-partial-expense-q" id="csPartialExpenseQ"></div>
<div class="cs-partial-expense-opts">
<button type="button" class="cs-pe-opt" data-pe="yes">${t("cs.partialExpense.yes")}</button>
<button type="button" class="cs-pe-opt" data-pe="no">${t("cs.partialExpense.no")}</button>
<button type="button" class="cs-pe-opt" data-pe="partial">${t("cs.partialExpense.partial")}</button>
</div>
<div class="cs-partial-expense-partial" id="csPartialExpensePartialWrap" style="display:none">
<label class="cs-pe-label" for="csPartialExpenseInput">${t("cs.partialExpense.partialLabel")}</label>
<div class="cs-pe-input-row">
<input id="csPartialExpenseInput" inputmode="numeric" placeholder="${t("cs.partialExpense.partialPlaceholder")}" />
<button type="button" class="cs-pe-save" id="csPartialExpenseSave">${t("cs.partialExpense.save")}</button>
</div>
</div>
<div class="cs-partial-expense-hint">${t("cs.partialExpense.hint")}</div>
</div>
<div class="fact-input-row">
<input id="factInput" inputmode="numeric"
placeholder="${t("calc.factPlaceholder")}"
style="flex:1"/>
<button id="applyFact"
style="width:52px;height:52px;border-radius:50%">
➜
</button>
</div>
<!-- Гибкая модель: вместо ручного поля «Сколько вы отложили» - кнопки записи
     дохода/расхода. Видимость управляется updateFactInputVisibility(). -->
<div id="cashflowRecordRow" class="cashflow-record-row" style="display:none">
<button id="recordIncomeBtn" class="cs-add-record-btn" type="button" data-side="income">${t("graph.recordIncome")}</button>
<button id="recordExpenseBtn" class="cs-add-record-btn cs-add-record-btn--expense" type="button" data-side="expense">${t("graph.recordExpense")}</button>
<div id="cashflowRecordHint" class="cashflow-record-hint">${t("graph.recordHint")}</div>
</div>
<div id="brainMessageContainer"></div>
</div>

<div id="debtBreakdownBlock" class="debt-breakdown debt-breakdown--hidden"></div>

<div id="factTooltipContainer" class="fact-tooltip-container graph-tooltip-bottom"></div>
`;

  var actionsContainer = document.getElementById("protocolActionsContainer");
  if (actionsContainer) {
    actionsContainer.innerHTML = '<button id="unexpectedExpenseBtn" class="unexpected-expense-trigger" type="button">' + t("protocol.unexpectedBtn") + '</button>';
    actionsContainer.style.display = "";
  }

  renderSVGGraph();
  if (protocolBack) protocolBack.style.display = "none";
  showBottomNav();
  buttons.forEach(b => b.classList.remove("active"));
  buttons[1].classList.add("active");
  moveIndicator(buttons[1]);
  updatePlanHeader();
  if (typeof updateFactInputVisibility === "function") updateFactInputVisibility();
  if (typeof updatePartialExpenseBanner === "function") updatePartialExpenseBanner();
  if (typeof updateGraphGoalIndicator === "function") updateGraphGoalIndicator();
  if (typeof updateAccountsLocalNav === "function") updateAccountsLocalNav();

  const factInput = document.getElementById("factInput");
  const applyBtn = document.getElementById("applyFact");

  // Гибкая модель: кнопки «Записать доход / расход» открывают то же окно записи,
  // что и «+ Записать поступление» в карточке гибкой модели. Клики
  // обрабатываются единым делегированным хендлером по классу .cs-add-record-btn
  // (читает data-side). Отдельный onclick здесь НЕ вешаем - иначе срабатывали
  // бы оба обработчика и «Записать расход» открывал бы доход.

  if (factInput) {
    factInput.addEventListener("input", e => {
      e.target.value = formatNumber(e.target.value);
      factInput.classList.remove("error", "shake");
      updatePlanHeader();
    });

    factInput.addEventListener("focus", () => {
      factInput.classList.remove("error", "shake");
    });
  }

  if (applyBtn && factInput) {
    applyBtn.onclick = () => {
      const fact = parseNumber(factInput.value || "0");
      factInput.classList.remove("error", "shake");

      if (!fact) {
        factInput.classList.add("error");
        void factInput.offsetWidth;
        factInput.classList.add("shake");
        haptic("error");
        return;
      }

      let toReserve = 0;
      let distributable = fact;
      let debtRepaid = 0;

      var currentState = getState();
      if (currentState.debtPlanningMode) {
        var repayResult = applyAutoDebtRepayment(distributable);
        debtRepaid = repayResult.applied;
        distributable -= debtRepaid;
      }

      if (chosenPlan === "buffer") {
        toReserve = Math.round(distributable * 0.1);
        distributable = distributable - toReserve;
      }

      const now = new Date();
      const realTimestamp = now.toISOString();
      const periodDate = new Date(now);
      periodDate.setDate(1);
      periodDate.setHours(0, 0, 0, 0);

      var goals = getGoals();
      var alloc = allocateFactByPriority(goals, distributable);

      alloc.forEach(function (entry) {
        if (entry.amount <= 0) return;
        var g = getGoalById(entry.goalId);
        if (!g) return;
        if (g.priority === 1 || goals.indexOf(g) === 0) {
          factHistory.push({ value: entry.amount, date: periodDate, to: "main", timestamp: realTimestamp });
        } else {
          g.saved = (g.saved || 0) + entry.amount;
        }
      });

      if (toReserve > 0) {
        factHistory.push({ value: toReserve, date: periodDate, to: "reserve", timestamp: realTimestamp });
      }

      factRatio = fact / plannedMonthly;

      computeGoalsAllocation(goals, plannedMonthly || 0);
      persistGoals(goals);
      recalcPlan();
      renderProtocolAdviceGraph();
      renderGoals();
      renderAccountsUI();
      if (typeof updateGraphGoalIndicator === "function") updateGraphGoalIndicator();
      if (typeof updateAccountsLocalNav === "function") updateAccountsLocalNav();
      runBrain();

      const goalTotal = parseNumber(goalInput.value || "0");
      if (!goalCompleted && goalTotal > 0 && accounts.main >= goalTotal) {
        goalCompleted = true;
        // GOAL COMPLETION FEATURE - снапшот данных ДО любых мутаций состояния
        // (checkGoalCompletion ниже пропускает primary, но накоплено меняется в recalcPlan).
        var goalCompletionSnapshot = {
          name: goalMeta.title || t("misc.defaultGoalTitle"),
          amount: goalTotal,
          saved: accounts.main
        };
        // PREMIUM GOAL COMPLETION - конфетти теперь запускается ВНУТРИ модалки,
        // синхронно с её открытием (haptic + asymmetric burst). Здесь только
        // ставим в очередь показ модалки.
        setTimeout(function () { showGoalCompletionModal(goalCompletionSnapshot); }, 350);
      }

      checkGoalCompletion();

      if (debtRepaid > 0) {
        var savingsPart = fact - debtRepaid;
        repayResult.details.forEach(function (d) {
          addDebtPaymentRecord({
            debtId: d.debtId,
            amount: d.amount,
            source: "auto",
            totalInput: fact,
            savingsPart: savingsPart
          });
        });

        if (typeof renderDebtSummaryGlobal === "function") renderDebtSummaryGlobal();
        if (typeof renderDebtListGlobal === "function") renderDebtListGlobal();
        showToast(t("toast.debtRepaid"), "success");
        showDebtBreakdown(fact, debtRepaid, savingsPart);
      }

      factInput.value = "";
      factInput.blur();
    };
  }

  const unexpBtn = document.getElementById("unexpectedExpenseBtn");
  if (unexpBtn) {
    unexpBtn.onclick = () => {
      if (isCashflowNoData()) {
        shakeFlexHint();
        haptic("error");
        return;
      }
      haptic("light");
      openUnexpectedExpenseScreen();
    };
  }

  syncFlexibleUI();
}

// ─── SPLASH VIDEO BACKGROUND ───────────────────────────────────
// Хелперы для управления полноэкранным видео-сплешем во время
// фейк-загрузки protocolFlow(). Видео - `./assets/videos/snakePloop.mp4`,
// autoplay/loop/muted (обязательное условие для автозапуска в браузерах).
// При сбое загрузки видео остаётся чёрный фон, текст статуса виден.
function showSplashVideo(initialText) {
  var overlay = document.getElementById("splashVideoOverlay");
  if (!overlay) return;
  var videoEl = document.getElementById("splashVideoEl");
  setSplashVideoText(initialText || "");
  overlay.classList.remove("hidden", "fading");

  // SETTINGS - пользователь может отключить видео при загрузке
  // (Настройки → Интерфейс → «Отключить видео при загрузке»).
  // В этом случае показываем только чёрный overlay без воспроизведения.
  // Сам overlay остаётся виден - он даёт нужный «полноэкранный» эффект
  // фейк-загрузки, просто без видео-фона.
  var s = (typeof getState === "function") ? (getState().settings || {})
        : ((window.appState && window.appState.settings) || {});
  var disableVideo = s.disableLoadingVideo === true;

  if (videoEl) {
    if (disableVideo) {
      // Скрываем сам <video>, останавливаем воспроизведение - экономим CPU/батарею.
      try { videoEl.pause(); } catch (_e) { /* noop */ }
      videoEl.style.display = "none";
      return;
    }
    // Возвращаем видимость (на случай, если ранее было отключено).
    videoEl.style.display = "";
    try {
      videoEl.currentTime = 0;
      videoEl.muted = true; // дублируем для надёжного autoplay
      var p = videoEl.play();
      if (p && typeof p.then === "function") {
        p.catch(function () { /* autoplay блокирован - фон останется чёрным */ });
      }
    } catch (e) { /* noop */ }
  }
}
function setSplashVideoText(text) {
  var textEl = document.getElementById("splashVideoText");
  if (!textEl) return;
  textEl.textContent = text || "";
  // Перезапускаем fade-in анимацию при смене текста.
  textEl.style.animation = "none";
  void textEl.offsetWidth; // force reflow
  textEl.style.animation = "";
}
function hideSplashVideo() {
  var overlay = document.getElementById("splashVideoOverlay");
  if (!overlay) return;
  overlay.classList.add("fading");
  setTimeout(function () {
    overlay.classList.add("hidden");
    overlay.classList.remove("fading");
    var videoEl = document.getElementById("splashVideoEl");
    if (videoEl) {
      try { videoEl.pause(); } catch (e) { /* noop */ }
    }
  }, 450);
}

/* ===== STAGED FLOW ===== */
function protocolFlow(mode) {
chosenPlan = mode;
updateState({ settings: { allocationMode: mode === "buffer" ? "buffer" : "goal" } });
if (protocolBack) protocolBack.style.display = "none";
// initialBalance устанавливается ТОЛЬКО при создании плана из поля "Уже накоплено"
const initialSaved = parseNumber(savedInput?.value || "0");
if (accounts.main === 0 && accounts.reserve === 0) {
  if (initialSaved > 0) {
    initialBalance = initialSaved;
    planStartValue = initialSaved;
    accounts.main = initialSaved;
  } else {
    initialBalance = 0;
    planStartValue = 0;
  }
  accounts.reserve = 0;
} else {
  planStartValue = planStartValue || accounts.main;
}

isInitialized = true;
ensureDefaultGoal();
syncGoalsFromPrimary();
renderAccountsUI();
lockTabs(false);

openScreen("advice", null);
const backBtn = document.getElementById("protocolBack");
if (backBtn) backBtn.style.display = "none";
hideBottomNav();
adviceCard.innerHTML = "";
loader.classList.remove("hidden");

// SPLASH VIDEO BACKGROUND - полноэкранный видео-сплеш поверх фейк-загрузки.
// adviceCard.innerText продолжаем обновлять (он будет под overlay и сразу
// проявится при fade-out), а текст также дублируем в .splash-video__overlay-text.
showSplashVideo(t("flow.analyzing"));

var actionsContainer = document.getElementById("protocolActionsContainer");
var graphIndicator = document.getElementById("graphGoalIndicator");
if (actionsContainer) { actionsContainer.innerHTML = ""; actionsContainer.style.display = "none"; }
if (graphIndicator) { graphIndicator.classList.remove("visible"); graphIndicator.innerHTML = ""; }

plannedMonthly = lastCalc.monthlySave;

if (mode === "buffer") plannedMonthly = Math.round(plannedMonthly * 0.9);

adviceCard.innerText = t("flow.analyzing");

setTimeout(() => {
var phase2 = mode === "buffer" ? t("flow.bufferChosen") : t("flow.directChosen");
adviceCard.innerText = phase2;
// SPLASH VIDEO BACKGROUND
setSplashVideoText(phase2);
}, 2000);

setTimeout(() => {
adviceCard.innerText = t("flow.done");
// SPLASH VIDEO BACKGROUND
setSplashVideoText(t("flow.done"));
}, 4000);

setTimeout(() => {
loader.classList.add("hidden");
// SPLASH VIDEO BACKGROUND - плавно скрываем сплеш и одновременно рендерим график.
hideSplashVideo();
renderProtocolAdviceGraph();
saveFullState();
}, 6000);
}

/* ===== RESET ===== */
resetBtn.onclick = () => confirmReset.style.display = "block";
confirmNo.onclick = () => confirmReset.style.display = "none";
function performFullReset() {
  // PREMIUM SYSTEM - сброс касается ТОЛЬКО плана/цели, а не статуса подписки.
  // clearState() ниже обнуляет appState к дефолту (isPremium=false), из-за чего
  // премиум-функции блокировались бы на 15-30с, пока syncUserAccessFlagsFromDB
  // не перечитает флаги из БД. Поэтому снимаем account-level премиум-поля заранее
  // и восстанавливаем их сразу после clearState().
  var _preservedPremium = null;
  try {
    var _sPrev = (typeof getState === "function") ? getState() : null;
    if (_sPrev) {
      _preservedPremium = {
        isPremium:          _sPrev.isPremium === true,
        premiumUntil:       _sPrev.premiumUntil || null,
        autoRenew:          _sPrev.autoRenew === true,
        showCommunityStats: _sPrev.showCommunityStats === true
      };
    }
  } catch (e) { _preservedPremium = null; }

  chosenPlan = null;
  isInitialized = false;
  lastCalc = {};
  plannedMonthly = 0;
  factHistory = [];
  factRatio = null;
  goalCompleted = false;
  selectedScenario = null;
  accounts.main = 0;
  accounts.reserve = 0;
  planStartValue = 0;
  initialBalance = 0;

  state.goalTotal = 0;
  state.goalSaved = 0;
  state.reserveAmount = 0;
  state.monthlyContribution = 0;
  state.monthsLeft = 0;
  state.mode = null;
  state.hasReserve = false;

  activeGoalIndex = 0;
  goalMeta.title = t("goals.default");

  clearState();

  // PREMIUM SYSTEM - возвращаем сохранённый премиум-статус, чтобы гейт не
  // блокировал функции после сброса (источник истины - users-таблица в БД,
  // эти значения с ней совпадают; следующий синк лишь подтвердит их).
  if (_preservedPremium && typeof updateState === "function") {
    try { updateState(_preservedPremium); } catch (e) { /* graceful */ }
  }

  var flexContent = document.getElementById("flexibleContent");
  var flexToggle = document.getElementById("flexibleToggle");
  if (flexContent) flexContent.classList.remove("open");
  if (flexToggle) flexToggle.classList.remove("open");

  calcLock.style.display = "none";
  confirmReset.style.display = "none";
  lockTabs(true);

  incomeInput.value = "";
  expensesInput.value = "";
  goalInput.value = "";
  if (savedInput) savedInput.value = "";

  document.querySelectorAll("#screen-calc label, #screen-calc .input-wrap, .mode-buttons, #calculate").forEach(el => el.style.display = "");
  planSummary.style.display = "none";
  modeButtons.forEach(b => b.classList.toggle("active", b.dataset.mode === "calm"));
  saveMode = "calm";
  selectedMode = "calm";

  openScreen("calc", buttons[0]);
  hideBottomNav();
}

confirmYes.onclick = () => {
  // NEW: Full reset button in Profile - после performFullReset() явно синхронизируем
  //      пустое состояние с Supabase через saveFullState(). Без этого Supabase сохранял бы
  //      старые данные до следующего изменения.
  performFullReset();
  try {
    // FIX: soft invisible blocking after goal completion - сбрасываем лок после полного сброса
    //      (goal обнулён через clearState, поэтому лок пересчитается как false).
    if (typeof window._updateAppLock === "function") window._updateAppLock();
    if (typeof saveFullState === "function") saveFullState();
  } catch (e) {
    console.warn("[Reset] saveFullState after performFullReset:", e);
  }
  // REMINDERS — стираем reminder_log пользователя в Supabase, чтобы после
  // "Начать сначала" напоминания снова срабатывали с чистого листа (иначе
  // период_key уже был бы в логе и новые пинги бы скипнулись по дедупу).
  // Best-effort: ошибки тихо проглатываем, на UX это не должно влиять.
  try {
    if (typeof window.clearUserReminderLog === "function") {
      Promise.resolve(window.clearUserReminderLog()).catch(function () { /* noop */ });
    }
  } catch (e) { /* noop */ }
};

/* ===== PROFILE ===== */
const profileBtn = document.getElementById("profileBtn");
const topProfileFixed = document.querySelector(".top-profile-fixed");

function moveProfileToActiveHeader() {
  if (!profileBtn) return;
  const activeScreen = document.querySelector(".screen.active");
  const headerRight = activeScreen?.querySelector(".header-right");
  const isProfileScreen = activeScreen?.id === "screen-profile";
  if (headerRight) {
    headerRight.appendChild(profileBtn);
    if (topProfileFixed) topProfileFixed.style.display = "";
  } else if (topProfileFixed) {
    topProfileFixed.appendChild(profileBtn);
    // На экране профиля скрываем полосу с иконкой, чтобы не перекрывать кнопку «Назад»
    topProfileFixed.style.display = isProfileScreen ? "none" : "";
  }
}

if (profileBtn) {
  moveProfileToActiveHeader();
  profileBtn.onclick = () => {
    haptic("light");
    document.activeElement?.blur();
    if (confirmReset) confirmReset.style.display = "none";
    document.body.classList.remove("advanced-active");
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-profile").classList.add("active");
    buttons.forEach(b => b.classList.remove("active"));
    bottomNav.style.transform = "translateY(140%)";
    bottomNav.style.opacity = "0";
    bottomNav.style.pointerEvents = "none";
    if (advancedBtn) advancedBtn.style.display = "none";
    moveProfileToActiveHeader();
    // STATISTICS COLLECTION - обновляем счётчики premium/free каждый раз
    // при заходе в профиль (с кэшем на 60 секунд внутри функции).
    if (typeof refreshProfileStats === "function") refreshProfileStats();
    // PREMIUM PROFILE BADGE - обновляем видимость изумрудной плашки
    // «Premium» рядом с именем при каждом открытии профиля. Это страхует
    // от случая, когда DB-синк ещё не отработал к моменту первого захода.
    if (typeof window._refreshProfilePremiumBadge === "function") {
      window._refreshProfilePremiumBadge();
    }
  };
}

// STATISTICS COLLECTION - рендер цифр в блок #profileStats.
// Кэш на 60с - не дёргаем БД на каждый заход в профиль.
var _profileStatsCache = { ts: 0, data: null };

// COMMUNITY STATS - форматирует число с разделителями тысяч в соответствии
// с пользовательской настройкой (settings.numberFormat: "spaces" | "dots").
// null/undefined → «-» (значение не загружено или БД-таблица не создана).
function _formatStatsNumber(n) {
  if (n == null || isNaN(n)) return "-";
  var s = String(Math.round(n));
  var sep = (window._protocolNumberFormat === "dots") ? "." : " ";
  // Регулярка вставляет разделитель между каждыми 3-мя цифрами справа.
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

function refreshProfileStats() {
  var elStats           = document.getElementById("profileStats");
  var elPremium         = document.getElementById("profileStatsPremium");
  var elFree            = document.getElementById("profileStatsFree");
  var elTotal           = document.getElementById("profileStatsTotal");
  // COMMUNITY STATS - новые поля.
  var elStarsTotal      = document.getElementById("profileStatsStarsTotal");
  var elStarsMonth      = document.getElementById("profileStatsStarsMonth");
  var elPurchases       = document.getElementById("profileStatsPurchases");
  var elNewUsers30d     = document.getElementById("profileStatsNewUsers30d");

  if (!elPremium || !elFree || !elTotal) return;

  // ADMIN ONLY: community stats block - блок «Статистика сообщества» виден
  // только пользователям с users.show_community_stats=true (default false).
  // Этот флаг управляется вручную владельцем приложения и не связан
  // с is_premium / премиум-подпиской.
  var canSeeStats = (typeof getState === "function") && (getState().showCommunityStats === true);
  if (elStats) elStats.style.display = canSeeStats ? "" : "none";
  if (!canSeeStats) return;

  function paint(stats) {
    if (!stats) return;
    elPremium.textContent = _formatStatsNumber(stats.premiumCount);
    elFree.textContent    = _formatStatsNumber(stats.freeCount);
    elTotal.textContent   = _formatStatsNumber(stats.total);
    // COMMUNITY STATS - дорисовываем новые метрики (значения могут быть null,
    // если соответствующая БД-таблица ещё не создана; _formatStatsNumber
    // в этом случае рисует «-»).
    if (elStarsTotal)  elStarsTotal.textContent  = _formatStatsNumber(stats.starsEarnedTotal);
    if (elStarsMonth)  elStarsMonth.textContent  = _formatStatsNumber(stats.starsEarnedLastMonth);
    if (elPurchases)   elPurchases.textContent   = _formatStatsNumber(stats.premiumPurchases);
    if (elNewUsers30d) elNewUsers30d.textContent = _formatStatsNumber(stats.newUsers30d);
  }

  // Сразу показываем кэш если он есть и свежий - UI не мигает «-».
  var now = Date.now();
  if (_profileStatsCache.data && (now - _profileStatsCache.ts < 60000)) {
    paint(_profileStatsCache.data);
    return;
  }

  // COMMUNITY STATS - основной getter, объединяет пользователей и Stars.
  // Fallback на legacy getPremiumStats() если новой функции нет (на случай
  // частичного деплоя). Legacy возвращает только {premiumCount, freeCount,
  // total} → новые поля останутся «-», что нормально для graceful degradation.
  var fetcher = (typeof window.getCommunityStats === "function")
    ? window.getCommunityStats
    : window.getPremiumStats;
  if (typeof fetcher !== "function") return;

  fetcher().then(function (stats) {
    if (!stats) return;
    _profileStatsCache = { ts: Date.now(), data: stats };
    paint(stats);
  }).catch(function (err) {
    console.warn("[Statistics] refreshProfileStats:", err && err.message);
  });
}

const profileResetPlanBtn = document.getElementById("profileResetPlan");
if (profileResetPlanBtn) {
profileResetPlanBtn.onclick = () => {
haptic("light");
confirmReset.style.display = "block";
};
}

/* ===== GOAL HISTORY ===== */

var goalHistoryBtn = document.getElementById("goalHistoryBtn");
var goalHistoryBack = document.getElementById("goalHistoryBack");

if (goalHistoryBtn) {
  goalHistoryBtn.addEventListener("click", function () {
    haptic("light");
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    document.getElementById("screen-goal-history").classList.add("active");
    renderGoalHistory();
    moveProfileToActiveHeader();
  });
}

if (goalHistoryBack) {
  goalHistoryBack.addEventListener("click", function () {
    haptic("light");
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    document.getElementById("screen-profile").classList.add("active");
    moveProfileToActiveHeader();
  });
}

/* ===== SETTINGS SCREEN ===== */

(function initSettingsScreen() {

  var settingsBtn = document.getElementById("settingsBtn");
  var settingsBack = document.getElementById("settingsBack");

  function applyI18nToSettings() {
    applyLanguageToDOM();
  }

  // ── Segment helper ──
  function initSegment(containerId, stateKey) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var btns = container.querySelectorAll(".settings-seg-btn");

    function sync() {
      var val = (getState().settings || {})[stateKey];
      btns.forEach(function (b) {
        b.classList.toggle("active", b.dataset.value === val);
      });
    }

    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (typeof haptic === "function") haptic("light");
        var patch = {};
        patch[stateKey] = btn.dataset.value;
        updateState({ settings: patch });
        saveFullState();
        sync();
        onSettingChanged(stateKey, btn.dataset.value);
      });
    });

    sync();
    return { sync: sync };
  }

  // ── Toggle helper ──
  function initToggle(inputId, stateKey, hintId, hintOnKey, hintOffKey) {
    var input = document.getElementById(inputId);
    if (!input) return;

    function sync() {
      var val = (getState().settings || {})[stateKey];
      input.checked = !!val;
      if (hintId) {
        var hint = document.getElementById(hintId);
        if (hint) hint.textContent = val ? t(hintOnKey) : t(hintOffKey);
      }
    }

    input.addEventListener("change", function () {
      if (typeof haptic === "function") haptic("light");
      var patch = {};
      patch[stateKey] = input.checked;
      updateState({ settings: patch });
      saveFullState();
      sync();
      onSettingChanged(stateKey, input.checked);
    });

    sync();
    return { sync: sync };
  }

  // ── Reactions when a setting changes ──
  function onSettingChanged(key, value) {
    if (key === "animationsEnabled") {
      document.body.classList.toggle("reduce-motion", !value);
      if (typeof lottie !== "undefined") {
        if (!value) {
          lottie.pause();
          document.querySelectorAll(".nav-lottie svg").forEach(function (el) {
            el.style.display = "none";
          });
        } else {
          document.querySelectorAll(".nav-lottie svg").forEach(function (el) {
            el.style.display = "";
          });
          lottie.play();
        }
      }
    }

    if (key === "notificationsEnabled") {
      var nested = document.getElementById("settingsNotifNested");
      if (nested) nested.style.display = value ? "" : "none";
    }

    if (key === "language") {
      applyLanguageToDOM();
      updateDynamicHints();
      if (typeof renderFlexModelSummary === "function") renderFlexModelSummary();
      try { if (typeof updatePlanHeader === "function") updatePlanHeader(); } catch (e) {}
      try { if (typeof runBrain === "function") runBrain(); } catch (e) {}
      try { if (typeof renderGoals === "function") renderGoals(); } catch (e) {}
      try { if (typeof renderAccountsUI === "function") renderAccountsUI(); } catch (e) {}
      try { if (typeof renderCustomSchedule === "function") renderCustomSchedule(); } catch (e) {}
    }

    if (key === "displayCurrencyEnabled" || key === "displayCurrency") {
      fetchExchangeRates();
      applyLanguageToDOM();
      _refreshDisplayedAmounts();
      _syncDisplayCurrencyVisibility();
    }

    if (key === "numberFormat") {
      window._protocolNumberFormat = value;
      _refreshDisplayedAmounts();
    }

    if (key === "allocationMode") {
      if (typeof chosenPlan !== "undefined" && chosenPlan !== null) {
        chosenPlan = (value === "buffer") ? "buffer" : "direct";
        if (typeof recalcPlan === "function") recalcPlan();
        if (typeof renderAccountsUI === "function") renderAccountsUI();
        if (typeof renderGoals === "function") renderGoals();
      }
    }
  }

  function _refreshDisplayedAmounts() {
    if (typeof renderAccountsUI === "function") renderAccountsUI();
    if (typeof renderGoals === "function") renderGoals();
    if (typeof renderExpensesScreen === "function") renderExpensesScreen();
  }

  function updateDynamicHints() {
    var s = getState().settings || {};
    var carryHint = document.getElementById("settingsCarryOverHint");
    if (carryHint) carryHint.textContent = s.carryOverEnabled ? t("settings.carryOver.on") : t("settings.carryOver.off");
    var overpayHint = document.getElementById("settingsOverpayHint");
    if (overpayHint) overpayHint.textContent = s.allowOverpay ? t("settings.allowOverpay.on") : t("settings.allowOverpay.off");
  }

  // ── Base Currency with confirmation ──
  function initBaseCurrencySegment() {
    var container = document.getElementById("settingsBaseCurrency");
    if (!container) return;
    var btns = container.querySelectorAll(".settings-seg-btn");

    function sync() {
      var val = getBaseCurrency();
      btns.forEach(function (b) {
        b.classList.toggle("active", b.dataset.value === val);
      });
    }

    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var newBase = btn.dataset.value;
        if (newBase === getBaseCurrency()) return;
        if (typeof haptic === "function") haptic("light");

        var msg = t("settings.baseCurrency.confirmMsg");
        if (!confirm(msg)) { sync(); return; }

        changeBaseCurrency(newBase, function (ok) {
          if (ok) {
            sync();
            _refreshDisplayedAmounts();
            applyLanguageToDOM();
          } else {
            sync();
            alert(t("settings.baseCurrency.failMsg"));
          }
        });
      });
    });

    sync();
    return { sync: sync };
  }

  // ── Display currency visibility ──
  function _syncDisplayCurrencyVisibility() {
    var s = getState().settings || {};
    var nest = document.getElementById("settingsDisplayCurrencyNested");
    if (nest) nest.style.display = s.displayCurrencyEnabled ? "" : "none";
  }

  // ── Init all controls ──
  var segments = {};
  segments.baseCurrency = initBaseCurrencySegment();
  segments.displayCurrency = initSegment("settingsDisplayCurrency", "displayCurrency");
  segments.allocation = initSegment("settingsAllocation", "allocationMode");
  segments.numberFormat = initSegment("settingsNumberFormat", "numberFormat");
  segments.reminderTime = initSegment("settingsReminderTime", "reminderTime");
  segments.language = initSegment("settingsLanguage", "language");

  var toggles = {};
  toggles.carryOver = initToggle("settingsCarryOver", "carryOverEnabled", "settingsCarryOverHint", "settings.carryOver.on", "settings.carryOver.off");
  toggles.overpay = initToggle("settingsOverpay", "allowOverpay", "settingsOverpayHint", "settings.allowOverpay.on", "settings.allowOverpay.off");
  toggles.animations = initToggle("settingsAnimations", "animationsEnabled");
  toggles.notifications = initToggle("settingsNotifications", "notificationsEnabled");
  toggles.depositReminder = initToggle("settingsDepositReminder", "depositReminderEnabled");
  toggles.debtReminder = initToggle("settingsDebtReminder", "debtReminderEnabled");
  toggles.displayCurrencyEnabled = initToggle("settingsDisplayCurrencyEnabled", "displayCurrencyEnabled");
  // LOADING VIDEO TOGGLE - пользователь может одной галочкой выключить
  // ВСЕ фоновые видео в приложении:
  //   • видео-фон на экране фейк-загрузки (читается в showSplashVideo())
  //   • зацикленные видео в слайдах премиум-модалки (читается в
  //     _arePremiumVideosDisabled() / _applyPremiumVideosVisibility())
  // Видимая надпись настройки переименована в «Отключить загрузку видео»,
  // подсказка тоже обновлена - см. i18n key settings.disableLoadingVideo.
  // initToggle сам подвяжет change handler и saveFullState() при изменении.
  toggles.disableLoadingVideo = initToggle("settingsDisableLoadingVideo", "disableLoadingVideo");

  function syncAllControls() {
    Object.keys(segments).forEach(function (k) { if (segments[k]) segments[k].sync(); });
    Object.keys(toggles).forEach(function (k) { if (toggles[k]) toggles[k].sync(); });

    var s = getState().settings || {};
    var nested = document.getElementById("settingsNotifNested");
    if (nested) nested.style.display = s.notificationsEnabled ? "" : "none";

    document.body.classList.toggle("reduce-motion", !s.animationsEnabled);
    window._protocolNumberFormat = s.numberFormat || "spaces";

    _syncDisplayCurrencyVisibility();
    applyI18nToSettings();
    updateDynamicHints();
  }

  // ── Navigation ──
  if (settingsBtn) {
    settingsBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      syncAllControls();
      document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
      document.getElementById("screen-settings").classList.add("active");
      if (typeof moveProfileToActiveHeader === "function") moveProfileToActiveHeader();
    });
  }

  if (settingsBack) {
    settingsBack.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      openScreen(lastScreenBeforeProfile, lastNavBtnBeforeProfile);
      if (isInitialized) {
        showBottomNav();
      } else {
        hideBottomNav();
      }
    });
  }

  // Apply persisted settings on load
  var s = getState().settings || {};
  document.body.classList.toggle("reduce-motion", !s.animationsEnabled);
  window._protocolNumberFormat = s.numberFormat || "spaces";
  _syncDisplayCurrencyVisibility();

  /*
   * Real notification delivery requires backend / bot / scheduler
   * or platform-specific support (e.g. Telegram Bot API sendMessage
   * on a cron schedule). The UI and persistence are fully functional,
   * but actual push/local notification delivery is NOT implemented
   * because Telegram Mini Apps do not support client-side local
   * notifications or service workers with push capability.
   *
   * To enable real notifications in the future:
   * 1. Store notification preferences in Supabase (already done via state sync)
   * 2. Create a backend scheduler (Edge Function / cron) that queries
   *    user_state for users with notificationsEnabled: true
   * 3. Use the Telegram Bot API sendMessage to the user's chat_id
   *    at the configured reminderTime
   */

})();

function renderGoalHistory() {
  var list = document.getElementById("goalHistoryList");
  var emptyMsg = document.getElementById("goalHistoryEmpty");
  var completed = getState().completedGoals || [];

  if (!list) return;
  list.innerHTML = "";

  if (completed.length === 0) {
    if (emptyMsg) emptyMsg.style.display = "block";
    return;
  }

  if (emptyMsg) emptyMsg.style.display = "none";

  var monthNames = null; // replaced by getMonthName()

  completed.forEach(function (g, _historyIdx) {
    var card = document.createElement("div");
    card.className = "goal-history-card";
    // GOAL COMPLETION FEATURE - data-attr для делегированного click handler.
    card.setAttribute("data-history-idx", String(_historyIdx));

    var dateStr = "";
    if (g.completedDate) {
      var d = new Date(g.completedDate);
      dateStr = getMonthName(d.getMonth()) + " " + d.getFullYear();
    }

    var durationStr = g.durationMonths ? t("goalHistory.achieved", {n: g.durationMonths}) : "";

    card.innerHTML =
      '<div class="goal-history-card-title">' + escapeHtmlSafe(g.title || t("goals.default")) + '</div>' +
      '<div class="goal-history-card-amount">' + fmtConverted(g.amount || 0) + ' ' + getCurrencySymbol() + '</div>' +
      '<div class="goal-history-card-meta">' +
        '<span>' + durationStr + '</span>' +
        '<span>' + dateStr + '</span>' +
      '</div>';
    list.appendChild(card);
  });
}

function escapeHtmlSafe(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function checkGoalCompletion() {
  var goals = getGoals();
  var completed = getState().completedGoals || [];
  var changed = false;

  // GOAL COMPLETION FEATURE - primary goal (i=0) теперь обрабатывается
  // через showGoalCompletionModal() → confirmGoalCompletion(). Здесь его пропускаем,
  // чтобы не было race-условия с auto-archive до показа модалки пользователю.
  for (var i = goals.length - 1; i >= 1; i--) {
    var g = goals[i];
    if (g.amount > 0 && (g.saved || 0) >= g.amount) {
      var startDate = null;
      if (factHistory && factHistory.length > 0) {
        var sorted = factHistory.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
        startDate = new Date(sorted[0].date);
      }

      var now = new Date();
      var duration = 0;
      if (startDate) {
        duration = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
        if (duration < 1) duration = 1;
      }

      completed.push({
        id: g.id,
        title: g.title,
        amount: g.amount,
        saved: g.saved,
        completedDate: now.toISOString(),
        durationMonths: duration
      });

      goals.splice(i, 1);
      changed = true;
    }
  }

  if (changed) {
    if (goals.length === 0) {
      goals.push({
        id: "goal_" + Date.now(),
        title: t("goals.default"),
        amount: 0,
        saved: 0,
        priority: 1,
        monthlyShare: 0,
        monthsLeft: 0,
        paused: false
      });
    }
    persistGoals(goals);
    updateState({ completedGoals: completed });
    saveFullState();
    if (activeGoalIndex >= goals.length) activeGoalIndex = goals.length - 1;
  }
}

/* ===== INPUT HINT LOGIC ===== */
document.querySelectorAll(".input-wrap input").forEach(input => {
const wrap = input.closest(".input-wrap");

input.addEventListener("focus", () => {
wrap.classList.remove("error", "shake");
wrap.classList.add("show-hint");

if (input.dataset.placeholder) {
input.placeholder = input.dataset.placeholder;
}
});

input.addEventListener("input", () => {
wrap.classList.remove("error", "shake");
wrap.classList.remove("show-hint");
});

input.addEventListener("blur", () => {
wrap.classList.remove("show-hint");
saveFullState();
});
});

/* ===== MICRO UX: HAPTIC ===== */
function haptic(type = "light") {
  if (!window.Telegram?.WebApp?.HapticFeedback) return;

  try {
    const allowed = ["light", "medium", "heavy"];

    if (!allowed.includes(type)) {
      type = "light";
    }

    Telegram.WebApp.HapticFeedback.impactOccurred(type);
  } catch (e) {
    console.warn("Haptic safely ignored:", e);
  }
}
/* ===== TELEGRAM USER AUTO FILL ===== */

const tgUser = Telegram.WebApp.initDataUnsafe?.user;

// верхняя иконка
const topAvatar = document.querySelector("#profileBtn .avatar");

// профиль
const profileAvatar = document.querySelector(".profile-avatar");
const profileName = document.querySelector(".profile-name");

if (tgUser) {
const fullName =
tgUser.first_name + (tgUser.last_name ? " " + tgUser.last_name : "");

// имя в профиле
if (profileName) {
profileName.innerText = fullName;
}

// если есть фото
if (tgUser.photo_url) {
const img = `
<img src="${tgUser.photo_url}"
style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />
`;

// верхняя иконка
if (topAvatar) topAvatar.innerHTML = img;

// аватар в профиле
if (profileAvatar) profileAvatar.innerHTML = img;
}
}
function validateRequired(input) {
const wrap = input.closest(".input-wrap");
const value = parseNumber(input.value || "0");

if (!value) {
wrap.classList.add("error");

// перезапуск shake
wrap.classList.remove("shake");
void wrap.offsetWidth; // force reflow (ВАЖНО)
wrap.classList.add("shake");

// placeholder
if (!input.dataset.placeholder) {
input.dataset.placeholder = input.placeholder;
}

input.value = "";
input.placeholder = t("misc.required.field");

haptic("error");

return false;
}

wrap.classList.remove("error", "shake");

if (input.dataset.placeholder) {
input.placeholder = input.dataset.placeholder;
}

return true;
}

// ===== WATERMARK (загружается один раз) =====
/* watermark now rendered by SVG graph engine */

function clearFactInputError() {
const factInput = document.getElementById("factInput");
if (!factInput) return;

factInput.classList.remove("error", "shake");
}

/* ===== PREMIUM DYNAMIC TIMELINE SYSTEM ===== */

var _lastKnownMonth = new Date().getMonth();
var _lastKnownYear = new Date().getFullYear();

var timelineView = {
  mode: "overview",
  activeSegment: null
};

var _timelineCache = {
  monthsLeft: null,
  segments: null,
  calendar: null
};

var _zoomAnim = {
  progress: 0,
  targetProgress: 0,
  fromSegment: null,
  toSegment: null,
  rafId: null
};

function generateCalendarTimeline(startDate, monthsCount) {
  var result = [];
  var base = new Date(startDate);
  base.setDate(1);
  base.setHours(0, 0, 0, 0);
  var monthNames = [];
  for (var mi = 0; mi < 12; mi++) monthNames.push(getMonthNameShort(mi));
  for (var i = 0; i <= monthsCount; i++) {
    var d = new Date(base);
    d.setMonth(d.getMonth() + i);
    result.push({
      date: d,
      label: monthNames[d.getMonth()] + " " + d.getFullYear(),
      shortLabel: monthNames[d.getMonth()] + " " + String(d.getFullYear()).slice(2),
      monthIndex: i
    });
  }
  return result;
}

function buildTimeSegments(monthsCount) {
  if (monthsCount <= 3) {
    return [{ startMonth: 0, endMonth: monthsCount, label: t("graph.segmentAll"), monthCount: monthsCount }];
  }

  var segCount;
  if (monthsCount <= 6) segCount = 2;
  else if (monthsCount <= 12) segCount = Math.ceil(monthsCount / 3);
  else if (monthsCount <= 24) segCount = 6;
  else segCount = Math.min(8, Math.ceil(monthsCount / 6));

  var perSeg = Math.floor(monthsCount / segCount);
  var remainder = monthsCount % segCount;
  var segments = [];
  var cursor = 0;

  for (var i = 0; i < segCount; i++) {
    var count = perSeg + (i < remainder ? 1 : 0);
    segments.push({
      startMonth: cursor,
      endMonth: cursor + count,
      label: "Q" + (i + 1),
      monthCount: count
    });
    cursor += count;
  }
  return segments;
}

function getTimelineData(monthsLeft) {
  if (_timelineCache.monthsLeft === monthsLeft && _timelineCache.segments && _timelineCache.calendar) {
    return _timelineCache;
  }
  var calendar = generateCalendarTimeline(new Date(), monthsLeft);
  var segments = buildTimeSegments(monthsLeft);
  _timelineCache = { monthsLeft: monthsLeft, segments: segments, calendar: calendar };
  return _timelineCache;
}

function cubicBezierEase(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function calcTimelineX(monthIndex, totalMonths, W, padX) {
  if (totalMonths <= 0) return padX;
  var drawW = W - padX * 2;

  if (timelineView.mode === "overview" || !timelineView.activeSegment) {
    return padX + (monthIndex / totalMonths) * drawW;
  }

  var data = getTimelineData(totalMonths);
  var segs = data.segments;
  var activeSeg = timelineView.activeSegment;
  var prog = cubicBezierEase(_zoomAnim.progress);

  var activeRatio = 0.2 + 0.6 * prog;
  var inactiveTotal = 1 - activeRatio;

  var inactiveSegCount = segs.length - 1;
  var inactiveEach = inactiveSegCount > 0 ? inactiveTotal / inactiveSegCount : 0;

  var xOffset = 0;
  for (var i = 0; i < segs.length; i++) {
    var seg = segs[i];
    var segWidth;
    if (seg === activeSeg) {
      segWidth = activeRatio * drawW;
    } else {
      segWidth = inactiveEach * drawW;
    }

    if (monthIndex >= seg.startMonth && monthIndex <= seg.endMonth) {
      var localProgress = seg.monthCount > 0
        ? (monthIndex - seg.startMonth) / seg.monthCount
        : 0;
      return padX + xOffset + localProgress * segWidth;
    }
    xOffset += segWidth;
  }

  return padX + (monthIndex / totalMonths) * drawW;
}

function checkMonthTransition() {
  var now = new Date();
  var curMonth = now.getMonth();
  var curYear = now.getFullYear();
  if (curMonth !== _lastKnownMonth || curYear !== _lastKnownYear) {
    _lastKnownMonth = curMonth;
    _lastKnownYear = curYear;
    _timelineCache = { monthsLeft: null, segments: null, calendar: null };
    if (lastCalc.ok) {
      renderSVGGraph();
    }
  }
}

function startZoomAnimation(targetSegment) {
  if (_zoomAnim.rafId) cancelAnimationFrame(_zoomAnim.rafId);

  var isZoomIn = !!targetSegment;
  timelineView.activeSegment = targetSegment;
  timelineView.mode = isZoomIn ? "segment" : "overview";
  _zoomAnim.progress = isZoomIn ? 1 : 0;

  renderSVGGraph();

  if (!isZoomIn) {
    timelineView.activeSegment = null;
  }
  updateTimelineBackBtn();
}

function updateTimelineBackBtn() {
  var btn = document.getElementById("timelineBackBtn");
  if (!btn) return;
  var controls = btn.parentElement;
  if (timelineView.mode === "segment") {
    btn.style.display = "flex";
    btn.style.opacity = "1";
  } else {
    btn.style.opacity = "0";
    setTimeout(function () {
      if (timelineView.mode === "overview") {
        btn.style.display = "none";
      }
    }, 300);
  }
}

function handleTimelineSegmentClick(clickX, W, padX) {
  var gs = computeGraphState();
  var vMonths = gs.visibleMonths;
  if (!vMonths || vMonths <= 3 || gs.actualMonths < 4) return;

  var focused = document.activeElement;
  if (focused && (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA")) return;

  var data = getTimelineData(vMonths);
  var segs = data.segments;
  if (segs.length <= 1) return;

  var drawW = W - padX * 2;

  if (timelineView.mode === "segment") return;

  for (var i = 0; i < segs.length; i++) {
    var seg = segs[i];
    var x1 = padX + (seg.startMonth / vMonths) * drawW;
    var x2 = padX + (seg.endMonth / vMonths) * drawW;
    if (clickX >= x1 && clickX <= x2) {
      haptic("light");
      startZoomAnimation(seg);
      return;
    }
  }
}

/* ===== SVG GRAPH BRIDGE ===== */

function renderSVGGraph() {
  var gs = computeGraphState();
  ProtocolGraph.render(adviceCard, gs, factHistory, plannedMonthly);
}

function buildPlanTimeline(startDate, monthlyAmount, months) {
const points = [];

let total = 0;

for (let i = 0; i <= months; i++) {
points.push({
date: addMonths(startDate, i),
value: Math.max(0, total)
});
total += monthlyAmount;
}

return points;
}

function formatDate(d) {
return d.toLocaleDateString("ru-RU", {
month: "short",
year: "2-digit"
});
}

function runBrain() {
if (!factHistory.length) return;

// группируем факты по месяцам
const grouped = {};

factHistory.forEach(f => {
const d = new Date(f.date);
const key = `${d.getFullYear()}-${d.getMonth()}`;

if (!grouped[key]) grouped[key] = 0;
grouped[key] += f.value;
});

const monthsPassed = Object.keys(grouped).length;

const actual = Object.values(grouped)
.reduce((s, v) => s + v, 0);

const planned = plannedMonthly * monthsPassed;
const diff = actual - planned;

let text = "";

if (diff >= 0) {
text = t("status.onTrack");
} else if (diff > -planned * 0.1) {
text = t("status.slightlyBehind");
} else {
text = t("status.behind");
}

showBrainMessage(text);
}

function showBrainMessage(text) {
  const container = document.getElementById("brainMessageContainer");
  if (!container) return;
  container.innerHTML = "";

  const block = document.createElement("div");
  block.className = "brain-message";
  block.style.marginTop = "12px";
  block.style.padding = "12px";
  block.style.borderRadius = "12px";
  block.style.background = "#0e0e0e";
  block.style.border = "1px solid #222";
  block.style.fontSize = "14px";
  block.innerText = text;

  container.appendChild(block);
}

/**
 * Всплывающая toast-подсказка сверху экрана.
 * @param {string} message - Текст сообщения
 * @param {string} type - "error" | "success" | "info"
 * @param {object} opts - { duration, screenScope } duration в мс; screenScope="debts" - toast внутри экрана долгов (не виден на других вкладках, при возврате остаётся до конца таймера)
 */
function showToast(message, type, opts) {
  type = type === "error" || type === "success" || type === "info" ? type : "info";
  opts = opts || {};
  var duration = opts.duration || 2000;
  var screenScope = opts.screenScope;

  var existing = document.getElementById("protocol-toast");
  if (existing) {
    clearTimeout(existing._toastTimeout);
    existing.remove();
  }

  var el = document.createElement("div");
  el.id = "protocol-toast";
  el.className = "toast toast--" + type;
  el.textContent = message;

  var parent = screenScope === "debts" ? document.getElementById("screen-debts") : null;
  (parent || document.body).appendChild(el);

  requestAnimationFrame(function () {
    el.classList.add("toast--visible");
  });

  el._toastTimeout = setTimeout(function () {
    el.classList.remove("toast--visible");
    el.classList.add("toast--hiding");
    setTimeout(function () {
      if (el.parentNode) el.remove();
    }, 300);
  }, duration);
}

function showFactTooltip({ value, onHide }) {
  const container = document.getElementById("factTooltipContainer");
  if (container) {
    const old = container.querySelector(".fact-tooltip");
    if (old) old.remove();
    container.innerHTML = "";
  }

  const block = document.createElement("div");
  block.className = "fact-tooltip";

  const factOnly = Math.max(0, value);
  const date = new Date().toLocaleDateString("ru-RU");
  block.innerHTML = `
<div class="fact-date">${date}</div>
<div class="fact-value">
${t("history.deposited")}: ${fmtConverted(factOnly)} ${getCurrencySymbol()}
</div>
`;

  if (container) {
    container.appendChild(block);
  } else {
    adviceCard.appendChild(block);
  }

  setTimeout(() => {
    block.classList.add("hide");
    if (onHide) onHide();
    setTimeout(() => {
      block.remove();
      if (container) container.innerHTML = "";
      activeFactDot = null;
    }, 280);
  }, 4000);
}

/* ===== MONTHLY STATUS (current-month deposit tracker) ===== */

function computeMonthlyStatus() {
  if (activeGoalIndex > 0) {
    return { required: 0, actual: 0, complete: false, show: false };
  }

  var monthlyRequired = plannedMonthly || 0;
  if (monthlyRequired <= 0) {
    return { required: 0, actual: 0, complete: false, show: true };
  }

  // Phase 2: цель ТЕКУЩЕГО месяца в неполном (стартовом) месяце меньше полной
  // месячной нормы. «Внесено X / цель» и признак выполнения считаем по ней,
  // а внутреннюю кросс-месячную математику (previousRequired/кэпы прошлых
  // месяцев) оставляем на полной норме monthlyRequired, чтобы не ломать перенос.
  var currentMonthRequired = monthlyRequired;
  if (lastCalc && lastCalc.isPartialMonth
      && lastCalc.currentMonthToGoal != null && lastCalc.currentMonthToGoal > 0) {
    currentMonthRequired = lastCalc.currentMonthToGoal;
  }

  var settings = (getState().settings) || {};

  var mainDeposits = [];
  if (factHistory && factHistory.length > 0) {
    factHistory.forEach(function (f) {
      if (f.to === "main" && f.value > 0) {
        mainDeposits.push(f);
      }
    });
  }

  var totalContributed = 0;
  mainDeposits.forEach(function (f) { totalContributed += f.value; });

  if (mainDeposits.length === 0) {
    return { required: currentMonthRequired, actual: 0, complete: false, show: true };
  }

  var now = new Date();
  var currentMK = now.getFullYear() * 12 + now.getMonth();

  var startMK = currentMK;
  mainDeposits.forEach(function (f) {
    var d = new Date(f.date);
    var mk = d.getFullYear() * 12 + d.getMonth();
    if (mk < startMK) startMK = mk;
  });

  var monthsBefore = currentMK - startMK;
  var previousRequired = monthsBefore * monthlyRequired;
  var currentActual = Math.max(0, totalContributed - previousRequired);

  // carryOverEnabled: когда ВЫКЛ, учитываются только пополнения текущего
  // месяца — накопленный остаток прошлых периодов не переносится.
  // allowOverpay: когда ВЫКЛ, излишек сверх месячного плана не должен
  // накапливаться и переноситься в будущие периоды, поэтому вклад каждого
  // месяца ограничивается планом ещё до суммирования (а не только обрезается
  // отображаемая цифра текущего месяца).
  if (!settings.carryOverEnabled) {
    var currentMonthDeposits = 0;
    mainDeposits.forEach(function (f) {
      var d = new Date(f.date);
      var mk = d.getFullYear() * 12 + d.getMonth();
      if (mk === currentMK) currentMonthDeposits += f.value;
    });
    currentActual = currentMonthDeposits;
  } else if (!settings.allowOverpay) {
    var cappedByMonth = {};
    mainDeposits.forEach(function (f) {
      var d = new Date(f.date);
      var mk = d.getFullYear() * 12 + d.getMonth();
      cappedByMonth[mk] = (cappedByMonth[mk] || 0) + f.value;
    });
    var cappedTotal = 0;
    Object.keys(cappedByMonth).forEach(function (mk) {
      cappedTotal += Math.min(cappedByMonth[mk], monthlyRequired);
    });
    currentActual = Math.max(0, cappedTotal - previousRequired);
  }

  // allowOverpay ВЫКЛ: финальный потолок на случай переплаты в текущем месяце
  // (актуально, когда перенос остатка отключён). Кэп по цели ТЕКУЩЕГО месяца.
  if (!settings.allowOverpay && currentActual > currentMonthRequired) {
    currentActual = currentMonthRequired;
  }

  var complete = currentActual >= currentMonthRequired;

  return {
    required: currentMonthRequired,
    actual: Math.round(currentActual),
    complete: complete,
    show: true
  };
}

function renderMonthlyStatus() {
  var block = document.getElementById("monthlyStatusBlock");
  if (!block) return;

  var st = computeMonthlyStatus();

  if (!st.show) {
    block.classList.add("monthly-status--hidden");
    return;
  }
  block.classList.remove("monthly-status--hidden");

  var labelEl = document.getElementById("monthlyStatusLabel");
  var valueEl = document.getElementById("monthlyStatusValue");
  if (!labelEl || !valueEl) return;

  if (st.complete) {
    block.classList.add("monthly-status--complete");
    labelEl.textContent = t("monthly.complete");
    valueEl.textContent = t("monthly.completeValue");
  } else {
    block.classList.remove("monthly-status--complete");
    labelEl.textContent = t("monthly.deposited");
    valueEl.textContent = fmtConverted(Math.round(st.actual))
      + " / " + fmtConverted(Math.round(st.required)) + " " + getCurrencySymbol();
  }
}

/**
 * Обновляет UI элементов счетов
 * ⚠️ ВАЖНО: Эта функция вызывается из recalcPlan().
 * Не вызывайте её напрямую - используйте recalcPlan() для обновления состояния.
 */
function renderAccountsUI() {
console.log("chosenPlan:", chosenPlan);
// OPTIMIZATION: DOM cache - renderAccountsUI вызывается на каждый recalcPlan.
const mainEl = getEl("mainAmount");
const reserveEl = getEl("reserveAmount");
const mainTitleEl = getEl("mainAccountTitle");

var goals = getGoals();
var activeGoal = goals[activeGoalIndex] || goals[0] || null;

if (mainEl) {
  if (activeGoal) {
    mainEl.innerText = fmtConverted(activeGoal.saved || 0);
  } else {
    mainEl.innerText = fmtConverted(accounts.main);
  }
}

if (mainTitleEl) {
  if (activeGoalIndex === 0 || !activeGoal) {
    mainTitleEl.innerText = t("accounts.main");
  } else {
    mainTitleEl.innerText = activeGoal.title || t("accounts.account");
  }
}

if (reserveEl) {
reserveEl.innerText = fmtConverted(accounts.reserve);
}

const reserveBlock = document.querySelector(
'.account-block[data-account="reserve"]'
);

if (reserveBlock) {
if (chosenPlan === "buffer" && activeGoalIndex === 0) {
reserveBlock.classList.add("show-reserve");
requestAnimationFrame(function () {
  var inner = reserveBlock.querySelector(".flip-inner");
  var front = reserveBlock.querySelector(".account-flip-front");
  if (inner && front && front.scrollHeight > 0) {
    inner.style.height = front.scrollHeight + "px";
  }
});
} else {
reserveBlock.classList.remove("show-reserve");
}
}

if (typeof renderAccountBackCards === "function") renderAccountBackCards();
renderMonthlyStatus();
}

function updateGoalVerdict(text) {
  var verdict = document.getElementById("goalVerdict");
  if (!verdict) return;
  if (verdict.dataset.text === text) return;
  verdict.dataset.text = text;

  verdict.classList.add("verdict-fade-out");

  setTimeout(function () {
    verdict.innerText = text;
    verdict.classList.remove("verdict-fade-out");
    verdict.classList.add("verdict-fade-in");

    setTimeout(function () {
      verdict.classList.remove("verdict-fade-in");
    }, 450);
  }, 350);
}

function renderGoals() {
// GOAL COMPLETION FEATURE - empty-state toggle (выполняется ДО проверки lastCalc.ok).
// После очистки primary цели lastCalc может остаться в "ok" со старыми данными, либо
// не пересчитываться (canRecalc=false при goalVal=0). В любом случае empty-state
// должен корректно показаться/скрыться.
var goals = getGoals();
var idx = activeGoalIndex;
if (idx < 0 || idx >= goals.length) idx = 0;

var _primaryAmount = parseNumber(goalInput?.value || "0");
var _isPrimaryEmpty = (idx === 0 && _primaryAmount === 0);
var _activeCardEl = getEl("activeGoalCard");
var _emptyCardEl  = getEl("emptyGoalCard");
var _advSettingsEl = document.getElementById("advancedSettingsGoals");
if (_activeCardEl) _activeCardEl.style.display = _isPrimaryEmpty ? "none" : "";
if (_emptyCardEl)  _emptyCardEl.style.display  = _isPrimaryEmpty ? "" : "none";
if (_advSettingsEl) _advSettingsEl.style.display = _isPrimaryEmpty ? "none" : "";
if (_isPrimaryEmpty) {
  var _verdictEl = getEl("goalVerdict");
  if (_verdictEl) _verdictEl.textContent = t("goalEmpty.verdict");
  var _swipeIndicatorEl = getEl("goalSwipeIndicator");
  if (_swipeIndicatorEl) _swipeIndicatorEl.innerHTML = "";
  return; // empty-state не нуждается в дальнейшем рендере
}

if (!lastCalc.ok) return;

var goal = goals[idx] || null;

// OPTIMIZATION: DOM cache - renderGoals вызывается на каждый recalcPlan/swipe.
var titleEl = getEl("goalTitle");
var totalEl = getEl("goalTotal");
var savedEl = getEl("goalSaved");
var percentEl = getEl("goalPercent");
var progressBar = getEl("goalProgressBar");
var verdict = getEl("goalVerdict");
var reserveCard = getEl("goalReserveCard");
var card = getEl("activeGoalCard");
var pausedBadge = getEl("goalPausedBadge");
var pausePlayBtn = getEl("goalPausePlayBtn");

var title, saved, total;
if (idx === 0) {
  title = goalMeta.title;
  saved = accounts.main;
  total = parseNumber(goalInput.value || "0");
} else if (goal) {
  title = goal.title || t("goals.goalN", {n: idx + 1});
  saved = goal.saved || 0;
  total = goal.amount || 0;
} else {
  title = "-";
  saved = 0;
  total = 0;
}

if (titleEl) titleEl.innerText = title;

var percent = total ? Math.min(100, Math.round((saved / total) * 100)) : 0;

if (totalEl) totalEl.innerText = fmtConverted(total);
if (savedEl) savedEl.innerText = fmtConverted(saved);
if (percentEl) percentEl.innerText = percent;
if (progressBar) progressBar.style.width = percent + "%";

// OPTIMIZATION: DOM cache.
var percentLabel = getEl("goalPercentLabel");
if (percentLabel) {
  var section = percentLabel.parentElement;
  if (section) {
    var sw = section.offsetWidth;
    var lw = percentLabel.offsetWidth;
    var progressX = (percent / 100) * sw;
    var targetLeft = progressX - lw - 4;
    var minLeft = 0;
    var maxLeft = sw - lw;
    if (targetLeft < minLeft) targetLeft = minLeft;
    if (targetLeft > maxLeft) targetLeft = maxLeft;
    percentLabel.style.left = targetLeft + "px";
  }
}

var isPaused = goal && goal.paused;

if (verdict) {
  var verdictText;
  if (isPaused) {
    verdictText = t("verdict.paused");
  } else if (percent >= 100) {
    verdictText = t("verdict.complete");
  } else if (percent >= 70) {
    verdictText = t("verdict.almostDone");
  } else {
    verdictText = t("verdict.inProgress");
  }
  updateGoalVerdict(verdictText);
}

if (reserveCard) {
  if (chosenPlan === "buffer" && idx === 0) {
    reserveCard.style.display = "block";
    var reserveEl = document.getElementById("goalReserveAmount");
    if (reserveEl) reserveEl.innerText = fmtConverted(accounts.reserve);
  } else {
    reserveCard.style.display = "none";
  }
}

if (card) {
  card.classList.toggle("goal-card-paused", !!isPaused);
}

if (pausedBadge) {
  if (idx === 0) {
    pausedBadge.style.display = "none";
  } else {
    pausedBadge.style.display = "";
    pausedBadge.classList.toggle("badge-visible", !!isPaused);
  }
}

if (editGoalBtn) {
  editGoalBtn.style.display = (idx === 0) ? "" : "none";
}

if (pausePlayBtn) {
  pausePlayBtn.style.display = (idx > 0 && goal) ? "" : "none";
  var pauseLottie = document.getElementById("goalPauseLottie");
  var playLottie = document.getElementById("goalPlayLottie");
  if (pauseLottie && playLottie) {
    pauseLottie.style.display = isPaused ? "none" : "";
    pauseLottie.parentElement.classList.toggle("showing-pause", !isPaused);
    playLottie.style.display = isPaused ? "" : "none";
    pauseLottie.parentElement.classList.toggle("showing-play", isPaused);
  }
}

renderGoalSwipeIndicator();

if (typeof updateGoalsButton === "function") updateGoalsButton();
}

function renderGoalSwipeIndicator() {
  var indicator = document.getElementById("goalSwipeIndicator");
  if (!indicator) return;
  var goals = getGoals();
  if (goals.length <= 1) {
    indicator.style.display = "none";
    indicator.innerHTML = "";
    return;
  }
  indicator.style.display = "";
  var html = "";
  for (var i = 0; i < goals.length && i < 3; i++) {
    html += '<span class="goal-swipe-dot' + (i === activeGoalIndex ? ' active' : '') + '" data-gidx="' + i + '"></span>';
  }
  indicator.innerHTML = html;

  indicator.querySelectorAll(".goal-swipe-dot").forEach(function (dot) {
    dot.addEventListener("click", function () {
      var targetIdx = parseInt(dot.getAttribute("data-gidx"), 10);
      if (targetIdx !== activeGoalIndex) {
        goalSwipeToIndex(targetIdx, targetIdx > activeGoalIndex);
      }
    });
  });
}

function fireCelebration() {
// haptic - аккуратно
Telegram.WebApp.HapticFeedback.notificationOccurred("success");

if (!isAnimationsEnabled()) return;

const duration = 2600;
const end = Date.now() + duration;

const base = {
spread: 60,
ticks: 140,
gravity: 0.9,
decay: 0.92,
startVelocity: 28,
colors: [
"#3a7bfd",
"#60a5fa",
"#1e3a8a",
"#ffffff"
]
};

(function frame() {
confetti({
particleCount: 6,
angle: 60,
spread: 70,
origin: { x: 0 },
colors: PROTOCOL_COLORS
});

confetti({
particleCount: 6,
angle: 120,
spread: 70,
origin: { x: 1 },
colors: PROTOCOL_COLORS
});

if (Date.now() < end) {
requestAnimationFrame(frame);
}
})();
}

// PREMIUM GOAL COMPLETION - асимметричные конфетти для модалки завершения цели.
// Слева - изумрудная палитра (EMERALD_CONFETTI_COLORS), справа - синяя (PROTOCOL_COLORS).
// Дополнительно: initial burst (60 частиц с каждой стороны) для "wow"-эффекта,
// затем sustained shower 2.6s по 8 частиц/кадр. Mix shapes + scalar 1.1 + ticks 200
// дают премиум-плотность без перегруза CPU. Идемпотентно по haptic-feedback.
function firePremiumCelebration() {
  try {
    if (typeof Telegram !== "undefined" && Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
      Telegram.WebApp.HapticFeedback.notificationOccurred("success");
    }
  } catch (e) { /* ignore */ }

  if (!isAnimationsEnabled()) return;
  if (typeof confetti !== "function") return;

  // ── Initial burst (короткая мощная вспышка с каждой стороны) ──
  var burstCommon = {
    spread: 80,
    startVelocity: 48,
    gravity: 0.95,
    decay: 0.92,
    ticks: 200,
    scalar: 1.1,
    shapes: ["square", "circle"]
  };
  confetti(Object.assign({}, burstCommon, {
    particleCount: 60,
    angle: 60,
    origin: { x: 0, y: 0.7 },
    colors: EMERALD_CONFETTI_COLORS
  }));
  confetti(Object.assign({}, burstCommon, {
    particleCount: 60,
    angle: 120,
    origin: { x: 1, y: 0.7 },
    colors: PROTOCOL_COLORS
  }));

  // ── Sustained shower (2.6s - мягкий "дождь" частиц) ──
  var duration = 2600;
  var end = Date.now() + duration;
  (function frame() {
    var streamCommon = {
      spread: 75,
      startVelocity: 32,
      gravity: 0.92,
      decay: 0.93,
      ticks: 180,
      scalar: 1.0,
      shapes: ["square", "circle"]
    };
    confetti(Object.assign({}, streamCommon, {
      particleCount: 8,
      angle: 60,
      origin: { x: 0, y: 0.75 },
      colors: EMERALD_CONFETTI_COLORS
    }));
    confetti(Object.assign({}, streamCommon, {
      particleCount: 8,
      angle: 120,
      origin: { x: 1, y: 0.75 },
      colors: PROTOCOL_COLORS
    }));
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
window.firePremiumCelebration = firePremiumCelebration;

let confettiInstance = null;

function initConfetti() {
const canvas = document.getElementById("confetti-canvas");
if (!canvas || !window.confetti) return;

confettiInstance = window.confetti.create(canvas, {
resize: true,
useWorker: true
});
}

// сразу инициализируем
initConfetti();

if (editGoalBtn) {
editGoalBtn.onclick = () => {
haptic("light");

hideBottomNav();
if (advancedBtn) advancedBtn.style.display = "none";

var goals = getGoals();
var activeGoal = goals[activeGoalIndex] || goals[0] || null;
if (activeGoalIndex === 0) {
  goalEditTitle.value = goalMeta.title;
  goalEditAmount.value = goalInput.value;
  goalEditBaseValue = parseNumber(goalInput.value || "0");
} else if (activeGoal) {
  goalEditTitle.value = activeGoal.title || "";
  goalEditAmount.value = formatNumber(String(activeGoal.amount || 0));
  goalEditBaseValue = activeGoal.amount || 0;
}

ProtoSheet.open(goalEditorSheet, goalEditorOverlay);
};
}

var goalPausePlayBtn = document.getElementById("goalPausePlayBtn");
var goalPauseLottieAnim = null;
var goalPlayLottieAnim = null;

if (typeof lottie !== "undefined") {
  var pauseContainer = document.getElementById("goalPauseLottie");
  var playContainer = document.getElementById("goalPlayLottie");
  if (pauseContainer) {
    goalPauseLottieAnim = lottie.loadAnimation({
      container: pauseContainer,
      renderer: "svg",
      loop: false,
      autoplay: false,
      path: "assets/animation/Pause.json"
    });
  }
  if (playContainer) {
    goalPlayLottieAnim = lottie.loadAnimation({
      container: playContainer,
      renderer: "svg",
      loop: false,
      autoplay: false,
      path: "assets/animation/Play.json"
    });
  }
}

var editGoalLottieEl = document.getElementById("editGoalLottie");
if (editGoalLottieEl && typeof lottie !== "undefined") {
  lottie.loadAnimation({
    container: editGoalLottieEl,
    renderer: "svg",
    loop: false,
    autoplay: false,
    path: "assets/animation/Pen.json"
  });
}

if (goalPausePlayBtn) {
  goalPausePlayBtn.onclick = function () {
    haptic("light");
    var goals = getGoals();
    var goal = goals[activeGoalIndex];
    if (!goal || activeGoalIndex === 0) return;

    var inner = goalPausePlayBtn.querySelector(".goal-pause-play-inner");

    goal.paused = !goal.paused;
    computeGoalsAllocation(goals, plannedMonthly || 0);
    persistGoals(goals);
    renderGoals();
    if (typeof renderAccountsUI === "function") renderAccountsUI();
    if (typeof renderSVGGraph === "function") renderSVGGraph();
    updatePlanHeader();
    saveFullState();

    var currentAnim = goal.paused ? goalPauseLottieAnim : goalPlayLottieAnim;
    if (currentAnim) {
      currentAnim.goToAndStop(0, true);
      currentAnim.play();
      if (inner) inner.classList.add("swipe-transition");
      currentAnim.addEventListener("complete", function onComplete() {
        currentAnim.removeEventListener("complete", onComplete);
        if (inner) inner.classList.remove("swipe-transition");
      });
    }
  };
}

var advSettingsGoals = document.getElementById("advancedSettingsGoals");
if (advSettingsGoals) {
  advSettingsGoals.onclick = function () {
    if (advancedBtn && advancedBtn.onclick) {
      advancedBtn.onclick();
    }
  };
}

goalEditorOverlay.onclick = () => {
ProtoSheet.close(goalEditorSheet, goalEditorOverlay, {
  onClosed: function () { goalEditHint.classList.remove("show"); }
});
};
ProtoSheet.initSwipe(goalEditorSheet, function () {
  goalEditorOverlay.onclick();
});

goalEditSave.onclick = () => {
haptic("medium");

const newTitle = goalEditTitle.value.trim();
const newAmount = parseNumber(goalEditAmount.value || "0");

if (!newTitle || !newAmount) {
haptic("error");
return;
}

var goals = getGoals();
if (activeGoalIndex === 0) {
  goalMeta.title = newTitle;
  goalInput.value = formatNumber(String(newAmount));
  if (accounts.main >= newAmount) {
    goalCompleted = true;
  }
} else {
  var activeGoal = goals[activeGoalIndex];
  if (activeGoal) {
    activeGoal.title = newTitle;
    activeGoal.amount = newAmount;
  }
  persistGoals(goals);
}

ProtoSheet.close(goalEditorSheet, goalEditorOverlay);
recalcPlan();
pulseGoalCard();
};

goalEditAmount.addEventListener("input", e => {
e.target.value = formatNumber(e.target.value);

const newValue = parseNumber(e.target.value || "0");
if (!goalEditBaseValue || !newValue) return;

const ratio = newValue / goalEditBaseValue;

clearTimeout(goalEditHintTimeout);

goalEditHintTimeout = setTimeout(() => {
handleGoalEditHint(ratio);
}, 420);
});

function pulseGoalCard() {
const card = document.getElementById("activeGoalCard");
if (!card) return;

card.classList.add("pulse");
setTimeout(() => card.classList.remove("pulse"), 400);
}

let goalPulseTimeout = null;

function pulseGoalCard() {
const card = document.getElementById("activeGoalCard");
if (!card) return;

card.classList.remove("pulse");
clearTimeout(goalPulseTimeout);

card.classList.add("pulse");
goalPulseTimeout = setTimeout(() => {
card.classList.remove("pulse");
}, 400);
}

function recalcPlanAfterGoalChange() {
  recalcPlan();
}

function isCashflowNoData() {
  var s = getState();
  if (s.financialModel !== "cashflow") return false;
  var d = s.derivedState || {};
  return !d.hasIncomeData;
}

function updatePlanHeader() {
// OPTIMIZATION: DOM cache в updatePlanHeader (часть hot-path).
var monthlyEl = getEl("planMonthly");
var explainEl = getEl("planExplanation");

if (!monthlyEl || !explainEl) return;

// CUSTOM SCHEDULE v2 - fix main plan display ─────────────────────────────────
// Override стандартного отображения, если активна гибкая модель и хотя бы одна
// сторона использует freq="custom". Тогда вместо фиксированного «N ₽ /мес»
// показываем индивидуальный расчёт от последней введённой суммы с учётом
// counterpart-стороны (фикс. или последний ручной ввод противоположной стороны).
var _cpInfo = (typeof window.getCustomPlanInfo === "function") ? window.getCustomPlanInfo() : null;
if (_cpInfo && _cpInfo.anyCustomActive) {
  var _cardEl = document.getElementById("planHeader");
  if (_cardEl) _cardEl.classList.add("plan-cs-mode");
  var _csSym = (typeof getCurrencySymbol === "function") ? getCurrencySymbol() : "₽";

  if (!_cpInfo.hasAnyEntry) {
    // Нет ручных вводов - даём подсказку, не отображаем старый «0 ₽».
    monthlyEl.innerText = t("flex.noDataTitle");
    explainEl.innerHTML = '<div class="plan-cs-empty">' + t("cs.plan.emptyHint") + '</div>';
    var _inflEl0 = getEl("inflationHint");
    if (_inflEl0) { _inflEl0.textContent = ""; _inflEl0.style.display = "none"; }
    return;
  }

  // FIX: custom schedule accumulation + counters update - главный экран
  // полностью переходит на АККУМУЛИРОВАННЫЕ счётчики.
  //
  // Заголовок: «Нужно отложить: pending ₽» - что ещё нужно докинуть.
  // Если pending=0 (всё отложено или free=0), показываем target и подпись
  // «Уже отложено полностью».
  var _showPending = _cpInfo.pendingDeposit > 0 ? _cpInfo.pendingDeposit : _cpInfo.targetDeposit;
  var _showFormatted = _cpInfo.pendingDeposit > 0 ? _cpInfo.pendingFormatted : _cpInfo.targetFormatted;
  monthlyEl.innerHTML =
    t("cs.plan.title") + ': <b>' + _showFormatted + ' ' + _csSym + '</b>';

  // Подсказка про counterpart (что было учтено в free).
  var _cp = _cpInfo.counterpart || { amount: 0, kind: "none" };
  var _cpLine = "";
  if (_cp.amount > 0) {
    var _cpKey;
    if (_cp.kind === "customTotal") {
      _cpKey = _cpInfo.side === "income" ? "cs.plan.counterpart.totalExpense" : "cs.plan.counterpart.totalIncome";
    } else {
      _cpKey = _cpInfo.side === "income" ? "cs.plan.counterpart.expense" : "cs.plan.counterpart.income";
    }
    _cpLine = t(_cpKey, { amount: (typeof fmtNum === "function" ? fmtNum(_cp.amount) : String(_cp.amount)) + " " + _csSym });
  } else {
    var _noCpKey = _cpInfo.side === "income" ? "cs.plan.noCounterpart.expense" : "cs.plan.noCounterpart.income";
    _cpLine = t(_noCpKey);
  }

  // Срок.
  var _etaLine;
  if (_cpInfo.etaMonths == null) {
    _etaLine = t("cs.plan.termInsufficient");
  } else {
    _etaLine = t("cs.plan.termMonths", { n: _cpInfo.etaMonths });
  }

  // Состав счётчиков. Все значения - от накопленных тоталов:
  //   • «Накоплено дохода» - totalIncome
  //   • «Расходы за период» - totalExpense (если > 0)
  //   • «Свободно» - free (только если есть расходы)
  //   • «Отложено от этой суммы» - alreadyDeposited (Σ entry.deposited)
  //   • «Отложено на цель» - accounts.main (total)
  //   • «Срок» - ETA
  var rowsHtml = '';
  // primary row: «Накоплено дохода» - главная сумма-источник.
  rowsHtml += '<div class="plan-cs-row plan-cs-row--primary">' +
                '<span>' + t("cs.plan.totalIncome") + '</span>' +
                '<b>' + _cpInfo.totalIncomeFormatted + ' ' + _csSym + '</b>' +
              '</div>';
  rowsHtml += '<div class="plan-cs-counterpart">' + _cpLine + '</div>';

  if (_cpInfo.totalExpense > 0) {
    rowsHtml += '<div class="plan-cs-row">' +
                  '<span>' + t("cs.plan.totalExpense") + '</span>' +
                  '<b>' + _cpInfo.totalExpenseFormatted + ' ' + _csSym + '</b>' +
                '</div>';
    rowsHtml += '<div class="plan-cs-row">' +
                  '<span>' + t("cs.plan.free") + '</span>' +
                  '<b>' + _cpInfo.freeFormatted + ' ' + _csSym + '</b>' +
                '</div>';
  }

  rowsHtml += '<div class="plan-cs-row">' +
                '<span>' + t("cs.plan.depositedFromTotal") + '</span>' +
                '<b>' + _cpInfo.alreadyFormatted + ' ' + _csSym + '</b>' +
              '</div>';
  rowsHtml += '<div class="plan-cs-row">' +
                '<span>' + t("cs.plan.deposited") + '</span>' +
                '<b>' + _cpInfo.goalSavedFormatted + ' ' + _csSym + '</b>' +
              '</div>';
  rowsHtml += '<div class="plan-cs-row">' +
                '<span>' + t("cs.plan.term") + '</span>' +
                '<b>' + _etaLine + '</b>' +
              '</div>';

  explainEl.innerHTML = '<div class="plan-cs-block">' + rowsHtml + '</div>';

  // Обновляем индикатор «summaryMonths» (та же ETA).
  var _sumEl0 = getEl("summaryMonths");
  if (_sumEl0) _sumEl0.innerText = (_cpInfo.etaMonths == null ? "-" : _cpInfo.etaMonths);

  // Инфляция/storage type - оставляем штатный рендер (полезен и в custom-режиме).
  var _inflEl1 = getEl("inflationHint");
  if (_inflEl1) {
    var _effInfl = (typeof getEffectiveInflation === "function") ? getEffectiveInflation() : null;
    var _infl = (_effInfl != null) ? _effInfl : ((typeof getActiveInflation === "function") ? getActiveInflation() : null);
    if (_infl != null && _infl > 0) {
      var _is = (Math.round(_infl * 10) / 10).toString();
      _inflEl1.textContent = t("misc.inflation") + ": " + _is + "%";
      _inflEl1.style.display = "";
    } else if (_infl != null && _infl < 0) {
      var _rs = (Math.round(Math.abs(_infl) * 10) / 10).toString();
      _inflEl1.textContent = t("stats.realReturn") + ": +" + _rs + "%";
      _inflEl1.style.display = "";
    } else {
      _inflEl1.textContent = "";
      _inflEl1.style.display = "none";
    }
  }
  return;
}

// CUSTOM SCHEDULE v2 - fix main plan display - снимаем custom-класс, если режим
// больше не активен (пользователь переключил частоту обратно).
var _cardElOff = document.getElementById("planHeader");
if (_cardElOff) _cardElOff.classList.remove("plan-cs-mode");

if (isCashflowNoData()) {
  monthlyEl.innerText = t("flex.noDataTitle");
  explainEl.innerHTML = t("flex.noDataHint");
  return;
}

if (!lastCalc.ok) return;

var goals = getGoals();
var activeGoal = goals[activeGoalIndex] || null;

if (activeGoalIndex > 0 && activeGoal) {
  monthlyEl.innerText = activeGoal.title || (t("misc.goalLabel") + " " + (activeGoalIndex + 1));

  var factEl = document.getElementById("factInput");
  var rawInput = factEl ? parseNumber(factEl.value || "0") : 0;
  var preview = getFactPreviewForGoal(activeGoalIndex, rawInput);

  var _cs = getCurrencySymbol();
  var lines = t("misc.saving") + ": " + fmtConverted(activeGoal.monthlyShare || 0) + " " + _cs + " " + t("pace.perMonth")
    + "<br>" + t("advGoals.priority") + ": " + (activeGoal.priority || 1)
    + "<br>" + t("plan.accumulated") + ": " + fmtConverted(preview) + " " + _cs
    + "<br>" + t("plan.remaining") + ": " + (activeGoal.monthsLeft || "-") + " " + t("misc.monthShort");

  explainEl.innerHTML = lines;

  // OPTIMIZATION: DOM cache.
  var inflationEl = getEl("inflationHint");
  if (inflationEl) { inflationEl.textContent = ""; inflationEl.style.display = "none"; }
  return;
}

var hasMultiGoals = goals.length > 1 && activeGoal;
var goalMonthly = hasMultiGoals ? (activeGoal.monthlyShare || 0) : plannedMonthly;
var goalMonthlySave = hasMultiGoals ? (activeGoal.monthlyShare || 0) : (lastCalc.monthlySave || 0);
var goalMonthsLeft = hasMultiGoals ? (activeGoal.monthsLeft || 0) : (lastCalc.months || 0);
var goalPace = (lastCalc.free && lastCalc.free > 0) ? (goalMonthlySave / lastCalc.free) : (lastCalc.pace || 0);

var _cs2 = getCurrencySymbol();
// Phase 2: в неполном (стартовом) месяце «Текущий план» показывает цель ТЕКУЩЕГО
// месяца (меньше полной), а рядом - полную месячную ставку. Так заголовок и
// карточка счёта согласуются с «Откладываете … в этом месяце».
var _planCmToGoal = (!hasMultiGoals
  && (getState().financialModel === "cashflow")
  && lastCalc.isPartialMonth
  && lastCalc.currentMonthToGoal != null
  && lastCalc.currentMonthToGoal > 0)
  ? lastCalc.currentMonthToGoal : null;
if (_planCmToGoal != null) {
  monthlyEl.innerText = t("plan.current") + ": " + fmtConverted(_planCmToGoal) + " " + _cs2 + " "
    + t("plan.thisMonthOngoing", { ongoing: fmtConverted(goalMonthly) + " " + _cs2 });
} else {
  monthlyEl.innerText =
    t("plan.current") + ": " + fmtConverted(goalMonthly) + " " + _cs2 + " " + t("plan.perMonth");
}

var s = getState();
var isCashflow = (s.financialModel === "cashflow");

var pctVal = Math.round(goalPace * 100);

// Темп накоплений в движке всегда месячный (goalMonthlySave). Но если доход
// поступает раз в неделю / раз в 2 недели, показываем рядом эквивалент за
// выбранный период - так пользователю с недельным доходом понятнее, сколько
// откладывать за раз (зеркало summaryFreqHint на экране расчёта).
var _incFreqNow = isCashflow ? (s.incomeFrequency || "") : "";
var _youSaveStr = fmtNum(goalMonthlySave) + " " + _cs2;
if (goalMonthlySave > 0 && _incFreqNow === "weekly") {
  _youSaveStr += " " + t("plan.perMonth")
    + " (≈ " + fmtNum(Math.round(goalMonthlySave / 4.33)) + " " + _cs2 + " " + t("misc.perWeek") + ")";
} else if (goalMonthlySave > 0 && _incFreqNow === "biweekly") {
  _youSaveStr += " " + t("plan.perMonth")
    + " (≈ " + fmtNum(Math.round(goalMonthlySave / 2.16)) + " " + _cs2 + " " + t("misc.perBiweek") + ")";
}

// PHASE 1 — календарно-точный текущий месяц. Для гибкой модели (одна цель)
// показываем фактические суммы ТЕКУЩЕГО месяца (число реальных поступлений),
// а рядом - ongoing-ставку «полного» месяца (×4.33 для недельного). Для
// простой модели и доп. целей поведение прежнее.
var _useCM = !hasMultiGoals && isCashflow && (lastCalc.currentMonthIncome != null);
var _dispInc = _useCM ? (lastCalc.currentMonthIncome || 0) : (lastCalc.forecastIncome || 0);
// Расход в шапке — это РЕАЛЬНЫЙ счёт за месяц (полная сумма наступлений),
// а не остаток после ответа на плашку. То, что часть уже оплачена, отражается
// в «Свободно/Откладываете» + пометке, чтобы не показывать «0 ₽».
var _dispExp = _useCM ? (lastCalc.currentMonthExpenseFull || 0) : (lastCalc.forecastExpense || 0);
var _dispFree = _useCM ? (lastCalc.currentMonthFree || 0) : (lastCalc.free || 0);
var _dispSave = _useCM ? (lastCalc.currentMonthSave || 0) : goalMonthlySave;
var _incPartial = _useCM && (_dispInc !== (lastCalc.forecastIncome || 0));
var _expPartial = _useCM && (_dispExp !== (lastCalc.forecastExpense || 0));

var _incLine = t("plan.forecastIncome") + ": " + fmtNum(_dispInc) + " " + _cs2
  + (_incPartial
      ? " " + t("plan.thisMonthOngoing", { ongoing: fmtNum(lastCalc.forecastIncome || 0) + " " + _cs2 })
      : " " + t("pace.perMonth"));
var _expLine = t("plan.forecastExpense") + ": " + fmtNum(_dispExp) + " " + _cs2
  + (_expPartial
      ? " " + t("plan.thisMonthOngoing", { ongoing: fmtNum(lastCalc.forecastExpense || 0) + " " + _cs2 })
      : " " + t("pace.perMonth"));
// Пометка о том, что месячный расход уже оплачен (полностью/частично) в этом
// месяце — объясняет, почему «Свободно» больше, чем доход минус расход.
var _peNow = (typeof _partialExpenseForNow === "function") ? _partialExpenseForNow() : { status: null, paidAmount: 0 };
if (_useCM && _peNow.status === "yes") {
  _expLine += " · " + t("plan.expensePaidNote");
} else if (_useCM && _peNow.status === "partial") {
  _expLine += " · " + t("plan.expensePartialNote", { paid: fmtNum(_peNow.paidAmount) + " " + _cs2 });
}
// «Откладываете»: в неполном месяце показываем сумму текущего месяца + пометку.
var _youSaveStrFinal = _incPartial
  ? (fmtNum(_dispSave) + " " + _cs2 + " " + t("plan.thisMonthTag"))
  : _youSaveStr;

var explainText = lastCalc.ok
  ? (isCashflow ? _incLine + "\n" + _expLine + "\n" : "")
    + t("plan.freePerMonth") + ": " + fmtNum(_dispFree) + " " + _cs2 + "\n"
    + t("plan.youSave") + ": " + _youSaveStrFinal + "\n"
    + t("plan.paceOfFree", { pct: pctVal }) + "\n"
    + t("plan.goalReachedIn") + " " + goalMonthsLeft + " " + t("misc.monthShort")
  : t("engine.noBalance");
explainEl.innerHTML = explainText.replace(/\n/g, "<br>");

// OPTIMIZATION: DOM cache.
var inflationEl = getEl("inflationHint");
if (inflationEl) {
  // NEW: Storage type - prefer effective inflation (учитывает доходность
  // инструмента: депозит / акции / металлы), fallback на raw inflation.
  var effInfl = (typeof getEffectiveInflation === "function") ? getEffectiveInflation() : null;
  var infl = (effInfl != null) ? effInfl
           : ((typeof getActiveInflation === "function") ? getActiveInflation() : null);
  if (infl != null && infl > 0) {
    // DYNAMIC INFLATION - ставка теперь decimal (e.g. 7.8). Округляем до 1 знака
    // для аккуратного отображения. Целые числа (5 → "5") тоже корректно.
    var _inflStr = (Math.round(infl * 10) / 10).toString();
    inflationEl.textContent = t("misc.inflation") + ": " + _inflStr + "%";
    inflationEl.style.display = "";
  } else if (infl != null && infl < 0) {
    // NEW: Storage type - yield outpaces inflation → показываем реальную доходность.
    var _retStr = (Math.round(Math.abs(infl) * 10) / 10).toString();
    inflationEl.textContent = t("stats.realReturn") + ": +" + _retStr + "%";
    inflationEl.style.display = "";
  } else {
    inflationEl.textContent = "";
    inflationEl.style.display = "none";
  }
}
}

function handleGoalEditHint(ratio) {
if (!goalEditHint) return;

if (ratio < 1.2) {
goalEditHint.classList.remove("show");
return;
}

let text = "";

if (ratio >= 3) {
text = t("goalEdit.warn3x");
} else if (ratio >= 2) {
text = t("goalEdit.warn2x");
} else {
text = t("goalEdit.warnIncrease");
}

goalEditHint.innerText = text;
goalEditHint.classList.add("show");
}

/* drawStaticLayer / animateFactLine / drawFactLayer / animateDotScale
   removed - now handled by graph-engine-svg.js via renderSVGGraph() */

/* ===== ADVANCED SCREEN LOGIC ===== */

if (advancedBtn) {
  advancedBtn.onclick = () => {
    // PREMIUM SYSTEM - inline-гейт
    if (window._premiumGate && window._premiumGate("advanced")) return;

    haptic("light");
    
       document.body.classList.add("advanced-active");
       var fog = document.querySelector(".advanced-fog");
       if (fog) {
         fog.style.animation = "";
         fog.style.opacity = "";
         fog.style.transition = "";
         fog.style.pointerEvents = "";
       }

    // скрываем все экраны
document.querySelectorAll(".screen")
  .forEach(s => s.classList.remove("active"));

    // показываем advanced
    document
      .getElementById("screen-advanced")
      .classList.add("active");
      
      document.querySelector(".app").scrollTop = 0;

    // скрываем nav
    hideBottomNav();

    // скрываем кнопку
    advancedBtn.style.display = "none";

    // PREMIUM TOUR - мини-онбординг при первом открытии Advanced Settings.
    if (typeof startPremiumFeatureTour === "function") {
      setTimeout(function () { startPremiumFeatureTour("advanced"); }, 400);
    }
  };
}

if (advancedBack) {
  advancedBack.onclick = () => {

    haptic("light");
    
    document.body.classList.remove("advanced-active");

    openScreen("goals", buttons[3]);

    showBottomNav();
  };
}

/* ===== ADD ACCOUNT SCREEN ===== */

if (addAccountBack) {
  addAccountBack.onclick = () => {

    haptic("light");

    openScreen("accounts", buttons[2]);

    showBottomNav();
  };
}

/* ===== FLIP CARD SWIPE ===== */

function measureBackContentHeight(wrapper) {
  var backCard = wrapper.querySelector(".account-back-card");
  var backContent = wrapper.querySelector(".account-back-content");
  if (!backContent || !backCard) return 0;

  var prevCardH = backCard.style.height;
  var prevContentH = backContent.style.height;
  backCard.style.height = "auto";
  backContent.style.height = "auto";
  var h = backContent.scrollHeight;
  backCard.style.height = prevCardH;
  backContent.style.height = prevContentH;
  return h;
}

function syncAccountFlipHeight(wrapper, isFlipped) {
  if (!wrapper || !wrapper.classList.contains("account-block")) return;
  if (wrapper.classList.contains("reserve") && !wrapper.classList.contains("show-reserve")) return;
  var inner = wrapper.querySelector(".flip-inner");
  if (!inner) return;
  var front = wrapper.querySelector(".account-flip-front");
  if (!front) return;

  var frontH = front.scrollHeight;
  if (frontH <= 0) return;

  if (!isFlipped) {
    inner.style.height = frontH + "px";
    return;
  }

  var backH = measureBackContentHeight(wrapper);
  inner.style.height = Math.max(frontH, backH) + "px";
}

function setupFlipSwipe(wrapper) {
  if (!wrapper) return;
  const inner = wrapper.querySelector(".flip-inner");
  if (!inner) return;

  if (wrapper.classList.contains("account-block")) {
    var front = wrapper.querySelector(".account-flip-front");
    if (front && front.scrollHeight > 0) {
      inner.style.height = front.scrollHeight + "px";
    }
  }

  let startX = 0;
  let dx = 0;
  let swiping = false;
  const THRESHOLD = 60;

  wrapper.addEventListener("touchstart", function (e) {
    const t = e.touches[0];
    startX = t.clientX;
    dx = 0;
    swiping = true;
    inner.style.transition = "none";
  }, { passive: true });

  wrapper.addEventListener("touchmove", function (e) {
    if (!swiping) return;
    dx = e.touches[0].clientX - startX;
    const flipped = inner.classList.contains("flipped");
    const base = flipped ? 180 : 0;
    const sign = flipped ? 1 : -1;
    const angle = base + sign * (dx / wrapper.offsetWidth) * 90;
    inner.style.transform = "rotateY(" + (-angle) + "deg)";
  }, { passive: true });

  wrapper.addEventListener("touchend", function () {
    if (!swiping) return;
    swiping = false;
    inner.style.transition = "";
    if (dx < -THRESHOLD) {
      inner.classList.add("flipped");
      syncAccountFlipHeight(wrapper, true);
      wrapper._flipJustSwiped = true;
      setTimeout(function () { wrapper._flipJustSwiped = false; }, 300);
      // PREMIUM TOUR - обратная сторона карточки счёта = «Статистика счёта».
      // Запускаем мини-онбординг при первом флипе для премиум-юзеров.
      // Только для основного счёта (main) - резерв не имеет stats-функции.
      if (wrapper.dataset && wrapper.dataset.account === "main" &&
          typeof startPremiumFeatureTour === "function") {
        setTimeout(function () { startPremiumFeatureTour("stats"); }, 700);
      }
    } else if (dx > THRESHOLD) {
      inner.classList.remove("flipped");
      syncAccountFlipHeight(wrapper, false);
      wrapper._flipJustSwiped = true;
      setTimeout(function () { wrapper._flipJustSwiped = false; }, 300);
    }
    inner.style.transform = "";
  });

  wrapper.addEventListener("touchcancel", function () {
    if (!swiping) return;
    swiping = false;
    inner.style.transition = "";
    inner.style.transform = "";
  });
}

(function initFlipSwipe() {
  document.querySelectorAll(".account-block.flip-wrapper").forEach(function (wrapper) {
    setupFlipSwipe(wrapper);
  });
})();

/* ===== UNEXPECTED EXPENSE SYSTEM ===== */

let selectedExpenseSource = null;

function openUnexpectedExpenseScreen() {
  selectedExpenseSource = null;

  document.activeElement?.blur();

  const options = document.querySelectorAll(".unexpected-option");
  options.forEach(o => o.classList.remove("selected"));

  const amountBlock = document.getElementById("unexpectedAmountBlock");
  const skipBlock = document.getElementById("unexpectedSkipBlock");
  const amountInput = document.getElementById("unexpectedAmount");
  if (amountBlock) amountBlock.style.display = "none";
  if (skipBlock) skipBlock.style.display = "none";
  if (amountInput) amountInput.value = "";

  const reserveOption = document.querySelector('.unexpected-option[data-source="reserve"]');
  if (reserveOption) {
    reserveOption.style.display = chosenPlan === "buffer" ? "flex" : "none";
    reserveOption.classList.toggle("disabled", accounts.reserve === 0);
  }

  openScreen("unexpected", null);
  hideBottomNav();
  window.scrollTo(0, 0);
}

// Выбор варианта
document.querySelectorAll(".unexpected-option").forEach(opt => {
  opt.addEventListener("click", function () {
    if (this.classList.contains("disabled")) {
      if (this.dataset.source === "reserve") {
        showToast(t("toast.insufficientReserve"), "error");
      }
      haptic("error");
      return;
    }
    haptic("light");

    document.querySelectorAll(".unexpected-option").forEach(o => o.classList.remove("selected"));
    this.classList.add("selected");

    selectedExpenseSource = this.dataset.source;

    const amountBlock = document.getElementById("unexpectedAmountBlock");
    const skipBlock = document.getElementById("unexpectedSkipBlock");

    if (selectedExpenseSource === "skip") {
      if (amountBlock) amountBlock.style.display = "none";
      if (skipBlock) skipBlock.style.display = "block";
    } else {
      if (skipBlock) skipBlock.style.display = "none";
      if (amountBlock) amountBlock.style.display = "block";
      const amountInput = document.getElementById("unexpectedAmount");
      if (amountInput) {
        amountInput.value = "";
        amountInput.focus();
      }
      // FINANCIAL EVENTS - INCOME ONLY (mirror UX for expense) - после выбора
      // источника сразу показываем «Доступно: X ₽» (накопления или резерв),
      // и live-валидация ниже подсветит превышение во время ввода.
      _renderUnexpectedAvailable();
    }
  });
});

// FINANCIAL EVENTS - INCOME ONLY (mirror UX for expense) - helper для индикатора
// доступного остатка под input'ом «Сумма расхода». Вызывается:
//   • при выборе варианта (goal/reserve) - показывает «Доступно: X ₽»;
//   • из input-listener'a #unexpectedAmount - переключает .over-limit подсветку.
function _renderUnexpectedAvailable() {
  var hintEl = document.getElementById("unexpectedAvailable");
  if (!hintEl) return;
  if (!selectedExpenseSource || selectedExpenseSource === "skip") {
    hintEl.style.display = "none";
    return;
  }
  var available = selectedExpenseSource === "reserve"
    ? (Number(accounts && accounts.reserve) || 0)
    : (Number(accounts && accounts.main) || 0);
  var amountInput = document.getElementById("unexpectedAmount");
  var typed = amountInput ? (parseNumber(amountInput.value || "0") || 0) : 0;
  var availableFmt = (typeof fmtAmount === "function") ? fmtAmount(available) : String(available);

  if (typed > available && typed > 0) {
    hintEl.textContent = t("unexpected.overLimit", { amount: availableFmt });
    hintEl.classList.add("over-limit");
  } else {
    hintEl.textContent = t("unexpected.available", { amount: availableFmt });
    hintEl.classList.remove("over-limit");
  }
  hintEl.style.display = "";
}

// Форматирование ввода суммы
const unexpectedAmountInput = document.getElementById("unexpectedAmount");
if (unexpectedAmountInput) {
  unexpectedAmountInput.addEventListener("input", function (e) {
    const p = e.target.selectionStart;
    const b = e.target.value.length;
    e.target.value = formatNumber(e.target.value);
    const a = e.target.value.length;
    e.target.selectionEnd = p + (a - b);
    // FINANCIAL EVENTS - INCOME ONLY (mirror UX for expense) - live-валидация:
    // обновляем индикатор «доступно / превышено» на каждый ввод цифры.
    _renderUnexpectedAvailable();
  });
}

// Подтверждение расхода из цели/резерва
const unexpectedConfirmBtn = document.getElementById("unexpectedConfirm");
if (unexpectedConfirmBtn) {
  unexpectedConfirmBtn.addEventListener("click", function () {
    const input = document.getElementById("unexpectedAmount");
    const amount = parseNumber(input?.value || "0");

    if (!amount || amount <= 0) {
      haptic("error");
      const wrap = input?.closest(".input-wrap");
      if (wrap) {
        wrap.classList.add("error");
        wrap.classList.remove("shake");
        void wrap.offsetWidth;
        wrap.classList.add("shake");
      }
      return;
    }

    // Проверяем что не списываем больше, чем есть
    if (selectedExpenseSource === "goal" && amount > accounts.main) {
      haptic("error");
      const wrap = input?.closest(".input-wrap");
      if (wrap) {
        wrap.classList.add("error");
        wrap.classList.remove("shake");
        void wrap.offsetWidth;
        wrap.classList.add("shake");
      }
      return;
    }
    if (selectedExpenseSource === "reserve" && amount > accounts.reserve) {
      haptic("error");
      const wrap = input?.closest(".input-wrap");
      if (wrap) {
        wrap.classList.add("error");
        wrap.classList.remove("shake");
        void wrap.offsetWidth;
        wrap.classList.add("shake");
      }
      return;
    }

    haptic("medium");
    applyFinancialEvent(selectedExpenseSource, amount);
  });
}

// Подтверждение пропуска месяца
const unexpectedSkipConfirmBtn = document.getElementById("unexpectedSkipConfirm");
if (unexpectedSkipConfirmBtn) {
  unexpectedSkipConfirmBtn.addEventListener("click", function () {
    haptic("medium");
    applyFinancialEvent("skip", 0);
  });
}

// Кнопка «Назад»
const unexpectedBackBtn = document.getElementById("unexpectedBack");
if (unexpectedBackBtn) {
  unexpectedBackBtn.addEventListener("click", function () {
    haptic("light");
    openScreen("advice", buttons[1]);
    showBottomNav();
  });
}

/**
 * Создаёт финансовое событие, пересчитывает план через event engine,
 * обновляет UI (счета, график, brain, цели).
 */
function applyFinancialEvent(source, amount) {
  FinancialEvents.createEvent({
    type: FinancialEvents.EVENT_TYPES.UNEXPECTED_EXPENSE,
    amount: amount,
    source: source,
    date: new Date()
  });

  if (source !== "skip") {
    const now = new Date();
    const realTimestamp = now.toISOString();
    const periodDate = new Date(now);
    periodDate.setDate(1);
    periodDate.setHours(0, 0, 0, 0);
    factHistory.push({
      value: -amount,
      date: periodDate,
      to: source === "reserve" ? "reserve" : "main",
      timestamp: realTimestamp
    });
  }

  recalcPlan();

  const analysis = FinancialEvents.buildExpenseAnalysis();
  if (analysis) {
    showBrainMessage(analysis.message);
  }

  openScreen("advice", buttons[1]);
  showBottomNav();
}

/* ===== CASHFLOW SETTINGS ===== */

function checkPremiumGate() {
  var s = getState();
  if (s.financialModel === "cashflow" && !s.isPremium) {
    updateState({ financialModel: "simple", incomeType: "fixed", expenseType: "fixed" });
    recalcPlan();
    return true;
  }
  return false;
}

function isFlexibleUnconfigured() {
  return false;
}

function freqLabel(freq, days) {
  switch (freq) {
    case "weekly": return t("freq.weekly");
    case "biweekly": return t("freq.biweekly");
    case "custom":
      // CUSTOM SCHEDULE LOGIC - для freq=custom теперь используется журнал
      // ручного ввода (customScheduleEntries). Старые days показываем только
      // если они уже были сохранены - иначе просто "Свой график".
      if (Array.isArray(days) && days.length) {
        return t("freq.custom") + " (" + days.join(", ") + ")";
      }
      return t("freq.custom");
    default: return t("freq.fixed");
  }
}

function shakeFlexHint() {
  var hint = document.getElementById("flexHint");
  if (!hint) return;
  hint.classList.add("visible");
  hint.classList.remove("shake");
  void hint.offsetWidth;
  hint.classList.add("shake");
  setTimeout(function () { hint.classList.remove("shake"); }, 400);
}

function cfFlowFreqLabel(freq, days) {
  switch (freq) {
    case "weekly": return t("freq.weekly");
    case "biweekly": return t("freq.biweekly");
    case "monthly": return t("freq.monthly");
    case "custom":
      if (Array.isArray(days) && days.length) {
        return t("freq.custom") + " (" + days.length + ")";
      }
      return t("freq.custom");
    default: return t("freq.monthly");
  }
}

function syncFlexibleUI() {
  var noData = isCashflowNoData();
  var s = getState();
  var isCashflow = (s.financialModel === "cashflow");

  // OPTIMIZATION: DOM cache в hot-path syncFlexibleUI.
  var factRow = document.querySelector(".fact-input-row");
  var factInput = getEl("factInput");
  var applyBtn = getEl("applyFact");

  if (factRow) factRow.classList.toggle("fact-row-disabled", noData);
  if (factInput) factInput.disabled = noData;
  if (applyBtn) applyBtn.disabled = noData;

  if (factRow && !factRow.dataset.flexShakeBound) {
    factRow.dataset.flexShakeBound = "1";
    factRow.addEventListener("click", function () {
      if (isCashflowNoData()) {
        shakeFlexHint();
        haptic("error");
      }
    });
  }

  var hint = getEl("flexHint");
  if (!hint && factRow && factRow.parentNode) {
    hint = document.createElement("div");
    hint.id = "flexHint";
    hint.className = "flex-hint flex-hint--alert";
    factRow.parentNode.insertBefore(hint, factRow.nextSibling);
    domCache.flexHint = hint;
  }
  if (hint) {
    hint.classList.add("flex-hint--alert");
    if (noData) {
      hint.textContent = t("flex.addIncomeHint");
    }
    hint.classList.toggle("visible", noData);
  }

  // OPTIMIZATION: DOM cache - три getElementById на каждый ререндер.
  var summaryMonthlyEl = getEl("summaryMonthly");
  var summaryMonthsEl = getEl("summaryMonths");
  var summaryModeEl = getEl("summaryMode");

  if (noData) {
    if (summaryMonthlyEl) summaryMonthlyEl.innerText = "-";
    if (summaryMonthsEl) summaryMonthsEl.innerText = "-";
    if (summaryModeEl) summaryModeEl.innerText = t("flex.noData");
  } else if (isCashflow && lastCalc.ok) {
    if (summaryMonthlyEl) summaryMonthlyEl.innerText = fmtConverted(lastCalc.monthlySave);
    if (summaryMonthsEl) summaryMonthsEl.innerText = lastCalc.months;
  }

  // ── Weekly/biweekly hint ──
  // OPTIMIZATION: DOM cache.
  var freqHintEl = getEl("summaryFreqHint");
  if (freqHintEl) {
    var incFreq = s.incomeFrequency || "monthly";
    if (isCashflow && lastCalc.ok && lastCalc.monthlySave && !noData) {
      if (incFreq === "weekly") {
        freqHintEl.innerText = "≈ " + fmtConverted(Math.round(lastCalc.monthlySave / 4.33)) + " " + getCurrencySymbol() + " " + t("misc.perWeek");
        freqHintEl.style.display = "";
      } else if (incFreq === "biweekly") {
        freqHintEl.innerText = "≈ " + fmtConverted(Math.round(lastCalc.monthlySave / 2.16)) + " " + getCurrencySymbol() + " " + t("misc.perBiweek");
        freqHintEl.style.display = "";
      } else {
        freqHintEl.style.display = "none";
      }
    } else {
      freqHintEl.style.display = "none";
    }
  }

  // ── Model report ──
  // OPTIMIZATION: DOM cache.
  var reportEl = getEl("summaryModelReport");
  if (reportEl) {
    if (isCashflow && !noData) {
      var incLabel = freqLabel(s.incomeFrequency, s.incomeMonthDays);
      var expLabel = freqLabel(s.expenseFrequency, s.expenseMonthDays);
      reportEl.innerHTML = t("flex.income") + ": " + incLabel + "<br>" + t("flex.expense") + ": " + expLabel;
      reportEl.style.display = "";
    } else {
      reportEl.style.display = "none";
    }
  }

  // ── Build labels ──
  var incType = s.incomeType || "fixed";
  var expType = s.expenseType || "fixed";

  // NEW: логика fixed vs variable 11.05.2026 - enforce visibility from EVERY entry
  // path that funnels through syncFlexibleUI (state hydrate, language change, etc.).
  applyFlexibleSideVisibility(incType, expType);

  var incTypeName = incType === "fixed" ? t("freq.fixed") : t("freq.variable");
  var expTypeName = expType === "fixed" ? t("freq.fixedPlural") : t("freq.variablePlural");
  var incFreqName = incType === "fixed"
    ? ""
    : ", " + cfFlowFreqLabel(s.incomeFrequency, s.incomeMonthDays);
  var expFreqName = expType === "fixed"
    ? ""
    : ", " + cfFlowFreqLabel(s.expenseFrequency, s.expenseMonthDays);

  // ── In-panel flow summary ──
  // OPTIMIZATION: DOM cache - каскад из 8 getElementById на каждый syncFlexibleUI.
  var flowSummary = getEl("cfFlowSummary");
  var flowText = getEl("cfFlowSummaryText");
  if (flowSummary && flowText) {
    flowText.innerHTML =
      '<div class="cf-summary-row"><span class="cf-summary-dot"></span>' + t("flex.income") + ': ' + incTypeName + incFreqName + '</div>' +
      '<div class="cf-summary-row"><span class="cf-summary-dot"></span>' + t("flex.expenses") + ': ' + expTypeName + expFreqName + '</div>';
  }

  // ── Inline per-card summaries ──
  var incInline = getEl("incomeInlineSummary");
  if (incInline) {
    incInline.textContent = t("flex.income") + ": " + incTypeName + incFreqName;
    incInline.classList.add("visible");
  }
  var expInline = getEl("expenseInlineSummary");
  if (expInline) {
    expInline.textContent = t("flex.expenses") + ": " + expTypeName + expFreqName;
    expInline.classList.add("visible");
  }

  // ── Card status indicators ──
  var incStatus = getEl("incomeCardStatus");
  if (incStatus) incStatus.classList.add("visible");
  var expStatus = getEl("expenseCardStatus");
  if (expStatus) expStatus.classList.add("visible");

  // ── Card configured border ──
  var incCard = getEl("cfCardIncome");
  if (incCard) incCard.classList.add("cf-card--configured");
  var expCard = getEl("cfCardExpense");
  if (expCard) expCard.classList.add("cf-card--configured");

  if (typeof renderFlexModelSummary === "function") renderFlexModelSummary();

  // CUSTOM SCHEDULE LOGIC - синхронизируем видимость нового блока «Свой график»
  // и перерендериваем его сводку/историю (сюда попадаем из recalcPlan на любое
  // изменение state, поэтому summary всегда актуален: последняя сумма, отложено,
  // примерный срок до цели).
  var sCustom = (typeof getState === "function") ? getState() : {};
  var incCb = document.getElementById("incomeCustomBlock");
  var expCb = document.getElementById("expenseCustomBlock");
  var incIsCustom = (sCustom.incomeType === "variable") && ((sCustom.incomeFrequency || "monthly") === "custom");
  var expIsCustom = (sCustom.expenseType === "variable") && ((sCustom.expenseFrequency || "monthly") === "custom");
  if (incCb) incCb.style.display = incIsCustom ? "flex" : "none";
  if (expCb) expCb.style.display = expIsCustom ? "flex" : "none";
  if (typeof window.renderCustomSchedule === "function") {
    if (incIsCustom) window.renderCustomSchedule("income");
    if (expIsCustom) window.renderCustomSchedule("expense");
  }
}

/**
 * NEW: логика fixed vs variable 11.05.2026 - module-level visibility enforcer.
 *
 * Single source of truth for showing/hiding the per-side UI sections.
 * Called from BOTH initCashflowSettings() (init + toggle handlers + applySettingsChange)
 * AND syncFlexibleUI() (which can be triggered from any state mutation path).
 *
 *  FIXED   → show #incomeFixedHint, hide #fixedIncomeWrap + #incomeFrequencySelector
 *  VARIABLE → hide #incomeFixedHint, show #fixedIncomeWrap + #incomeFrequencySelector
 *
 * Uses style.display directly so the elements truly leave the layout flow in FIXED
 * mode (the .visible class on .frequency-selector only collapses max-height/opacity).
 */
function applyFlexibleSideVisibility(incType, expType) {
  var incIsFixed = (incType || "fixed") === "fixed";
  var expIsFixed = (expType || "fixed") === "fixed";

  // OPTIMIZATION: DOM cache - 6 getElementById вызывались на каждый
  // syncFlexibleUI/initCashflowSettings/toggle.
  applySideVisibility(
    incIsFixed,
    getEl("incomeFixedHint"),
    getEl("fixedIncomeWrap"),
    getEl("incomeFrequencySelector")
  );
  applySideVisibility(
    expIsFixed,
    getEl("expenseFixedHint"),
    getEl("fixedExpenseWrap"),
    getEl("expenseFrequencySelector")
  );
}

// Single rule set for ONE side (income OR expense):
//   FIXED    → show hint only; hide amount+date wrap and frequency selector.
//   VARIABLE → hide hint; show amount+date wrap (sum + date inputs) AND frequency selector.
// Using style.display = "" intentionally clears the inline display:none from the
// HTML so the element's default CSS block layout kicks back in. Inner children
// (.input-wrap with the amount field, .cf-startdate-row with the date) are also
// reset so nothing can leave the "Сумма" input hidden in variable mode.
function applySideVisibility(isFixed, hintEl, wrapEl, freqBlk) {
  if (isFixed) {
    if (hintEl) hintEl.style.display = "";
    if (wrapEl) wrapEl.style.display = "none";
    if (freqBlk) {
      freqBlk.classList.remove("visible");
      freqBlk.style.display = "none";
    }
  } else {
    if (hintEl) hintEl.style.display = "none";
    if (wrapEl) {
      wrapEl.style.display = "";
      var inputWrap = wrapEl.querySelector(".input-wrap");
      var startRow  = wrapEl.querySelector(".cf-startdate-row");
      if (inputWrap) inputWrap.style.display = "";
      if (startRow)  startRow.style.display  = "";
    }
    if (freqBlk) {
      freqBlk.style.display = "";
      freqBlk.classList.add("visible");
    }
  }
}

function applyPremiumUI(isPremium) {
  var variableBtns = document.querySelectorAll(
    '#incomeToggle .mode-btn[data-value="variable"], #expenseToggle .mode-btn[data-value="variable"]'
  );
  var freqBtns = document.querySelectorAll(
    '#incomeFrequencySelector .freq-btn:not([data-freq="monthly"]), #expenseFrequencySelector .freq-btn:not([data-freq="monthly"])'
  );
  var addEventBtn = document.getElementById("addFinancialEvent");
  for (var i = 0; i < variableBtns.length; i++) {
    variableBtns[i].classList.toggle("premium-locked", !isPremium);
    variableBtns[i].disabled = !isPremium;
  }
  for (var j = 0; j < freqBtns.length; j++) {
    freqBtns[j].classList.toggle("premium-locked", !isPremium);
    freqBtns[j].disabled = !isPremium;
  }
  if (addEventBtn) {
    addEventBtn.classList.toggle("premium-locked", !isPremium);
    addEventBtn.disabled = !isPremium;
  }
}

function parseMonthDays(str) {
  if (!str) return [];
  return str.split(",")
    .map(function (s) { return parseInt(s.trim(), 10); })
    .filter(function (n) { return n >= 1 && n <= 31; });
}

function enableFlexibleMode() {
  updateState({
    financialModel: "cashflow"
  });
  recalcPlan();
}

function renderMonthDaysList(listId, stateKey) {
  var listEl = document.getElementById(listId);
  if (!listEl) return;
  listEl.innerHTML = "";
  var selected = getState()[stateKey] || [];
  selected.forEach(function (day) {
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "monthday-chip";
    chip.textContent = day;
    chip.dataset.day = day;
    chip.addEventListener("click", function () {
      haptic("light");
      var cur = (getState()[stateKey] || []).slice();
      var idx = cur.indexOf(day);
      if (idx !== -1) cur.splice(idx, 1);
      var patch = {};
      patch[stateKey] = cur;
      updateState(patch);
      renderMonthDaysList(listId, stateKey);
      recalcPlan();
    });
    listEl.appendChild(chip);
  });
}

function setupMonthDaysDateInput(dateInputId, listId, stateKey) {
  var dateInput = document.getElementById(dateInputId);
  if (!dateInput) return;
  dateInput.value = "";
  dateInput.addEventListener("change", function () {
    var val = this.value;
    if (!val) return;
    var d = new Date(val);
    if (isNaN(d.getTime())) return;
    var day = d.getDate();
    var cur = (getState()[stateKey] || []).slice();
    if (cur.indexOf(day) !== -1) { this.value = ""; return; }
    cur.push(day);
    cur.sort(function (a, b) { return a - b; });
    var patch = {};
    patch[stateKey] = cur;
    updateState(patch);
    renderMonthDaysList(listId, stateKey);
    recalcPlan();
    this.value = "";
  });
  renderMonthDaysList(listId, stateKey);
}

function initCashflowSettings() {
  // OPTIMIZATION: DOM cache - initCashflowSettings вызывается один раз, но
  // эти id переиспользуются дальше в этом же файле, поэтому кешируем заранее.
  var flexToggle = getEl("flexibleToggle");
  var flexContent = getEl("flexibleContent");
  var incomeToggle = getEl("incomeToggle");
  var expenseToggle = getEl("expenseToggle");
  var incomeFreqBlock = getEl("incomeFrequencySelector");
  var expenseFreqBlock = getEl("expenseFrequencySelector");
  var addEventBtn = getEl("addFinancialEvent");
  var incomeMonthDaysWrap = getEl("incomeMonthDaysWrap");
  var expenseMonthDaysWrap = getEl("expenseMonthDaysWrap");
  var fixedIncomeWrap = getEl("fixedIncomeWrap");
  var fixedExpenseWrap = getEl("fixedExpenseWrap");
  var fixedIncomeInput = getEl("fixedIncomeInput");
  var fixedExpenseInput = getEl("fixedExpenseInput");
  // NEW: start date inputs for VARIABLE periodic schedule
  var incomeStartDateInput = getEl("incomeStartDate");
  var expenseStartDateInput = getEl("expenseStartDate");
  // NEW: логика fixed vs variable 11.05.2026 - read-only summary blocks shown only in FIXED mode
  var incomeFixedHint = getEl("incomeFixedHint");
  var expenseFixedHint = getEl("expenseFixedHint");
  var incomeFixedHintLine = getEl("incomeFixedHintLine");
  var expenseFixedHintLine = getEl("expenseFixedHintLine");

  if (!flexToggle || !flexContent) return;

  var currentState = getState();
  var incomeType = currentState.incomeType || "fixed";
  var expenseType = currentState.expenseType || "fixed";
  // Частота может быть "" (не выбрана) - тогда ни одна кнопка периодичности не
  // подсвечивается. НЕ дефолтим в "monthly", иначе «Ежемесячно» выглядела бы
  // предвыбранной при переходе в «Нефиксированный».
  var incomeFrequency = currentState.incomeFrequency || "";
  var expenseFrequency = currentState.expenseFrequency || "";

  applyPremiumUI(true);

  if (currentState.financialModel === "cashflow") {
    flexContent.classList.add("open");
    flexToggle.classList.add("open");
  }

  syncToggleUI(incomeToggle, incomeType);
  syncToggleUI(expenseToggle, expenseType);
  // NEW: логика fixed vs variable 11.05.2026 - apply all three visibility helpers together.
  syncSideUIVisibility(incomeType, expenseType);
  if (fixedIncomeInput && (currentState.fixedIncomeAmount != null)) fixedIncomeInput.value = currentState.fixedIncomeAmount;
  if (fixedExpenseInput && (currentState.fixedExpenseAmount != null)) fixedExpenseInput.value = currentState.fixedExpenseAmount;
  if (incomeStartDateInput && currentState.incomeStartDate) incomeStartDateInput.value = currentState.incomeStartDate;
  if (expenseStartDateInput && currentState.expenseStartDate) expenseStartDateInput.value = currentState.expenseStartDate;
  syncFreqUIBlock(incomeFreqBlock, incomeFrequency);
  syncFreqUIBlock(expenseFreqBlock, expenseFrequency);
  updateMonthDaysVisibility(incomeFrequency, "income");
  updateMonthDaysVisibility(expenseFrequency, "expense");

  setupMonthDaysDateInput("incomeMonthDaysDate", "incomeMonthDaysList", "incomeMonthDays");
  setupMonthDaysDateInput("expenseMonthDaysDate", "expenseMonthDaysList", "expenseMonthDays");

  flexToggle.addEventListener("click", function () {
    // PREMIUM SYSTEM - inline-гейт (флекс-модель только для премиум-пользователей)
    if (window._premiumGate && window._premiumGate("flexible")) return;
    haptic("light");

    var willOpen = !flexContent.classList.contains("open");
    if (flexContent.classList.contains("open")) {
      flexContent.classList.remove("open");
      flexToggle.classList.remove("open");
    } else {
      requestAnimationFrame(function () {
        flexContent.classList.add("open");
        flexToggle.classList.add("open");
      });
    }

    // PREMIUM TOUR - после первого открытия раздела показываем мини-онбординг
    // для премиум-пользователей. Задержка 350ms - даём content раскрыться,
    // чтобы scrollIntoView отработал по новому layout'у.
    if (willOpen && typeof startPremiumFeatureTour === "function") {
      setTimeout(function () { startPremiumFeatureTour("flexible"); }, 350);
    }
  });

  // NEW: логика fixed vs variable 11.05.2026 - auto-fill today's date when the user
  // switches a side to VARIABLE for the first time, so the schedule has an anchor.
  function ensureStartDateForVariable(side) {
    var st = getState();
    if (side === "income" && (st.incomeType || "fixed") === "variable" && !st.incomeStartDate) {
      var today = (new Date()).toISOString().slice(0, 10);
      updateState({ incomeStartDate: today });
      if (incomeStartDateInput) incomeStartDateInput.value = today;
    }
    if (side === "expense" && (st.expenseType || "fixed") === "variable" && !st.expenseStartDate) {
      var today2 = (new Date()).toISOString().slice(0, 10);
      updateState({ expenseStartDate: today2 });
      if (expenseStartDateInput) expenseStartDateInput.value = today2;
    }
  }

  if (incomeToggle) {
    incomeToggle.addEventListener("click", function (e) {
      var btn = e.target.closest(".mode-btn");
      if (!btn || btn.disabled) return;
      e.stopPropagation();
      haptic("light");
      incomeType = btn.dataset.value;
      syncToggleUI(incomeToggle, incomeType);
      // NEW: логика fixed vs variable 11.05.2026 - write the new type FIRST so all
      // downstream visibility/state helpers (ensureStartDateForVariable, syncSideUIVisibility,
      // renderFlexModelSummary) see the canonical value.
      updateState({ incomeType: incomeType });
      if (incomeType === "variable") ensureStartDateForVariable("income");
      syncSideUIVisibility(incomeType, expenseType);
      updateMonthDaysVisibility(incomeFrequency, "income");
      applySettingsChange();
    });
  }

  if (expenseToggle) {
    expenseToggle.addEventListener("click", function (e) {
      var btn = e.target.closest(".mode-btn");
      if (!btn || btn.disabled) return;
      e.stopPropagation();
      haptic("light");
      expenseType = btn.dataset.value;
      syncToggleUI(expenseToggle, expenseType);
      updateState({ expenseType: expenseType });
      if (expenseType === "variable") ensureStartDateForVariable("expense");
      syncSideUIVisibility(incomeType, expenseType);
      updateMonthDaysVisibility(expenseFrequency, "expense");
      applySettingsChange();
    });
  }

  // OPTIMIZATION: дебаунс тяжёлого каскада updateState + recalcPlan на input.
  // Форматирование цифр и подстройка курсора - мгновенные (UX без задержки),
  // а пересчёт плана/UI откладывается на 250ms после последнего нажатия клавиши.
  if (fixedIncomeInput) {
    var _fixedIncomeRecalc = debounce(function () {
      updateState({ fixedIncomeAmount: fixedIncomeInput.value.trim() });
      ensureStartDateForVariable("income");
      recalcPlan();
    }, 250);
    fixedIncomeInput.addEventListener("input", function () {
      // OPTIMIZATION: вынесли дублирующийся блок форматирования в formatNumericInput().
      formatNumericInput(this);
      _fixedIncomeRecalc();
    });
    fixedIncomeInput.addEventListener("blur", function () { saveFullState(); });
  }
  if (fixedExpenseInput) {
    var _fixedExpenseRecalc = debounce(function () {
      updateState({ fixedExpenseAmount: fixedExpenseInput.value.trim() });
      ensureStartDateForVariable("expense");
      recalcPlan();
    }, 250);
    fixedExpenseInput.addEventListener("input", function () {
      // OPTIMIZATION: вынесли дублирующийся блок форматирования в formatNumericInput().
      formatNumericInput(this);
      _fixedExpenseRecalc();
    });
    fixedExpenseInput.addEventListener("blur", function () { saveFullState(); });
  }

  // NEW: start-date change handlers - patch state, recalculate, refresh summary.
  if (incomeStartDateInput) {
    incomeStartDateInput.addEventListener("change", function () {
      var v = this.value || "";
      updateState({ incomeStartDate: v });
      recalcPlan();
      saveFullState();
    });
  }
  if (expenseStartDateInput) {
    expenseStartDateInput.addEventListener("change", function () {
      var v = this.value || "";
      updateState({ expenseStartDate: v });
      recalcPlan();
      saveFullState();
    });
  }

  function onFreqClick(block, e) {
    var btn = e.target.closest(".freq-btn");
    if (!btn || btn.disabled) return;
    haptic("light");
    var freq = btn.dataset.freq;
    var forIncome = block && block.getAttribute("data-for") === "income";
    var sideLabel = forIncome ? "income" : "expense";
    // Захватываем прежний прогноз ДО мутации - нужен для defence от
    // повторного ввода той же суммы/частоты в configure-режиме.
    var _sPrev = (typeof getState === "function") ? getState() : {};
    var prevFreq = forIncome ? (_sPrev.incomeFrequency || "") : (_sPrev.expenseFrequency || "");
    var prevAmount = forIncome
      ? (Number(_sPrev.fixedIncomeAmount) || 0)
      : (Number(_sPrev.fixedExpenseAmount) || 0);
    if (forIncome) {
      incomeFrequency = freq;
      updateState({ incomeFrequency: freq });
      syncFreqUIBlock(incomeFreqBlock, freq);
      updateMonthDaysVisibility(freq, "income");
    } else {
      expenseFrequency = freq;
      updateState({ expenseFrequency: freq });
      syncFreqUIBlock(expenseFreqBlock, freq);
      updateMonthDaysVisibility(freq, "expense");
    }
    // NEW: логика fixed vs variable 11.05.2026 - refresh card summary + cashflow events.
    recalcPlan();
    saveFullState();

    // После смены частоты открываем единую модалку. Поведение зависит от freq:
    //   • non-custom (monthly/weekly/biweekly) - CONFIGURE-режим: настраиваем
    //     прогноз (сумма + частота), без записи факта и без отложения. Повтор
    //     той же суммы при той же частоте - отклоняется с подсказкой.
    //   • custom («свой график») - record-режим: добавление отдельного события.
    if (typeof window.openCustomScheduleSheet === "function") {
      // Открываем модалку только если type=variable (для variable-side ввод имеет
      // смысл; для fixed-side частота меняется через свои элементы UI).
      var sNow = (typeof getState === "function") ? getState() : {};
      var sideType = forIncome ? (sNow.incomeType || "fixed") : (sNow.expenseType || "fixed");
      if (sideType === "variable") {
        if (freq === "custom") {
          window.openCustomScheduleSheet(sideLabel, { frequency: freq });
        } else {
          window.openCustomScheduleSheet(sideLabel, {
            frequency: freq,
            configure: true,
            prevFreq: prevFreq,
            prevAmount: prevAmount
          });
        }
      }
    }
  }

  if (incomeFreqBlock) incomeFreqBlock.addEventListener("click", function (e) { onFreqClick(incomeFreqBlock, e); });
  if (expenseFreqBlock) expenseFreqBlock.addEventListener("click", function (e) { onFreqClick(expenseFreqBlock, e); });


  if (addEventBtn) {
    addEventBtn.addEventListener("click", function () {
      if (addEventBtn.disabled) return;
      haptic("light");
      openEventEditor();
    });
  }

  function applySettingsChange() {
    var model = (incomeType === "variable" || expenseType === "variable") ? "cashflow" : "simple";
    updateState({
      incomeType: incomeType,
      expenseType: expenseType,
      incomeFrequency: incomeFrequency,
      expenseFrequency: expenseFrequency,
      financialModel: model
    });
    // NEW: логика fixed vs variable 11.05.2026 - refresh ALL side-related visibility,
    // not just the frequency block, so the inputs and hint stay in sync after any change.
    syncSideUIVisibility(incomeType, expenseType);
    recalcPlan();
  }

  function updateMonthDaysVisibility(freq, type) {
    var wrap = type === "income" ? incomeMonthDaysWrap : expenseMonthDaysWrap;
    var sideType = type === "income"
      ? (getState().incomeType || "fixed")
      : (getState().expenseType || "fixed");
    // UNIFIED CUSTOM SCHEDULE FLOW - блок ручного ввода `.custom-schedule-block`
    // теперь виден для ВСЕХ variable-периодичностей (weekly / biweekly / monthly
    // / custom), потому что единая модалка «Записать поступление» создаёт запись
    // в customScheduleEntries при любой частоте. Так пользователь видит полную
    // историю вводов и reminder'ы независимо от выбранного freq.
    var shouldShow = (sideType === "variable");
    // CUSTOM SCHEDULE LOGIC - старый picker дней месяца полностью заменён
    // блоком ручного ввода `.custom-schedule-block`. Прежний wrap скрыт всегда,
    // чтобы не путать пользователя двумя UI одновременно. Сам элемент оставлен
    // в DOM для обратной совместимости с прежними listener'ами setupMonthDaysDateInput.
    if (wrap) wrap.style.display = "none";
    var customBlockId = type === "income" ? "incomeCustomBlock" : "expenseCustomBlock";
    var customBlock = document.getElementById(customBlockId);
    if (customBlock) {
      customBlock.style.display = shouldShow ? "flex" : "none";
      if (shouldShow && typeof window.renderCustomSchedule === "function") {
        window.renderCustomSchedule(type);
      }
    }
  }

  // NEW: логика fixed vs variable 11.05.2026 - thin wrapper around the module-level
  // applyFlexibleSideVisibility so the toggle handlers and applySettingsChange share
  // a single source of truth for show/hide rules (no duplicated logic).
  function syncSideUIVisibility(inc, exp) {
    applyFlexibleSideVisibility(inc, exp);
  }

  function syncToggleUI(container, value) {
    if (!container) return;
    var btns = container.querySelectorAll("button.mode-btn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("active", btns[i].getAttribute("data-value") === value);
    }
  }

  function syncFreqUIBlock(block, value) {
    if (!block) return;
    var btns = block.querySelectorAll(".freq-btn");
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("active", btns[i].dataset.freq === value);
  }
}

/* ===== EVENT EDITOR ===== */

// OPTIMIZATION: DOM cache для event editor (часто открывается).
var eventEditorOverlay = getEl("eventEditorOverlay");
var eventEditorSheet = getEl("eventEditorSheet");
var eventTypeToggle = getEl("eventTypeToggle");
var eventAmountInput = getEl("eventAmount");
var eventDateInput = getEl("eventDate");
var eventSubmitBtn = getEl("eventSubmit");

var selectedEventType = "income";

// NEW: shared helper - which sides are currently in periodic ("fixed") mode.
function getFixedSides() {
  var st = (typeof getState === "function") ? getState() : {};
  return {
    income:  (st.incomeType  || "fixed") === "fixed",
    expense: (st.expenseType || "fixed") === "fixed"
  };
}

// FINANCIAL EVENTS - INCOME ONLY - функция оставлена для обратной совместимости
// со сторонними вызовами, но больше не блокирует ничего: блок принимает только
// разовый доход, поэтому previousий механизм disabled-toggle (по фиксированности
// сторон) перестал быть актуальным. Toggle типа скрыт через display:none в HTML.
function syncEventEditorTypeAvailability() {
  if (eventTypeToggle) eventTypeToggle.style.display = "none";
  var hintEl = document.getElementById("eventEditorLockedHint");
  if (hintEl) hintEl.style.display = "none";
  if (eventSubmitBtn) eventSubmitBtn.disabled = false;
  if (eventAmountInput) eventAmountInput.disabled = false;
}

function openEventEditor() {
  // FINANCIAL EVENTS - INCOME ONLY - модалка всегда фиксирована на типе "income".
  // Прежний выбор default-стороны (income/expense) убран: блок «+ Добавить доход»
  // создаёт только разовые непредсказуемые доходы. Расходы пишутся через
  // отдельный «Непредвиденный расход» на экране с графиком.
  selectedEventType = "income";
  if (eventTypeToggle) syncEventTypeUI("income");
  if (eventAmountInput) {
    eventAmountInput.value = "";
    eventAmountInput.disabled = false;
  }
  if (eventDateInput) {
    var today = new Date();
    eventDateInput.value = today.toISOString().slice(0, 10);
  }
  syncEventEditorTypeAvailability();
  // FINANCIAL EVENTS - INCOME ONLY - submit-кнопка активна, если income сторона
  // в variable-режиме. Если income в fixed - это означает «доход настраивается
  // централизованно фиксированной суммой», но разовый непредсказуемый доход
  // мы всё равно разрешаем добавить (это не дублирует периодическое поступление).
  // Поэтому submit включен ВСЕГДА в новом INCOME-ONLY режиме.
  if (eventSubmitBtn) eventSubmitBtn.disabled = false;
  if (eventAmountInput) eventAmountInput.disabled = false;
  ProtoSheet.open(eventEditorSheet, eventEditorOverlay);
}

function constrainEventDateInputWidth() {}
function onEventEditorResize() {}

function closeEventEditor() {
  ProtoSheet.close(eventEditorSheet, eventEditorOverlay);
}

function syncEventTypeUI(value) {
  if (!eventTypeToggle) return;
  var btns = eventTypeToggle.querySelectorAll(".mode-btn");
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("active", btns[i].dataset.value === value);
}

if (eventTypeToggle) {
  eventTypeToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".mode-btn");
    if (!btn) return;
    // NEW: locked side button → toast hint, no selection change.
    if (btn.disabled || btn.classList.contains("mode-btn--locked")) {
      haptic("error");
      if (typeof showToast === "function") {
        showToast(t("flex.events.disabledHint"), "info");
      }
      return;
    }
    haptic("light");
    selectedEventType = btn.dataset.value;
    syncEventTypeUI(selectedEventType);
  });
}

if (eventEditorOverlay) {
  eventEditorOverlay.addEventListener("click", function () { closeEventEditor(); });
}
ProtoSheet.initSwipe(eventEditorSheet, closeEventEditor);

window.addEventListener("resize", onEventEditorResize);
window.addEventListener("orientationchange", function () { setTimeout(onEventEditorResize, 100); });
if (typeof window !== "undefined" && window.visualViewport) {
  window.visualViewport.addEventListener("resize", onEventEditorResize);
}

if (eventSubmitBtn) {
  eventSubmitBtn.addEventListener("click", function () {
    // FINANCIAL EVENTS - INCOME ONLY - submit-обработчик упрощён до одного
    // сценария: разовый непредсказуемый доход. Все expense-ветви удалены,
    // selectedEventType жёстко = "income". Если в будущем понадобится снова
    // разрешить расход через этот блок - достаточно вернуть toggle в HTML.
    var rawAmount = parseNumber(eventAmountInput?.value || "0");
    if (!rawAmount) {
      haptic("error");
      if (eventAmountInput) {
        eventAmountInput.classList.add("error", "shake");
        setTimeout(function () { eventAmountInput.classList.remove("error", "shake"); }, 400);
      }
      return;
    }

    var dateVal = eventDateInput?.value;
    var eventDate = dateVal ? new Date(dateVal) : new Date();
    if (isNaN(eventDate.getTime())) eventDate = new Date();

    var H = CashflowEngineHelpers;
    var s = getState();

    // FINANCIAL EVENTS - INCOME ONLY - пишем разовый INCOME-event.
    //   • frequency: ONCE - один раз, без авто-повторения. Это ключевое отличие
    //     от регулярных доходов (weekly / biweekly / monthly), которые задаются
    //     в блоках Income/Expenses выше через единую модалку «Записать
    //     поступление» (UNIFIED PERIODIC FLOW).
    //   • meta.userCreated = true - engine отличит «ручной разовый» от
    //     сгенерированного периодического и не задвоит его в прогнозе.
    //   • meta.kind = "unpredictable-income" - семантический маркер для будущих
    //     фильтров истории и аналитики (например, статистики «премий за год»).
    var meta = { userCreated: true, kind: "unpredictable-income" };
    var normalized = H.normalizeEvent({
      type: H.EVENT_TYPE.INCOME,
      amount: rawAmount,
      frequency: H.FREQUENCY ? H.FREQUENCY.ONCE : "once",
      startDate: eventDate,
      meta: meta
    });
    var evts = s.cashflowEvents || [];
    evts.push(normalized);
    updateState({ cashflowEvents: evts });

    // FINANCIAL EVENTS - INCOME ONLY - фиксируем доход в factHistory, чтобы он
    // сразу отразился в графике баланса / accounts.main (положительное
    // движение). Это поведение симметрично «Непредвиденному расходу», который
    // пишет отрицательное движение в ту же факт-историю.
    var realTimestamp = new Date().toISOString();
    var periodDate = new Date(eventDate);
    periodDate.setDate(1);
    periodDate.setHours(0, 0, 0, 0);
    if (typeof factHistory !== "undefined" && Array.isArray(factHistory)) {
      factHistory.push({
        value: rawAmount,
        date: periodDate,
        to: "main",
        timestamp: realTimestamp
      });
    }
    if (typeof accounts !== "undefined" && accounts) {
      accounts.main = (Number(accounts.main) || 0) + rawAmount;
    }

    haptic("success");
    closeEventEditor();
    recalcPlan();
    showToast(t("event.incomeAdded"), "success");
  });
}

if (eventAmountInput) {
  eventAmountInput.addEventListener("input", function (e) {
    e.target.value = formatNumber(e.target.value);
  });
}

initCashflowSettings();

/* ============================================================================
 * CUSTOM SCHEDULE LOGIC - ручной ввод «Свой график»
 * ----------------------------------------------------------------------------
 * Полная замена прежнего picker-а дней месяца. Когда пользователь выбирает
 * частоту "custom" в гибкой модели (на income или expense стороне), вместо
 * автоматического периодического события используется ручной журнал записей:
 *
 *   state.customScheduleEntries: Array<{
 *     id, side: "income"|"expense",
 *     amount: number,
 *     date: "YYYY-MM-DD",
 *     deposited: number,       // сколько реально ушло в накопления (income)
 *     depositedAt: ISO|null,
 *     createdAt: ISO
 *   }>
 *
 * Поток:
 *   1) Клик «+ Записать поступление / расход» → открывается двухшаговая sheet:
 *      step "form"  - сумма + дата (+ подсказка).
 *      step "alloc" - крупно «Нужно отложить: X ₽» + кнопки «Отложить» /
 *                     «Только записать». Шаг alloc - ТОЛЬКО для income.
 *   2) После отложения дохода:
 *      • factHistory получает запись (как обычный взнос пользователя)
 *      • accounts.main += deposited
 *      • выставляется sticky-флаг customScheduleExpensePrompt → reminder card
 *        «Теперь введите расходы за этот период».
 *   3) История рендерится прямо под кнопкой ввода (edit/delete inline).
 *   4) Примерный срок до цели = remaining / (avg amount × PACE_MAP[saveMode]).
 *      Если записей <2 → «недостаточно данных».
 *
 * Все события engine получает через assembleCashflowEvents() как one-time
 * INCOME/EXPENSE c meta.userCreated:true - это совместимо с forecast-логикой
 * cashflow-engine.js (см. _getForecastFromEvents).
 * ============================================================================ */

(function () {
  "use strict";

  var PACE = (typeof CashflowEngineHelpers !== "undefined" && CashflowEngineHelpers.PACE_MAP)
    ? CashflowEngineHelpers.PACE_MAP
    : { calm: 0.4, normal: 0.6, aggressive: 0.8 };

  // ── DOM cache ─────────────────────────────────────────────────────────────
  var sheet = document.getElementById("customScheduleSheet");
  var overlay = document.getElementById("customScheduleOverlay");
  var stepForm = sheet ? sheet.querySelector('[data-cs-step="form"]') : null;
  var stepAlloc = sheet ? sheet.querySelector('[data-cs-step="alloc"]') : null;
  var titleEl = document.getElementById("csSheetTitle");
  var modeBadgeEl = document.getElementById("csModeBadge");
  var amountLabelEl = document.getElementById("csAmountLabel");
  var amountHintEl = document.getElementById("csAmountHint");
  var amountInput = document.getElementById("csAmountInput");
  var dateInput = document.getElementById("csDateInput");
  var continueBtn = document.getElementById("csContinueBtn");
  var allocAmountEl = document.getElementById("csAllocAmount");
  var allocBaseEl = document.getElementById("csAllocBase");
  var depositBtn = document.getElementById("csDepositBtn");
  var skipDepositBtn = document.getElementById("csSkipDepositBtn");
  // UNIFIED CUSTOM SCHEDULE FLOW - DOM-узлы для live-preview и бейджа периодичности.
  var livePreviewEl = document.getElementById("csLivePreview");
  var livePreviewAmountEl = document.getElementById("csLivePreviewAmount");
  var livePreviewModeEl = document.getElementById("csLivePreviewMode");
  var nextOccurrenceEl = document.getElementById("csNextOccurrence");

  // CUSTOM SCHEDULE LOGIC - текущий контекст модалки (закрыта по умолчанию).
  // editId !== null → режим редактирования существующей записи; шаг alloc пропускаем.
  // UNIFIED CUSTOM SCHEDULE FLOW - добавлено поле `frequency` (weekly / biweekly /
  // monthly / custom) - определяется по кнопке периодичности, открывшей модалку.
  var ctx = {
    side: "income",
    editId: null,
    pendingDeposit: 0,
    baseAmount: 0,
    entryDate: "",
    frequency: "custom",
    // CONFIGURE vs RECORD режим. configure=true открывается из кнопок
    // периодичности гибкой модели и НАСТРАИВАЕТ прогноз (сумма + частота),
    // без записи факта и без отложения. record (default) - запись факта
    // + авто-отложение (кнопки на графике, «+ Записать», reminder'ы).
    configure: false,
    prevAmount: 0,
    prevFreq: ""
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _genId() {
    return "cs_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  function _todayIso() {
    return (new Date()).toISOString().slice(0, 10);
  }

  function _entries() {
    var s = (typeof getState === "function") ? getState() : {};
    return Array.isArray(s.customScheduleEntries) ? s.customScheduleEntries.slice() : [];
  }

  function _entriesBySide(side) {
    return _entries().filter(function (e) { return e && e.side === side; });
  }

  function _persist(entries) {
    if (typeof updateState !== "function") return;
    updateState({ customScheduleEntries: entries });
    if (typeof saveFullState === "function") saveFullState();
  }

  function _currentSaveMode() {
    var s = (typeof getState === "function") ? getState() : {};
    return (s.saveMode || (typeof saveMode !== "undefined" ? saveMode : "calm")) || "calm";
  }

  function _paceFraction() {
    var m = _currentSaveMode();
    return (PACE[m] != null) ? PACE[m] : 0.6;
  }

  // FIX: custom schedule accumulation + counters update ─────────────────────
  // Сумма всех ручных вводов для одной стороны (income | expense).
  // Заменяет «последняя запись» - теперь работаем с накопленным итогом периода.
  function _periodTotal(side) {
    return _entriesBySide(side).reduce(function (sum, e) {
      return sum + (Number(e.amount) || 0);
    }, 0);
  }

  // FIX: custom schedule accumulation + counters update - суммарно отложено
  // по всем записям (поле entry.deposited; expense-записи всегда 0 - туда
  // отложения не записываются, см. _commitDeposit).
  function _alreadyDepositedTotal() {
    return _entries().reduce(function (sum, e) {
      return sum + (Number(e.deposited) || 0);
    }, 0);
  }

  // FIX: custom schedule accumulation + counters update - counterpart другой
  // стороны. Для custom-стороны возвращаем СУММУ всех записей (а не последнюю),
  // что критично для корректного расчёта «Нужно отложить» при нескольких
  // ручных вводах в одном периоде.
  //   forSide="income"  → counterpart = expense сумма
  //   forSide="expense" → counterpart = income сумма
  // Возвращает { amount, kind } где kind ∈
  //   "fixed" | "variablePeriodic" | "customTotal" | "none"
  function _counterpartMonthly(forSide) {
    var s = (typeof getState === "function") ? getState() : {};
    var otherSide = forSide === "income" ? "expense" : "income";
    var typeKey = otherSide + "Type";
    var freqKey = otherSide + "Frequency";
    var simpleField = otherSide === "income" ? "income" : "expenses";
    var varField = otherSide === "income" ? "fixedIncomeAmount" : "fixedExpenseAmount";
    var type = s[typeKey] || "fixed";
    var freq = s[freqKey] || "monthly";
    var parser = (typeof parseFlexAmount === "function") ? parseFlexAmount : Number;

    if (type === "fixed") {
      var fixedAmt = parser(s[simpleField]);
      return { amount: fixedAmt > 0 ? fixedAmt : 0, kind: fixedAmt > 0 ? "fixed" : "none" };
    }
    // variable + freq="custom" → сумма всех ручных записей этой стороны.
    if (freq === "custom") {
      var sumCustom = _periodTotal(otherSide);
      return { amount: sumCustom, kind: sumCustom > 0 ? "customTotal" : "none" };
    }
    var vAmt = parser(s[varField]);
    return { amount: vAmt > 0 ? vAmt : 0, kind: vAmt > 0 ? "variablePeriodic" : "none" };
  }

  // FIX: custom schedule accumulation + counters update - главный калькулятор
  // отложения. Параметр amount сохранён для backward-compat, но игнорируется:
  // расчёт идёт от АККУМУЛИРОВАННЫХ сумм за период (всех income- и expense-
  // ручных вводов плюс фикс. counterpart при варьирующемся типе).
  //
  // Возвращает богатую структуру:
  //   {
  //     deposit:           pending = max(0, target - already)   ← что докинуть СЕЙЧАС
  //     targetDeposit:     free × pace                          ← сколько ВСЕГО надо
  //     alreadyDeposited:  Σ entry.deposited                    ← сколько уже сделано
  //     totalIncome:       income side total (custom sum или фикс)
  //     totalExpense:      expense side total (custom sum или фикс)
  //     free:              max(0, totalIncome − totalExpense)
  //     counterpart:       { amount, kind } - для UI-текста «учтено …»
  //   }
  function _computeDepositForEntry(side, entryAmount) {
    var s = (typeof getState === "function") ? getState() : {};

    // UNIFIED CUSTOM SCHEDULE FLOW - per-entry расчёт для non-custom freq.
    // Когда пользователь записывает поступление через единую модалку с частотой
    // weekly / biweekly / monthly, каждое поступление - самостоятельное событие,
    // и его deposit должен считаться независимо: deposit = amount × pace.
    // Аккумулировать его с фикс. monthly counterpart'ом некорректно (дало бы
    // deposit=0 при первой weekly-записи на фоне monthly expense).
    // Для freq=custom оставляем прежнюю v3-логику accumulated-расчёта ниже.
    if (entryAmount != null) {
      var sideKey0 = (side === "expense") ? "expense" : "income";
      var sideFreq0 = s[sideKey0 + "Frequency"] || "monthly";
      if (sideFreq0 !== "custom") {
        var amt0 = Number(entryAmount) || 0;
        // pay-yourself-first: фиксированный % от каждого поступления идёт на цель,
        // вне зависимости от counterpart (расходов). Cash-flow engine учитывает
        // counterpart отдельно при построении прогноза.
        var depPerEntry = Math.max(0, Math.round(amt0 * _paceFraction()));
        return {
          deposit: depPerEntry,
          targetDeposit: depPerEntry,
          alreadyDeposited: 0,
          totalIncome: sideKey0 === "income" ? amt0 : 0,
          totalExpense: sideKey0 === "expense" ? amt0 : 0,
          free: sideKey0 === "income" ? amt0 : 0,
          counterpart: { amount: 0, kind: "none" },
          __mode: "perEntry",
          __frequency: sideFreq0
        };
      }
    }

    var incomeIsCustom = (s.incomeType === "variable") && ((s.incomeFrequency || "monthly") === "custom");
    var expenseIsCustom = (s.expenseType === "variable") && ((s.expenseFrequency || "monthly") === "custom");

    var parser = (typeof parseFlexAmount === "function") ? parseFlexAmount : Number;

    var totalIncome, incomeKind;
    if (incomeIsCustom) {
      totalIncome = _periodTotal("income");
      incomeKind = totalIncome > 0 ? "customTotal" : "none";
    } else {
      var iType = s.incomeType || "fixed";
      if (iType === "fixed") {
        totalIncome = parser(s.income);
        incomeKind = totalIncome > 0 ? "fixed" : "none";
      } else {
        totalIncome = parser(s.fixedIncomeAmount);
        incomeKind = totalIncome > 0 ? "variablePeriodic" : "none";
      }
    }

    var totalExpense, expenseKind;
    if (expenseIsCustom) {
      totalExpense = _periodTotal("expense");
      expenseKind = totalExpense > 0 ? "customTotal" : "none";
    } else {
      var eType = s.expenseType || "fixed";
      if (eType === "fixed") {
        totalExpense = parser(s.expenses);
        expenseKind = totalExpense > 0 ? "fixed" : "none";
      } else {
        totalExpense = parser(s.fixedExpenseAmount);
        expenseKind = totalExpense > 0 ? "variablePeriodic" : "none";
      }
    }

    var free = Math.max(0, totalIncome - totalExpense);
    var targetDeposit = Math.round(free * _paceFraction());
    var alreadyDeposited = _alreadyDepositedTotal();
    var pendingDeposit = Math.max(0, targetDeposit - alreadyDeposited);

    // Для совместимости - какой counterpart актуален для side="income"|"expense".
    // (Используется в UI-подсказке «учтён ...».) Берём ту сторону, которая ВЫЧИТАЕТСЯ.
    var arg = arguments[0];
    var side = (arg === "expense") ? "expense" : "income";
    var counterpart = side === "income"
      ? { amount: totalExpense, kind: expenseKind }
      : { amount: totalIncome,  kind: incomeKind };

    return {
      deposit: pendingDeposit,
      targetDeposit: targetDeposit,
      alreadyDeposited: alreadyDeposited,
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      free: free,
      counterpart: counterpart
    };
  }

  function _modeLabel() {
    return t("cs.mode." + _currentSaveMode());
  }

  function _amount(n) {
    return (typeof fmtAmount === "function") ? fmtAmount(n) : String(Math.round(n));
  }

  function _formatHumanDate(iso) {
    if (!iso) return "-";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var day = d.getDate();
    var monGen = (typeof getMonthNameGenitive === "function") ? getMonthNameGenitive(d.getMonth()) : (d.getMonth() + 1);
    var y = d.getFullYear();
    return day + " " + monGen + " " + y;
  }

  // ── ETA ───────────────────────────────────────────────────────────────────
  // CUSTOM SCHEDULE v2 - fix main plan display - примерный срок до цели на
  // основе средних ручных вводов с УЧЁТОМ counterpart-стороны:
  //   monthlySave = max(0, avg_income - avg_expense_or_fixed) × pace.
  // Если по income стороне <2 записей → недостаточно данных.
  function _computeEta() {
    var incomes = _entriesBySide("income");
    var expenses = _entriesBySide("expense");

    // Источник avg_income: либо custom-журнал, либо фикс.
    var s = (typeof getState === "function") ? getState() : {};
    var incomeIsCustom = (s.incomeType === "variable") && ((s.incomeFrequency || "monthly") === "custom");
    var expenseIsCustom = (s.expenseType === "variable") && ((s.expenseFrequency || "monthly") === "custom");

    var avgIncome = 0;
    if (incomeIsCustom) {
      if (incomes.length < 2) return null;
      var sortedI = incomes.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      var sampleI = sortedI.slice(0, Math.min(3, sortedI.length));
      for (var i = 0; i < sampleI.length; i++) avgIncome += (Number(sampleI[i].amount) || 0);
      avgIncome = avgIncome / sampleI.length;
    } else {
      var cpInc = _counterpartMonthly("expense"); // counterpart of expense = income side
      avgIncome = cpInc.amount;
    }

    var avgExpense = 0;
    if (expenseIsCustom) {
      if (expenses.length > 0) {
        var sortedE = expenses.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
        var sampleE = sortedE.slice(0, Math.min(3, sortedE.length));
        for (var k = 0; k < sampleE.length; k++) avgExpense += (Number(sampleE[k].amount) || 0);
        avgExpense = avgExpense / sampleE.length;
      }
    } else {
      var cpExp = _counterpartMonthly("income"); // counterpart of income = expense side
      avgExpense = cpExp.amount;
    }

    var freeMonthly = Math.max(0, avgIncome - avgExpense);
    var monthlyEffective = freeMonthly * _paceFraction();
    if (monthlyEffective <= 0) return null;

    var goalVal = 0;
    try {
      var gi = document.getElementById("goal");
      goalVal = gi ? (typeof parseNumber === "function" ? parseNumber(gi.value || "0") : Number(gi.value) || 0) : 0;
    } catch (e) { goalVal = 0; }
    var savedVal = (typeof accounts !== "undefined" && accounts && accounts.main) ? accounts.main : 0;
    var remaining = Math.max(0, goalVal - savedVal);
    if (remaining <= 0) return null;

    return Math.ceil(remaining / monthlyEffective);
  }

  // ── Summary card ──────────────────────────────────────────────────────────

  // FIX: custom schedule accumulation + counters update - summary в cs-блоке
  // (под кнопкой «+ Записать») теперь показывает АККУМУЛИРОВАННЫЕ значения:
  //   • «Накоплено» - Σ entry.amount для этой стороны
  //   • «Отложено» (для income) - Σ entry.deposited
  //   • «Срок» - ETA
  function _renderSummary(side) {
    var summaryId = side === "income" ? "incomeCsSummary" : "expenseCsSummary";
    var el = document.getElementById(summaryId);
    if (!el) return;

    var entries = _entriesBySide(side);
    if (!entries.length) {
      el.className = "cs-summary cs-summary--empty";
      el.innerHTML = "<span>" + t("cs.summary.empty." + side) + "</span>";
      return;
    }

    var totalAmt = _periodTotal(side);
    // Σ entry.deposited по этой же стороне (для expense всегда 0).
    var depositedSide = entries.reduce(function (sum, e) {
      return sum + (Number(e.deposited) || 0);
    }, 0);

    var html = "";
    html += '<div class="cs-summary-row cs-summary-row--primary">';
    html += '<span>' + t("cs.summary.total." + side) + '</span>';
    html += '<b>' + _amount(totalAmt) + '</b>';
    html += '</div>';

    if (side === "income") {
      html += '<div class="cs-summary-row">';
      html += '<span>' + t("cs.summary.deposited") + '</span>';
      html += '<b>' + (depositedSide > 0 ? _amount(depositedSide) : '-') + '</b>';
      html += '</div>';

      // ETA - только для income.
      var eta = _computeEta();
      if (eta == null) {
        html += '<div class="cs-summary-eta cs-summary-eta--insufficient">';
        html += '<span>' + t("cs.summary.eta") + '</span>';
        html += '<b>' + t("cs.summary.eta.insufficient") + '</b>';
        html += '</div>';
      } else {
        html += '<div class="cs-summary-eta">';
        html += '<span>' + t("cs.summary.eta") + '</span>';
        html += '<b>' + t("cs.summary.eta.months", { n: eta }) + '</b>';
        html += '</div>';
      }
    }

    el.className = "cs-summary";
    el.innerHTML = html;
  }

  // ── History list ──────────────────────────────────────────────────────────

  function _renderHistory(side) {
    var listId = side === "income" ? "incomeCsHistory" : "expenseCsHistory";
    var listEl = document.getElementById(listId);
    if (!listEl) return;

    var entries = _entriesBySide(side).slice().sort(function (a, b) {
      // Сортируем по date desc, при равной дате - по createdAt desc.
      var dCmp = String(b.date).localeCompare(String(a.date));
      if (dCmp !== 0) return dCmp;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });

    if (!entries.length) {
      listEl.innerHTML = '<div class="cs-history-empty">' + t("cs.history.empty") + '</div>';
      return;
    }

    var html = "";
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var amt = Number(e.amount) || 0;
      var dep = Number(e.deposited) || 0;
      var itemCls = "cs-history-item" + (side === "expense" ? " cs-history-item--expense" : "");
      var amtCls = "cs-history-item-amount" + (side === "expense" ? " cs-history-item-amount--expense" : "");

      html += '<div class="' + itemCls + '" data-cs-id="' + e.id + '">';
      html +=   '<div class="cs-history-item-main">';
      html +=     '<div class="' + amtCls + '">' + (side === "expense" ? "−" : "") + _amount(amt) + '</div>';
      html +=     '<div class="cs-history-item-date">' + _formatHumanDate(e.date) + '</div>';
      html +=   '</div>';

      if (side === "income") {
        if (dep > 0) {
          html += '<div class="cs-history-item-badge">' + t("cs.history.deposited.badge", { amount: _amount(dep) }) + '</div>';
        } else {
          html += '<div class="cs-history-item-badge cs-history-item-badge--none">' + t("cs.history.notDeposited.badge") + '</div>';
        }
      }

      html += '<div class="cs-history-item-actions">';
      // Кнопка «Отложить» - только для income, не отложенных ранее записей.
      if (side === "income" && dep <= 0) {
        html += '<button type="button" class="cs-history-icon-btn cs-history-icon-btn--deposit" data-cs-action="deposit" data-cs-id="' + e.id + '" title="' + t("cs.history.deposit") + '">↑</button>';
      }
      html += '<button type="button" class="cs-history-icon-btn" data-cs-action="edit" data-cs-id="' + e.id + '" title="' + t("cs.history.edit") + '">✎</button>';
      html += '<button type="button" class="cs-history-icon-btn cs-history-icon-btn--delete" data-cs-action="delete" data-cs-id="' + e.id + '" title="' + t("cs.history.delete") + '">🗑</button>';
      html += '</div>';
      html += '</div>';
    }
    listEl.innerHTML = html;
  }

  // ── Expense reminder (sticky-card после income deposit) ───────────────────

  // CUSTOM SCHEDULE v2 - fix main plan display - обе reminder-карточки.
  function _renderExpenseReminder() {
    var expCard = document.getElementById("csExpenseReminder");
    var incCard = document.getElementById("csIncomeReminder");
    var s = (typeof getState === "function") ? getState() : {};
    if (expCard) expCard.style.display = s.customScheduleExpensePrompt ? "flex" : "none";
    if (incCard) incCard.style.display = s.customScheduleIncomePrompt ? "flex" : "none";
  }

  function _setExpensePrompt(active) {
    if (typeof updateState !== "function") return;
    updateState({ customScheduleExpensePrompt: !!active });
    _renderExpenseReminder();
  }

  // CUSTOM SCHEDULE v2 - fix main plan display - зеркальный сеттер для income-prompt.
  function _setIncomePrompt(active) {
    if (typeof updateState !== "function") return;
    updateState({ customScheduleIncomePrompt: !!active });
    _renderExpenseReminder();
  }

  // ── Public render ─────────────────────────────────────────────────────────

  function renderCustomSchedule(side) {
    if (side === "income" || side === "expense") {
      _renderSummary(side);
      _renderHistory(side);
      if (side === "income") _renderExpenseReminder();
      return;
    }
    // Без аргумента - рендерим обе стороны.
    _renderSummary("income");
    _renderHistory("income");
    _renderSummary("expense");
    _renderHistory("expense");
    _renderExpenseReminder();
  }

  // ── Sheet open / close ────────────────────────────────────────────────────

  function _showStep(step) {
    if (stepForm) stepForm.style.display = step === "form" ? "" : "none";
    if (stepAlloc) stepAlloc.style.display = step === "alloc" ? "" : "none";
  }

  // UNIFIED CUSTOM SCHEDULE FLOW - applySheetTextsForSide(side, isEdit, freq).
  // freq влияет на заголовок модалки, подсказку под полем суммы и бейдж
  // «дальше - каждую неделю / две недели / месяц / вручную». Кнопка primary
  // унифицирована: для income всегда «Отложить на цель», для expense - «Сохранить
  // запись»; для редактирования - «Сохранить».
  function _applySheetTextsForSide(side, isEdit, freq, configure) {
    var freqKey = freq || "custom";

    if (titleEl) {
      if (isEdit) {
        titleEl.textContent = t("cs.modal.title.edit." + side);
      } else if (configure) {
        // CONFIGURE-режим: «Настроить доход / расход».
        titleEl.textContent = t("cs.modal.configTitle." + side);
      } else {
        // Сначала пробуем freq-aware ключ, потом фолбэк на общий.
        var tFreq = t("cs.modal.title." + side + "." + freqKey);
        var tFallback = t("cs.modal.title." + side);
        var hasFreqTitle = tFreq && tFreq !== ("cs.modal.title." + side + "." + freqKey);
        titleEl.textContent = hasFreqTitle ? tFreq : tFallback;
      }
    }
    if (amountLabelEl) amountLabelEl.textContent = t("cs.field.amount." + side);
    if (amountHintEl) {
      if (configure) {
        // CONFIGURE-режим: подсказка про настройку прогноза (не запись факта).
        amountHintEl.textContent = t("cs.modal.configHint." + side);
      } else {
        // Динамическая подсказка - главное визуальное отличие при разных freq.
        var hintKey = "cs.field.amountHint." + side + "." + freqKey;
        var hintTr = t(hintKey);
        var hintFallback = t("cs.field.amountHint." + side);
        amountHintEl.textContent = (hintTr && hintTr !== hintKey) ? hintTr : hintFallback;
      }
    }
    if (modeBadgeEl) {
      modeBadgeEl.textContent = _modeLabel();
      // В configure-режиме отложения нет - бейдж режима не показываем.
      modeBadgeEl.style.display = (side === "income" && !configure) ? "" : "none";
    }
    if (nextOccurrenceEl) {
      // Скрываем бейдж в режиме редактирования (это не первая настройка).
      if (isEdit) {
        nextOccurrenceEl.style.display = "none";
      } else {
        var nextKey = "cs.modal.nextOccurrence." + freqKey;
        var nextTr = t(nextKey);
        nextOccurrenceEl.textContent = (nextTr && nextTr !== nextKey) ? nextTr : "";
        nextOccurrenceEl.style.display = nextOccurrenceEl.textContent ? "" : "none";
      }
    }
    if (continueBtn) {
      if (isEdit) {
        continueBtn.textContent = t("cs.modal.save");
      } else if (configure) {
        // CONFIGURE-режим: настраиваем план, не откладываем.
        continueBtn.textContent = t("cs.modal.configBtn");
      } else if (side === "income") {
        // Single-step flow - главная кнопка сразу «Отложить на цель».
        continueBtn.textContent = t("cs.alloc.depositBtn");
      } else {
        // Расход не отлагается - просто фиксируем запись.
        continueBtn.textContent = t("cs.modal.save");
      }
    }
  }

  // UNIFIED CUSTOM SCHEDULE FLOW - live-preview расчёт «сколько уйдёт на цель».
  // Обновляется на каждый input в поле «Сумма поступления». Для side="income"
  // показывает блок с deposit-суммой; для expense - скрывает блок (расход не идёт
  // на цель напрямую).
  function _updateLivePreview() {
    if (!livePreviewEl) return;
    var isExpense = ctx.side === "expense";
    var isEdit = !!ctx.editId;

    // Для expense, режима редактирования и configure-режима прячем preview
    // (в configure деньги не откладываются - превью «уйдёт на цель» неуместно).
    if (isExpense || isEdit || ctx.configure) {
      livePreviewEl.style.display = "none";
      return;
    }

    var raw = (typeof parseNumber === "function")
      ? parseNumber(amountInput ? amountInput.value : "0")
      : Number(amountInput && amountInput.value || 0);
    if (!raw || raw <= 0) {
      livePreviewEl.style.display = "none";
      return;
    }

    // Вычисляем deposit ОТ ВВЕДЁННОЙ суммы. Для freq!=custom - per-entry режим
    // (deposit = amount × pace). Для freq=custom - accumulated режим (с учётом
    // уже накопленных entries; live-preview показывает «что будет после этого ввода»).
    var calc;
    if (ctx.frequency === "custom") {
      // Имитация: что станет с pending, если добавим эту запись. Для упрощения
      // показываем «было бы accumulated pending + amount × pace», но это путаница.
      // Просто берём текущий pending + amount × pace потенциально нового.
      // Проще: показать amount × pace как ориентир (даже в custom режиме это honest).
      var dep = Math.max(0, Math.round(raw * _paceFraction()));
      calc = { deposit: dep, targetDeposit: dep };
    } else {
      calc = _computeDepositForEntry("income", raw);
    }

    if (livePreviewAmountEl) {
      livePreviewAmountEl.textContent = (typeof fmtAmount === "function")
        ? fmtAmount(calc.deposit)
        : String(calc.deposit);
    }
    if (livePreviewModeEl) {
      var modeName = t("cs.mode." + _currentSaveMode())
        .replace(/^Режим:\s*/i, "")
        .replace(/^Mode:\s*/i, "");
      livePreviewModeEl.textContent = t("cs.preview.modeHint", { mode: modeName });
    }
    livePreviewEl.style.display = "";
  }

  // UNIFIED CUSTOM SCHEDULE FLOW - openCustomScheduleSheet(side, opts) теперь
  // принимает opts.frequency для динамической подсказки и заголовка. Если freq
  // не передан явно, берём из state (incomeFrequency / expenseFrequency).
  function openCustomScheduleSheet(side, opts) {
    if (!sheet) return;
    opts = opts || {};
    var isEdit = !!opts.editId;
    ctx.side = side === "expense" ? "expense" : "income";
    ctx.editId = opts.editId || null;
    ctx.pendingDeposit = 0;
    ctx.baseAmount = 0;
    ctx.entryDate = "";
    // CONFIGURE-режим: меняем только прогноз (без факта/отложения).
    ctx.configure = !!opts.configure;
    ctx.prevAmount = Number(opts.prevAmount) || 0;
    ctx.prevFreq = opts.prevFreq || "";

    // Определяем frequency: явный opts.frequency > текущий state > "custom" как safe default.
    var _s = (typeof getState === "function") ? getState() : {};
    var stateFreq = ctx.side === "income"
      ? (_s.incomeFrequency || "monthly")
      : (_s.expenseFrequency || "monthly");
    ctx.frequency = opts.frequency || stateFreq || "custom";

    _applySheetTextsForSide(ctx.side, isEdit, ctx.frequency, ctx.configure);
    _showStep("form");

    // Заполняем поля. Для редактирования - текущие значения, иначе чистая форма.
    if (isEdit) {
      var existing = _entries().filter(function (e) { return e.id === ctx.editId; })[0];
      if (existing) {
        if (amountInput) amountInput.value = (typeof formatNumber === "function")
          ? formatNumber(String(existing.amount || 0))
          : String(existing.amount || 0);
        if (dateInput) dateInput.value = existing.date || _todayIso();
      }
    } else {
      if (amountInput) amountInput.value = "";
      if (dateInput) dateInput.value = _todayIso();
    }

    // UNIFIED CUSTOM SCHEDULE FLOW - обновляем live-preview по начальному значению
    // (для edit-режима покажет amount × pace; для нового ввода - скрыт до ввода суммы).
    _updateLivePreview();

    if (typeof ProtoSheet !== "undefined") ProtoSheet.open(sheet, overlay);
  }

  function closeCustomScheduleSheet() {
    if (typeof ProtoSheet !== "undefined") ProtoSheet.close(sheet, overlay);
  }

  // ── Save / commit deposit ─────────────────────────────────────────────────

  // CUSTOM SCHEDULE LOGIC - добавление новой записи в журнал.
  function _addEntry(side, amount, dateIso) {
    var arr = _entries();
    var entry = {
      id: _genId(),
      side: side,
      amount: amount,
      date: dateIso || _todayIso(),
      deposited: 0,
      depositedAt: null,
      createdAt: (new Date()).toISOString()
    };
    arr.push(entry);
    _persist(arr);
    return entry;
  }

  // CUSTOM SCHEDULE LOGIC - обновление amount/date существующей записи.
  // Намеренно НЕ трогаем `deposited`: если пользователь уже отложил по этой
  // записи, его реальный взнос остаётся в factHistory неизменным.
  function _updateEntry(id, amount, dateIso) {
    var arr = _entries();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        arr[i].amount = amount;
        arr[i].date = dateIso || arr[i].date || _todayIso();
        break;
      }
    }
    _persist(arr);
  }

  // CUSTOM SCHEDULE LOGIC - удаление записи из истории.
  // factHistory НЕ откатываем: уже отложенные деньги остаются на счёте, чтобы
  // не создавать резких просадок баланса при чистке истории.
  function _deleteEntry(id) {
    var arr = _entries().filter(function (e) { return e.id !== id; });
    _persist(arr);
  }

  // CUSTOM SCHEDULE LOGIC - отложить взнос на цель по конкретной записи.
  // Использует тот же канал, что и обычные взносы пользователя:
  //   factHistory.push({ value, date, to: "main", timestamp })
  // + accounts.main += amount. Это даёт корректное отображение в графике,
  // в истории операций и в derived balance движка.
  function _commitDeposit(entry, depositAmount) {
    if (!entry || depositAmount <= 0) return;
    var realTimestamp = (new Date()).toISOString();
    var d = entry.date ? new Date(entry.date) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    // factHistory ожидает 1-е число месяца (см. deserializeFactHistory).
    var periodDate = new Date(d);
    periodDate.setDate(1);
    periodDate.setHours(0, 0, 0, 0);

    if (typeof factHistory !== "undefined" && Array.isArray(factHistory)) {
      factHistory.push({
        value: depositAmount,
        date: periodDate,
        to: "main",
        timestamp: realTimestamp
      });
    }
    if (typeof accounts !== "undefined" && accounts) {
      accounts.main = (Number(accounts.main) || 0) + depositAmount;
    }

    // Обновим запись в журнале.
    var arr = _entries();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === entry.id) {
        arr[i].deposited = (Number(arr[i].deposited) || 0) + depositAmount;
        arr[i].depositedAt = realTimestamp;
        break;
      }
    }
    updateState({ customScheduleEntries: arr });

    // UNIFIED CUSTOM SCHEDULE FLOW - после отложения поднимаем reminder
    // противоположной стороны, если она в variable-режиме (любая freq, не
    // только custom). Это даёт пользователю единое поведение для всех freq.
    var sNow = (typeof getState === "function") ? getState() : {};
    var incomeIsVariable = (sNow.incomeType || "fixed") === "variable";
    var expenseIsVariable = (sNow.expenseType || "fixed") === "variable";
    if (entry.side === "income") {
      updateState({
        customScheduleExpensePrompt: !!expenseIsVariable,
        customScheduleIncomePrompt: false
      });
    } else {
      updateState({
        customScheduleIncomePrompt: !!incomeIsVariable,
        customScheduleExpensePrompt: false
      });
    }
  }

  // BUGFIX: после записи факта/отложения нужно полностью пересобрать график
  // (как это делает applyFact в простой модели) - иначе линия и точка факта не
  // отрисовываются. Делаем это только если активен экран графика, чтобы не
  // дёргать nav-состояние при записи с экрана расчёта.
  function _refreshGraphAfterRecord() {
    var sc = document.querySelector(".screen.active");
    var onAdvice = sc && sc.id === "screen-advice";
    if (onAdvice && typeof renderProtocolAdviceGraph === "function") {
      renderProtocolAdviceGraph();
      if (typeof factHistory !== "undefined" && factHistory && factHistory.length &&
          typeof runBrain === "function") {
        runBrain();
      }
    } else if (typeof updatePlanHeader === "function") {
      updatePlanHeader();
    }
  }

  // ── Events: Continue / Deposit / Skip / History clicks ────────────────────

  if (continueBtn) {
    continueBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      var rawAmount = (typeof parseNumber === "function")
        ? parseNumber(amountInput ? amountInput.value : "0")
        : Number(amountInput && amountInput.value || 0);
      if (!rawAmount || rawAmount <= 0) {
        if (typeof haptic === "function") haptic("error");
        if (amountInput) {
          amountInput.classList.add("error", "shake");
          setTimeout(function () { amountInput.classList.remove("error", "shake"); }, 400);
        }
        if (typeof showToast === "function") showToast(t("cs.toast.invalidAmount"), "error");
        return;
      }
      var dateVal = (dateInput && dateInput.value) ? dateInput.value : _todayIso();

      // Редактирование - просто пишем и закрываем (без шага alloc).
      if (ctx.editId) {
        _updateEntry(ctx.editId, rawAmount, dateVal);
        if (typeof showToast === "function") showToast(t("cs.toast.updated"), "success");
        closeCustomScheduleSheet();
        if (typeof recalcPlan === "function") recalcPlan();
        return;
      }

      // ── CONFIGURE-режим (кнопки периодичности гибкой модели) ───────────────
      // Только настройка прогноза: сумма + частота → пересчёт плана. Без записи
      // в историю и без отложения (фактические поступления - через кнопки на
      // графике). Защита от дубля: та же частота И та же сумма = ничего не
      // меняем, показываем подсказку.
      if (ctx.configure) {
        var cfgFreq = ctx.frequency || "monthly";
        var cfgPrevFreq = ctx.prevFreq || "";
        var cfgPrevAmount = Number(ctx.prevAmount) || 0;
        var nothingChanged = (cfgFreq === cfgPrevFreq) && (rawAmount === cfgPrevAmount);
        if (nothingChanged) {
          if (typeof haptic === "function") haptic("error");
          if (amountInput) {
            amountInput.classList.add("error", "shake");
            setTimeout(function () { amountInput.classList.remove("error", "shake"); }, 400);
          }
          if (typeof showToast === "function") {
            showToast(t("cs.toast.noChange." + ctx.side), "info");
          }
          return; // модалку оставляем открытой - пользователь может скорректировать
        }
        var cfgPatch = {};
        if (ctx.side === "income") {
          cfgPatch.incomeFrequency = cfgFreq;
          cfgPatch.fixedIncomeAmount = rawAmount;
          cfgPatch.incomeStartDate = dateVal;
        } else {
          cfgPatch.expenseFrequency = cfgFreq;
          cfgPatch.fixedExpenseAmount = rawAmount;
          cfgPatch.expenseStartDate = dateVal;
        }
        if (typeof updateState === "function") updateState(cfgPatch);
        if (typeof saveFullState === "function") saveFullState();
        if (typeof showToast === "function") {
          showToast(t("cs.toast.planUpdated." + ctx.side), "success");
        }
        closeCustomScheduleSheet();
        if (typeof recalcPlan === "function") recalcPlan();
        if (typeof window.renderCustomSchedule === "function") {
          window.renderCustomSchedule("income");
          window.renderCustomSchedule("expense");
        }
        if (typeof updatePlanHeader === "function") updatePlanHeader();
        return;
      }

      // RECORD-режим (кнопки на графике «Записать доход/расход», «+ Записать»,
      // reminder'ы). Записываем ФАКТ и откладываем. Прогноз (fixedIncomeAmount/
      // fixedExpenseAmount + startDate) здесь НЕ трогаем - он настраивается
      // только через configure-режим (кнопки периодичности). Иначе запись
      // фактического дохода затирала бы ожидаемую сумму в плане.
      //   1. Гарантируем, что периодичность зафиксирована.
      //   2. Добавляет запись в customScheduleEntries (история ручных вводов).
      //   3. Для income: считает deposit и сразу делает commit (откладывает).
      //   4. Показывает toast + поднимает reminder противоположной стороны.
      //   5. Закрывает модалку.
      var sBefore = (typeof getState === "function") ? getState() : {};
      var freqNow = ctx.frequency || "custom";

      // ── 1. Фиксируем только периодичность (без перезаписи прогноза-суммы).
      var patch = {};
      if (ctx.side === "income") {
        patch.incomeFrequency = freqNow;
      } else {
        patch.expenseFrequency = freqNow;
      }
      if (Object.keys(patch).length > 0 && typeof updateState === "function") {
        updateState(patch);
      }

      // ── 3. Добавляем запись в журнал.
      var entry = _addEntry(ctx.side, rawAmount, dateVal);
      ctx.baseAmount = rawAmount;
      ctx.entryDate = dateVal;
      ctx.editId = entry.id;

      // ── 4. Считаем deposit. Для freq!=custom - per-entry режим; для custom -
      //      accumulated (включает только что добавленную запись).
      var calc = _computeDepositForEntry(ctx.side, rawAmount);
      ctx.pendingDeposit = calc.deposit;

      // ── 5. Для INCOME с положительным deposit - сразу делаем commit.
      //      Для EXPENSE - просто записываем (расход не идёт на цель напрямую).
      if (ctx.side === "income" && calc.deposit > 0) {
        // Проверяем, что есть цель - иначе откладывать не на что.
        var goalVal = 0;
        try {
          var gi = document.getElementById("goal");
          goalVal = gi ? (typeof parseNumber === "function" ? parseNumber(gi.value || "0") : Number(gi.value) || 0) : 0;
        } catch (er) { goalVal = 0; }
        if (goalVal > 0) {
          if (typeof haptic === "function") haptic("success");
          _commitDeposit(entry, calc.deposit);
          if (typeof showToast === "function") {
            showToast(t("cs.toast.deposited", { amount: _amount(calc.deposit) }), "success");
          }
        } else {
          if (typeof showToast === "function") showToast(t("cs.toast.added.income"), "success");
        }
      } else if (ctx.side === "income") {
        // Доход добавлен, но откладывать нечего (deposit=0).
        if (typeof showToast === "function") showToast(t("cs.toast.added.income"), "success");
      } else {
        // Расход.
        if (typeof showToast === "function") showToast(t("cs.toast.added.expense"), "success");
      }

      // UNIFIED CUSTOM SCHEDULE FLOW - финальный источник правды для reminder'ов.
      // Вызываем ПОСЛЕ всех updateState (в т.ч. внутри _commitDeposit), чтобы
      // ничего нас не перетёрло. Reminder поднимаем только если противоположная
      // сторона в variable-режиме (иначе он бесполезен).
      var _sAfter = (typeof getState === "function") ? getState() : sBefore;
      var _incomeIsVariable = (_sAfter.incomeType || "fixed") === "variable";
      var _expenseIsVariable = (_sAfter.expenseType || "fixed") === "variable";
      if (ctx.side === "income") {
        _setIncomePrompt(false);
        _setExpensePrompt(!!_expenseIsVariable);
      } else {
        _setExpensePrompt(false);
        _setIncomePrompt(!!_incomeIsVariable);
      }

      closeCustomScheduleSheet();
      if (typeof recalcPlan === "function") recalcPlan();
      // UNIFIED CUSTOM SCHEDULE FLOW - force-render обоих блоков и main-plan,
      // чтобы счётчики и история сразу обновились.
      if (typeof window.renderCustomSchedule === "function") {
        window.renderCustomSchedule("income");
        window.renderCustomSchedule("expense");
      }
      // BUGFIX: перерисовываем график, чтобы линия и точка факта появились.
      _refreshGraphAfterRecord();
    });
  }

  // FIX: custom schedule accumulation + counters update - рендер шага
  // «График отложений» теперь показывает АККУМУЛИРОВАННЫЕ тоталы за период,
  // а не одну только что введённую сумму. Это даёт пользователю полную
  // картину: «всего накопилось X, расходы Y, нужно отложить Z (уже отложено W)».
  function _renderAllocStep(side, amount, calc) {
    // Главное число - это pending deposit (то, что ещё надо докинуть).
    if (allocAmountEl) {
      allocAmountEl.textContent = (typeof fmtNum === "function") ? fmtNum(calc.deposit) : String(calc.deposit);
    }
    // "Откуда" - теперь от накопленных тоталов (а не от введённой суммы).
    var fromWrap = sheet ? sheet.querySelector(".cs-alloc-from") : null;
    if (fromWrap) {
      // Для income: «от накопленного дохода X (вы только что добавили Y)»
      // Для expense: «накопленный расход X (вы только что добавили Y)»
      var subKey = side === "expense" ? "cs.alloc.fromTotal.expense" : "cs.alloc.fromTotal.income";
      var baseTotal = side === "expense" ? calc.totalExpense : calc.totalIncome;
      fromWrap.innerHTML = t(subKey, {
        total: '<b>' + _amount(baseTotal) + '</b>',
        added: '<b>' + _amount(amount) + '</b>'
      });
    } else if (allocBaseEl) {
      allocBaseEl.textContent = _amount(side === "expense" ? calc.totalExpense : calc.totalIncome);
    }

    // Breakdown: income − expense = free  (и при необходимости - уже отложено).
    var breakdownEl = document.getElementById("csAllocBreakdown");
    if (breakdownEl) {
      var html = "";
      if (calc.totalIncome > 0 || calc.totalExpense > 0) {
        html += t("cs.alloc.breakdown", {
          income: '<b>' + _amount(calc.totalIncome) + '</b>',
          expense: '<b>' + _amount(calc.totalExpense) + '</b>',
          free: '<b>' + _amount(calc.free) + '</b>'
        });
      }
      if (calc.alreadyDeposited > 0) {
        if (html) html += '<br>';
        html += t("cs.alloc.alreadyDeposited") + ': <b>' + _amount(calc.alreadyDeposited) + '</b>';
      }
      breakdownEl.innerHTML = html;
    }
  }

  if (depositBtn) {
    depositBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("success");
      var goalVal = 0;
      try {
        var gi = document.getElementById("goal");
        goalVal = gi ? (typeof parseNumber === "function" ? parseNumber(gi.value || "0") : Number(gi.value) || 0) : 0;
      } catch (e) { goalVal = 0; }
      if (goalVal <= 0) {
        if (typeof showToast === "function") showToast(t("cs.toast.noGoal"), "info");
        // Всё равно закрываем - запись уже создана.
        closeCustomScheduleSheet();
        if (typeof recalcPlan === "function") recalcPlan();
        return;
      }
      // FIX: custom schedule accumulation + counters update - пересчитываем
      // pendingDeposit непосредственно перед commit, чтобы избежать гонок
      // (state мог поменяться, пока модалка была открыта).
      var freshCalc = _computeDepositForEntry(ctx.side);
      var commitAmount = freshCalc.deposit > 0 ? freshCalc.deposit : ctx.pendingDeposit;

      // FIX: custom schedule accumulation + counters update - атрибуцию
      // delta-отложения держим на income-entry (даже если триггер был от
      // expense-стороны). Это нужно потому, что:
      //   • в истории badge «Отложено X» показывается только у income-записей
      //   • смысл deposited - «сколько денег ушло на цель», что концептуально
      //     связано с источником дохода, а не с расходом
      // Если income-записей нет (только что введён expense без custom-доходов) -
      // fallback на ту запись, что только что создана (поведение прежнее).
      var targetEntry = _entries().filter(function (e) { return e.id === ctx.editId; })[0];
      if (ctx.side === "expense") {
        var incomeEntries = _entriesBySide("income").slice().sort(function (a, b) {
          var dCmp = String(b.date).localeCompare(String(a.date));
          if (dCmp !== 0) return dCmp;
          return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        });
        if (incomeEntries.length) targetEntry = incomeEntries[0];
      }
      if (targetEntry && commitAmount > 0) {
        _commitDeposit(targetEntry, commitAmount);
      }
      if (typeof showToast === "function") {
        showToast(t("cs.toast.deposited", { amount: _amount(commitAmount) }), "success");
      }
      closeCustomScheduleSheet();
      // FIX: custom schedule accumulation + counters update - гарантированный
      // re-render счётчиков «Отложено от этой суммы» / «Отложено на цель»
      // сразу после клика, не дожидаясь следующего естественного recalcPlan.
      if (typeof recalcPlan === "function") recalcPlan();
      if (typeof window.renderCustomSchedule === "function") window.renderCustomSchedule();
      _refreshGraphAfterRecord();
    });
  }

  if (skipDepositBtn) {
    skipDepositBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      // CUSTOM SCHEDULE v2 - fix main plan display - даже без отложения важно
      // показать соответствующий reminder: пользователь зафиксировал движение
      // одной стороны, имеет смысл предложить дополнить другую (но только если
      // противоположная сторона тоже в custom-режиме).
      var sSkip = (typeof getState === "function") ? getState() : {};
      var incCustomS = (sSkip.incomeType === "variable") && ((sSkip.incomeFrequency || "monthly") === "custom");
      var expCustomS = (sSkip.expenseType === "variable") && ((sSkip.expenseFrequency || "monthly") === "custom");
      if (ctx.side === "income") {
        _setExpensePrompt(!!expCustomS);
        if (typeof showToast === "function") showToast(t("cs.toast.added.income"), "success");
      } else {
        _setExpensePrompt(false);
        _setIncomePrompt(!!incCustomS);
        if (typeof showToast === "function") showToast(t("cs.toast.added.expense"), "success");
      }
      closeCustomScheduleSheet();
      if (typeof recalcPlan === "function") recalcPlan();
    });
  }

  if (overlay) {
    overlay.addEventListener("click", function () { closeCustomScheduleSheet(); });
  }

  if (typeof ProtoSheet !== "undefined" && ProtoSheet.initSwipe) {
    ProtoSheet.initSwipe(sheet, closeCustomScheduleSheet);
  }

  // Numeric formatting на amount input + UNIFIED CUSTOM SCHEDULE FLOW: live-preview.
  if (amountInput) {
    amountInput.addEventListener("input", function (e) {
      if (typeof formatNumericInput === "function") formatNumericInput(e.target);
      else e.target.value = (typeof formatNumber === "function") ? formatNumber(e.target.value) : e.target.value;
      // UNIFIED CUSTOM SCHEDULE FLOW - синхронно обновляем live-preview, чтобы
      // пользователь сразу видел рассчитанную сумму отложения.
      _updateLivePreview();
    });
  }

  // ── Wire up «+ Записать ...» buttons + history actions (event delegation) ──

  document.addEventListener("click", function (e) {
    // Phase 2: плашка «расход уже потрачен?» в неполном стартовом месяце.
    var peOpt = e.target.closest(".cs-pe-opt");
    if (peOpt) {
      var peVal = peOpt.getAttribute("data-pe");
      if (typeof haptic === "function") haptic("light");
      if (peVal === "partial") {
        var pw = document.getElementById("csPartialExpensePartialWrap");
        var opts = peOpt.parentElement;
        if (opts) opts.querySelectorAll(".cs-pe-opt").forEach(function (b) { b.classList.toggle("active", b === peOpt); });
        if (pw) {
          pw.style.display = "";
          var inp = document.getElementById("csPartialExpenseInput");
          if (inp) { try { inp.focus(); } catch (e2) {} }
        }
      } else if (typeof window._savePartialExpense === "function") {
        window._savePartialExpense(peVal, 0);
      }
      return;
    }
    var peSave = e.target.closest("#csPartialExpenseSave");
    if (peSave) {
      var peInp = document.getElementById("csPartialExpenseInput");
      var paid = peInp ? parseNumber(peInp.value || "0") : 0;
      if (typeof haptic === "function") haptic("light");
      if (typeof window._savePartialExpense === "function") window._savePartialExpense("partial", paid);
      return;
    }

    var addBtn = e.target.closest(".cs-add-record-btn");
    if (addBtn) {
      var side = addBtn.getAttribute("data-side") || "income";
      if (typeof haptic === "function") haptic("light");
      // CUSTOM SCHEDULE v2 - fix main plan display - открывая модалку нужной
      // стороны, гасим соответствующий sticky-reminder (он становится неактуален).
      if (side === "income") _setIncomePrompt(false);
      if (side === "expense") _setExpensePrompt(false);
      openCustomScheduleSheet(side);
      return;
    }

    var actionBtn = e.target.closest("[data-cs-action]");
    if (actionBtn) {
      var action = actionBtn.getAttribute("data-cs-action");
      var id = actionBtn.getAttribute("data-cs-id");
      if (!id) return;

      if (action === "edit") {
        var ent = _entries().filter(function (x) { return x.id === id; })[0];
        if (!ent) return;
        if (typeof haptic === "function") haptic("light");
        openCustomScheduleSheet(ent.side, { editId: id });
        return;
      }
      if (action === "delete") {
        if (typeof window.confirm === "function" && !window.confirm(t("cs.history.confirmDelete"))) return;
        if (typeof haptic === "function") haptic("light");
        _deleteEntry(id);
        if (typeof showToast === "function") showToast(t("cs.toast.deleted"), "info");
        if (typeof recalcPlan === "function") recalcPlan();
        return;
      }
      if (action === "deposit") {
        var entD = _entries().filter(function (x) { return x.id === id; })[0];
        if (!entD || entD.side !== "income") return;
        var goalVal2 = 0;
        try {
          var gi2 = document.getElementById("goal");
          goalVal2 = gi2 ? (typeof parseNumber === "function" ? parseNumber(gi2.value || "0") : Number(gi2.value) || 0) : 0;
        } catch (er) { goalVal2 = 0; }
        if (goalVal2 <= 0) {
          if (typeof showToast === "function") showToast(t("cs.toast.noGoal"), "info");
          return;
        }
        // UNIFIED CUSTOM SCHEDULE FLOW - inline-кнопка ↑ работает в двух режимах
        // в зависимости от freq:
        //   • freq=custom - аккумулированный pending (закрывает весь period-debt).
        //   • freq!=custom - per-entry pending (только эта запись: amount×pace − deposited).
        // Это устраняет несоответствие после смены freq и сохраняет premium UX:
        // пользователь докидывает ровно то, что не отлажено по конкретному поступлению.
        var sInline = (typeof getState === "function") ? getState() : {};
        var freqInline = sInline.incomeFrequency || "monthly";
        var calcD, dep;
        if (freqInline === "custom") {
          calcD = _computeDepositForEntry("income");
          dep = calcD.deposit;
        } else {
          var perTarget = Math.max(0, Math.round((entD.amount || 0) * _paceFraction()));
          dep = Math.max(0, perTarget - (entD.deposited || 0));
          calcD = { deposit: dep };
        }
        if (dep <= 0) {
          if (typeof showToast === "function") showToast(t("cs.toast.alreadyDeposited"), "info");
          return;
        }
        if (typeof haptic === "function") haptic("success");
        _commitDeposit(entD, dep);
        if (typeof showToast === "function") {
          showToast(t("cs.toast.deposited", { amount: _amount(dep) }), "success");
        }
        if (typeof recalcPlan === "function") recalcPlan();
        // FIX: custom schedule accumulation + counters update - force-render
        // history и main-plan сразу после inline-deposit.
        if (typeof window.renderCustomSchedule === "function") window.renderCustomSchedule();
        _refreshGraphAfterRecord();
        return;
      }
    }
  });

  // ── Expense reminder buttons ──────────────────────────────────────────────

  var reminderCta = document.getElementById("csExpenseReminderCta");
  var reminderDismiss = document.getElementById("csExpenseReminderDismiss");
  if (reminderCta) {
    reminderCta.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      _setExpensePrompt(false);
      openCustomScheduleSheet("expense");
    });
  }
  if (reminderDismiss) {
    reminderDismiss.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      _setExpensePrompt(false);
    });
  }

  // CUSTOM SCHEDULE v2 - fix main plan display - зеркальные handlers для income-reminder.
  var reminderIncCta = document.getElementById("csIncomeReminderCta");
  var reminderIncDismiss = document.getElementById("csIncomeReminderDismiss");
  if (reminderIncCta) {
    reminderIncCta.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      _setIncomePrompt(false);
      openCustomScheduleSheet("income");
    });
  }
  if (reminderIncDismiss) {
    reminderIncDismiss.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      _setIncomePrompt(false);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.renderCustomSchedule = renderCustomSchedule;
  window.openCustomScheduleSheet = openCustomScheduleSheet;
  window.closeCustomScheduleSheet = closeCustomScheduleSheet;

  // FIX: custom schedule accumulation + counters update - публичный API для
  // блока «Текущий план» и других внешних потребителей. ВСЕ значения теперь
  // от АККУМУЛИРОВАННЫХ тоталов (а не от последней записи).
  //
  // Возвращает:
  //   {
  //     anyCustomActive,   // boolean - хотя бы одна сторона freq=custom
  //     hasAnyEntry,       // boolean - есть ли хоть одна ручная запись
  //     side,              // последняя сторона ввода (для контекстного UI)
  //     entry,             // последняя запись (объект)
  //     totalIncome,       // ΣincomeEntries (или фикс)
  //     totalExpense,      // ΣexpenseEntries (или фикс)
  //     free,              // max(0, totalIncome − totalExpense)
  //     targetDeposit,     // free × pace
  //     alreadyDeposited,  // Σentry.deposited
  //     pendingDeposit,    // max(0, target − already) - "Осталось отложить"
  //     counterpart,       // { amount, kind } для UI-подсказки «учтено …»
  //     etaMonths,         // примерный срок до цели или null
  //     // fmt-помощники для render-кода:
  //     totalIncomeFormatted, totalExpenseFormatted, freeFormatted,
  //     targetFormatted, alreadyFormatted, pendingFormatted,
  //     goalSavedFormatted // accounts.main (общая сумма на цели)
  //   }
  function getCustomPlanInfo() {
    var s = (typeof getState === "function") ? getState() : {};
    if (s.financialModel !== "cashflow") return null;
    var incomeIsCustom = (s.incomeType === "variable") && ((s.incomeFrequency || "monthly") === "custom");
    var expenseIsCustom = (s.expenseType === "variable") && ((s.expenseFrequency || "monthly") === "custom");
    var anyCustomActive = incomeIsCustom || expenseIsCustom;
    if (!anyCustomActive) return null;

    var allEntries = _entries().slice().sort(function (a, b) {
      var dCmp = String(b.date).localeCompare(String(a.date));
      if (dCmp !== 0) return dCmp;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });

    if (!allEntries.length) {
      return { anyCustomActive: true, hasAnyEntry: false, etaMonths: _computeEta() };
    }

    var last = allEntries[0];
    var calc = _computeDepositForEntry(last.side);

    var goalSaved = (typeof accounts !== "undefined" && accounts && accounts.main) ? accounts.main : 0;

    return {
      anyCustomActive: true,
      hasAnyEntry: true,
      side: last.side,
      entry: last,
      totalIncome: calc.totalIncome,
      totalExpense: calc.totalExpense,
      free: calc.free,
      targetDeposit: calc.targetDeposit,
      alreadyDeposited: calc.alreadyDeposited,
      pendingDeposit: calc.deposit,
      counterpart: calc.counterpart,
      etaMonths: _computeEta(),
      // fmt-хелперы для рендера в main-plan-header.
      totalIncomeFormatted: _amount(calc.totalIncome),
      totalExpenseFormatted: _amount(calc.totalExpense),
      freeFormatted: _amount(calc.free),
      targetFormatted: _amount(calc.targetDeposit),
      alreadyFormatted: _amount(calc.alreadyDeposited),
      pendingFormatted: _amount(calc.deposit),
      goalSavedFormatted: _amount(goalSaved)
    };
  }

  window.getCustomPlanInfo = getCustomPlanInfo;

  // CUSTOM SCHEDULE LOGIC - первичный рендер на момент загрузки страницы.
  // syncFlexibleUI() мог отработать ДО парсинга этой IIFE, тогда блоки
  // оказались бы видимыми, но пустыми. Рендерим явно один раз.
  try { renderCustomSchedule(); } catch (e) { /* swallow */ }
})();

/* ===== ACCOUNT STATS SYSTEM ===== */

// DYNAMIC INFLATION - карта расширена полем dbName (имя как в public.inflation_rates),
// добавлены страны ES (Испания) и JP (Япония) из новых данных Supabase.
// Поле `inflation` теперь только FALLBACK (5.0 если Supabase недоступен - см.
// supabase.js INFLATION_FALLBACK). Реальные ставки приходят асинхронно из
// loadInflationRates() / getInflationRate(dbName).
var STATS_COUNTRY_MAP = {
  RU: { currency: "RUB", inflation: 5.0, labelKey: "stats.country.RU", dbName: "Россия" },
  US: { currency: "USD", inflation: 5.0, labelKey: "stats.country.US", dbName: "США" },
  IN: { currency: "INR", inflation: 5.0, labelKey: "stats.country.IN", dbName: "Индия" },
  CN: { currency: "CNY", inflation: 5.0, labelKey: "stats.country.CN", dbName: "Китай" },
  ES: { currency: "EUR", inflation: 5.0, labelKey: "stats.country.ES", dbName: "Испания" },
  JP: { currency: "JPY", inflation: 5.0, labelKey: "stats.country.JP", dbName: "Япония" }
};

// DYNAMIC INFLATION - reverse-lookup "Россия" → "RU". Используется при загрузке
// списка из Supabase, чтобы сопоставить DB-имя с внутренним ISO-кодом.
function _statsCountryCodeFromDbName(dbName) {
  if (!dbName) return null;
  for (var code in STATS_COUNTRY_MAP) {
    if (STATS_COUNTRY_MAP[code].dbName === dbName) return code;
  }
  return null;
}

// DYNAMIC INFLATION - последний загруженный список из Supabase (для отображения
// в дропдауне). Если пуст / не получен - используем ключи STATS_COUNTRY_MAP как
// fallback, чтобы экран не оставался пустым в offline-режиме.
var _statsInflationRows = [];

function getStatsTypeLabel(type) {
  return t("stats.type." + type) || type || "-";
}

var _statsSelectedType = null;
var _statsTargetAccount = "main";

// DYNAMIC INFLATION - рендерит <option>-список в #statsCountry на основе
// _statsInflationRows. Сохраняет текущее выбранное значение (если оно ещё
// присутствует в списке). Локализует через labelKey, fallback на dbName.
function _renderStatsCountryOptions() {
  var sel = document.getElementById("statsCountry");
  if (!sel) return;

  var prev = sel.value;
  // Очищаем кроме первого option (placeholder с data-i18n).
  while (sel.options.length > 1) sel.remove(1);

  // Список из Supabase, либо fallback на STATS_COUNTRY_MAP, если БД пустая/недоступна.
  var sourceCodes = [];
  if (_statsInflationRows && _statsInflationRows.length) {
    _statsInflationRows.forEach(function (row) {
      var code = _statsCountryCodeFromDbName(row.country);
      if (code) {
        sourceCodes.push(code);
      } else {
        // Новая страна, не в нашей карте - добавим как опцию с raw dbName.
        var opt = document.createElement("option");
        opt.value = row.country;
        opt.textContent = row.country;
        sel.appendChild(opt);
      }
    });
  } else {
    sourceCodes = Object.keys(STATS_COUNTRY_MAP);
  }

  sourceCodes.forEach(function (code) {
    var info = STATS_COUNTRY_MAP[code];
    if (!info) return;
    var opt = document.createElement("option");
    opt.value = code;
    opt.setAttribute("data-i18n", info.labelKey);
    opt.textContent = (typeof t === "function") ? t(info.labelKey) : code;
    sel.appendChild(opt);
  });

  if (prev) sel.value = prev;
}

// DYNAMIC INFLATION - обновляет live-preview ставки в дропдауне страны.
function _updateInflationPreview(rate, isLoading) {
  var el = document.getElementById("statsInflationPreview");
  if (!el) return;
  if (isLoading) {
    el.textContent = (typeof t === "function") ? t("stats.inflation.loading") : "…";
    el.style.display = "";
    el.classList.add("loading");
    return;
  }
  el.classList.remove("loading");
  if (rate == null || !isFinite(rate)) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  var pct = (Math.round(rate * 10) / 10).toString();
  el.textContent = (typeof t === "function") ? t("stats.inflation.preview", { pct: pct }) : (pct + "%");
  el.style.display = "";
}

/* ============================================================================
 * PORTFOLIO ALLOCATION LOGIC - Account Statistics portfolio composition
 * ----------------------------------------------------------------------------
 * The screen now holds an array of allocations (`storageAllocation: []`) per
 * account (`main` / `reserve`), with a per-account savingsMode toggle. The
 * legacy single-type fields stay on disk (for `bootstrapInflation` to refresh
 * cash inflation) until the user re-submits; after that they are kept but
 * superseded by the portfolio. Effective inflation is the weighted average of
 * `(inflation − expectedReturn)` across allocations.
 *
 * Inside the modal (`#statsAllocSheet`) the user picks one type and fills
 * type-specific fields. The same DOM nodes for fields (`#statsCashFields`
 * etc.) that used to live on the screen are now siblings of the sheet inside
 * the modal - UI / handlers were refactored accordingly.
 * ============================================================================ */
// MOEX INTEGRATION - RU-only preset assets (stocks + MOEX ETFs).
// Each preset bakes the long-run expected return (used in projections); live
// prices/change are fetched from MOEX ISS via window.fetchMoexQuote.
// FIX: stable stock logos - ISIN is required because Tinkoff brand CDN keys by
// ISIN, not by ticker (https://invest-brands.cdn-tinkoff.ru/{ISIN}x160.png).
// For Tinkoff/Sber funds the ticker also works; for FinEx (FX*) ETFs the IE...
// ISINs are used.
var STOCK_ASSET_PRESETS = {
  // Russian blue chips
  ru_sber:    { return: 15.0, ticker: "SBER", isin: "RU0009029540" },
  ru_gazprom: { return: 8.0,  ticker: "GAZP", isin: "RU0007661625" },
  ru_yandex:  { return: 14.0, ticker: "YDEX", isin: "RU000A107T19" },
  ru_tinkoff: { return: 16.0, ticker: "T",    isin: "RU000A107UL4" },
  ru_lukoil:  { return: 11.0, ticker: "LKOH", isin: "RU0009024277" },
  ru_magnit:  { return: 9.0,  ticker: "MGNT", isin: "RU000A0JKQU8" },
  ru_norilsk: { return: 12.0, ticker: "GMKN", isin: "RU0007288411" },
  ru_rosneft: { return: 10.0, ticker: "ROSN", isin: "RU000A0J2Q06" },
  ru_vk:      { return: 14.0, ticker: "VKCO", isin: "RU000A106YF0" },
  ru_polyus:  { return: 13.0, ticker: "PLZL", isin: "RU000A0JNAA8" },
  // MOEX ETFs (FinEx + Tinkoff/Sber funds)
  etf_fxrl:   { return: 12.0, ticker: "FXRL", isin: "IE00BQ1Y6480" },
  etf_fxit:   { return: 14.0, ticker: "FXIT", isin: "IE00BD3QHZ91" },
  etf_fxus:   { return: 10.0, ticker: "FXUS", isin: "IE00BD3QJN10" },
  etf_tmos:   { return: 13.0, ticker: "TMOS", isin: "RU000A102E61" },
  etf_sbsp:   { return: 10.0, ticker: "SBSP", isin: "RU000A1014L8" }
};

// FIX: stable stock logos - Tinkoff brand CDN keys assets by ISIN, not ticker
// (see https://github.com/Tinkoff/investAPI/issues/135). For Tinkoff/Sber funds
// the ticker also resolves; for FinEx ETFs we use the IE-prefixed ISIN.
// We build a ticker → ISIN map from the presets and produce a CHAIN of URLs:
// the <img> first tries the ISIN URL, then falls back to the ticker URL, and
// only if both fail does the colored letter chip take over.

// Build ticker→ISIN map once from STOCK_ASSET_PRESETS (presets defined above).
var _isinByTicker = (function () {
  var m = Object.create(null);
  try {
    Object.keys(STOCK_ASSET_PRESETS).forEach(function (k) {
      var p = STOCK_ASSET_PRESETS[k];
      if (p && p.ticker && p.isin) m[String(p.ticker).toUpperCase()] = p.isin;
    });
  } catch (e) {}
  return m;
})();

function getStockLogoUrls(ticker) {
  var safe = String(ticker || "").toUpperCase();
  if (!safe) return [];
  var urls = [];
  var isin = _isinByTicker[safe];
  if (isin) urls.push("https://invest-brands.cdn-tinkoff.ru/" + isin + "x160.png");
  urls.push("https://invest-brands.cdn-tinkoff.ru/" + encodeURIComponent(safe) + "x160.png");
  return urls;
}
// Back-compat: single-URL helper still works for non-list callers.
function getStockLogoUrl(ticker) {
  var u = getStockLogoUrls(ticker);
  return u.length ? u[0] : "";
}
window.getStockLogoUrl = getStockLogoUrl;
window.getStockLogoUrls = getStockLogoUrls;

// FIX: stable stock logos - global cache of tickers whose ENTIRE candidate
// chain failed. On any subsequent re-render we skip <img> entirely and render
// the colored letter fallback right away. This kills the "flash + disappear"
// loop caused by re-creating <img> nodes on every list re-render.
window._stockLogoFailed = window._stockLogoFailed || Object.create(null);

// FIX: stable stock logos - try the next URL in the candidate chain; if there
// is none left, mark the ticker as failed and swap to the CSS-only letter
// fallback (the <img> is just hidden, no outerHTML mutation).
window._tryNextLogoUrl = function (imgEl) {
  if (!imgEl) return;
  var ticker = imgEl.getAttribute("data-ticker") || "";
  var urls = (imgEl.getAttribute("data-urls") || "").split("|").filter(Boolean);
  var idx = parseInt(imgEl.getAttribute("data-idx") || "0", 10) + 1;
  if (idx < urls.length) {
    imgEl.setAttribute("data-idx", String(idx));
    imgEl.src = urls[idx];
    return;
  }
  if (ticker) window._stockLogoFailed[ticker] = true;
  if (imgEl.parentNode) imgEl.parentNode.classList.add("logo-failed");
};

// FIX: stable stock logos - single source of truth for rendering a stock icon.
// Always returns a stable wrapper containing both <img> and the letter fallback;
// CSS swaps them via `.logo-failed`, never via innerHTML reflow. Cached failures
// short-circuit straight to the fallback (no <img> at all).
function renderStockLogoHtml(ticker) {
  if (!ticker) return "";
  var safe = String(ticker).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  var letter = safe.charAt(0) || "•";
  if (window._stockLogoFailed[safe]) {
    return '<span class="alloc-logo-fallback" data-ticker="' + safe + '">' + letter + '</span>';
  }
  var urls = getStockLogoUrls(safe);
  if (!urls.length) {
    return '<span class="alloc-logo-fallback" data-ticker="' + safe + '">' + letter + '</span>';
  }
  return '<span class="alloc-logo-wrap" data-ticker="' + safe + '">' +
    '<img class="alloc-logo" alt="' + safe + '" loading="eager" decoding="async" ' +
    'data-ticker="' + safe + '" ' +
    'data-urls="' + urls.join("|") + '" ' +
    'data-idx="0" ' +
    'src="' + urls[0] + '" ' +
    'onerror="window._tryNextLogoUrl(this)" />' +
    '<span class="alloc-logo-fallback" aria-hidden="true">' + letter + '</span>' +
  '</span>';
}
window.renderStockLogoHtml = renderStockLogoHtml;

// MOEX INTEGRATION - public MOEX ISS API (no auth required, CORS-friendly).
// Quotes are cached in-memory for 60s to avoid spamming the endpoint while the
// user toggles assets in the picker. Falls back to null on any error so the
// UI just shows a friendly "could not fetch" state.
var _moexQuoteCache = Object.create(null);
var MOEX_TTL_MS = 60 * 1000;
window.fetchMoexQuote = function (ticker) {
  if (!ticker) return Promise.resolve(null);
  var key = String(ticker).toUpperCase();
  var now = Date.now();
  var cached = _moexQuoteCache[key];
  if (cached && (now - cached.ts) < MOEX_TTL_MS) return Promise.resolve(cached.data);

  var url = "https://iss.moex.com/iss/engines/stock/markets/shares/securities/" +
            encodeURIComponent(key) + ".json?iss.meta=off&iss.only=marketdata";
  return fetch(url, { credentials: "omit" })
    .then(function (resp) { return resp.ok ? resp.json() : null; })
    .then(function (json) {
      if (!json || !json.marketdata || !Array.isArray(json.marketdata.data)) return null;
      var cols = json.marketdata.columns || [];
      var iLast  = cols.indexOf("LAST");
      var iChg   = cols.indexOf("LASTCHANGEPRCNT");
      var iBoard = cols.indexOf("BOARDID");
      // Prefer the first row with a non-null LAST (active board).
      var row = json.marketdata.data.find(function (r) { return iLast >= 0 && r[iLast] != null; })
             || json.marketdata.data[0]
             || null;
      if (!row) return null;
      var data = {
        price:     (iLast  >= 0) ? row[iLast]  : null,
        changePct: (iChg   >= 0) ? row[iChg]   : null,
        board:     (iBoard >= 0) ? row[iBoard] : null
      };
      _moexQuoteCache[key] = { ts: Date.now(), data: data };
      return data;
    })
    .catch(function (e) {
      console.warn("[MOEX] fetch failed for", key, e);
      return null;
    });
};

// PORTFOLIO ALLOCATION v2 - metal preset returns (long-run avg, % p.a.).
var METAL_PRESETS = {
  gold:     { return: 8.0 },
  silver:   { return: 6.0 },
  platinum: { return: 5.0 }
};

// PORTFOLIO ALLOCATION + CARD EXPANSION - global helpers reused by both the
// editor screen and the back-card detail flow. Kept here so renderAccountBackCards
// and openAllocationDetail can compute consistent labels/icons/meta.
function allocTypeIcon(type) {
  switch (type) {
    case "cash":    return "💵";
    case "stock":   return "📈";
    case "deposit": return "🏦";
    case "metals":  return "🥇";
    default:        return "•";
  }
}
function allocTypeLabel(type) {
  return (typeof t === "function") ? t("stats.type." + type) : (type || "-");
}
function allocInstrumentLabel(item) {
  if (!item) return "-";
  var p = item.details || {};
  if (item.type === "cash") {
    return p.country ? (STATS_COUNTRY_MAP[p.country] ? t(STATS_COUNTRY_MAP[p.country].labelKey) : p.country) : "-";
  }
  if (item.type === "stock") {
    return p.asset ? t("stats.asset." + p.asset) : (p.ticker || "-");
  }
  if (item.type === "deposit") {
    var er = getStorageExpectedReturn({ type: "deposit", params: p });
    return (Math.round(er * 10) / 10) + "% · " + (p.termMonths || 0) + " " + t("misc.monthShort");
  }
  if (item.type === "metals") {
    return p.metal ? t("stats.metal." + p.metal) : "-";
  }
  return "-";
}
function allocBackMeta(item) {
  if (!item) return "";
  var p = item.details || {};
  if (item.type === "cash") {
    var infl = (p.inflation != null) ? (Math.round(p.inflation * 10) / 10) + "%" : "-";
    return (p.currency || "-") + " · " + t("misc.inflation") + " " + infl;
  }
  if (item.type === "stock") {
    var sR = getStorageExpectedReturn({ type: "stock", params: p });
    return (Math.round(sR * 10) / 10) + "%";
  }
  if (item.type === "deposit") {
    if (p.promoMonths > 0 && p.promoRate != null) {
      return t("stats.cap." + (p.capitalization || "monthly")) + " · промо " + p.promoMonths + "м @ " + (Math.round(p.promoRate * 10) / 10) + "%";
    }
    return t("stats.cap." + (p.capitalization || "monthly"));
  }
  if (item.type === "metals") {
    var mR = getStorageExpectedReturn({ type: "metals", params: p });
    return (Math.round(mR * 10) / 10) + "%";
  }
  return "";
}

(function initAccountStats() {
  var statsScreen = document.getElementById("screen-account-stats");
  if (!statsScreen) return;

  // ── Screen refs ────────────────────────────────────────────────────────
  var backBtn = document.getElementById("accountStatsBack");
  var submitBtn = document.getElementById("statsSubmit");
  var allocListEl = document.getElementById("statsAllocList");
  var allocAddBtn = document.getElementById("statsAllocAddBtn");
  var allocProgressEl = document.getElementById("statsAllocProgress");
  var allocProgressFill = document.getElementById("statsAllocProgressFill");
  var allocProgressLabel = document.getElementById("statsAllocProgressLabel");
  var allocProgressValue = document.getElementById("statsAllocProgressValue");
  // FUTURE DEPOSITS PER ITEM - global savings-mode toggle removed; refs kept
  // null-safe in case any old skin still ships the element.
  var savingsModeSeg = document.getElementById("statsSavingsMode");
  var savingsModeHint = document.getElementById("statsSavingsModeHint");
  // FUTURE DEPOSITS PER ITEM - per-allocation auto-replenish checkboxes.
  var stockReplenish = document.getElementById("statsStockReplenish");
  // FIX: portfolio UX v2 - new refs (logo preview, live percentage amount).
  var stockPreviewRow  = document.getElementById("statsStockPreviewRow");
  var stockPreviewLogo = document.getElementById("statsStockPreviewLogo");
  var stockPreviewName = document.getElementById("statsStockPreviewName");
  var allocPctLive     = document.getElementById("statsAllocPercentageLive");

  // ── Modal refs ─────────────────────────────────────────────────────────
  var allocOverlay = document.getElementById("statsAllocOverlay");
  var allocSheet = document.getElementById("statsAllocSheet");
  var allocSheetTitle = document.getElementById("statsAllocSheetTitle");
  var allocSaveBtn = document.getElementById("statsAllocSave");
  var allocCancelBtn = document.getElementById("statsAllocCancel");
  var allocPctInput = document.getElementById("statsAllocPercentage");
  var allocPctHint = document.getElementById("statsAllocPercentageHint");

  var typeGrid = document.getElementById("statsTypeGrid");
  var cashFields = document.getElementById("statsCashFields");
  var stockFields = document.getElementById("statsStockFields");
  var depositFields = document.getElementById("statsDepositFields");
  var metalsFields = document.getElementById("statsMetalsFields");
  var countrySelect = document.getElementById("statsCountry");
  var currencySelect = document.getElementById("statsCurrency");
  // PORTFOLIO ALLOCATION v2 - stocks now resolve return from preset (no manual input).
  var stockAssetSel = document.getElementById("statsStockAsset");
  var stockReturnHint = document.getElementById("statsStockReturnHint");
  var depositRate = document.getElementById("statsDepositRate");
  var depositRateLabel = document.getElementById("statsDepositRateLabel"); // FIX: dynamic label
  var depositTerm = document.getElementById("statsDepositTerm");
  var depositPromoMonths = document.getElementById("statsDepositPromoMonths");
  var depositPromoRate = document.getElementById("statsDepositPromoRate");
  var depositPromoRateWrap = document.getElementById("statsDepositPromoRateWrap");
  var depositCap  = document.getElementById("statsDepositCap");
  var depositReplenish = document.getElementById("statsDepositReplenish");
  var depositEffPreview = document.getElementById("statsDepositEffectivePreview"); // FIX: live preview
  // METALS - IN DEVELOPMENT - metal inputs replaced by info card; refs may be null.
  var metalSelect = document.getElementById("statsMetal");
  var metalReturnHint = document.getElementById("statsMetalReturnHint");

  // MOEX INTEGRATION - refs for live quote card under stock asset select.
  var moexBlock       = document.getElementById("statsStockMoexBlock");
  var moexPriceEl     = document.getElementById("statsStockMoexPrice");
  var moexChangeEl    = document.getElementById("statsStockMoexChange");
  var _moexReqToken   = 0; // guards against out-of-order async responses

  // PORTFOLIO ALLOCATION v2 - small helpers for showing return hints.
  function _showReturnHint(el, retVal) {
    if (!el) return;
    if (!isFinite(retVal) || retVal <= 0) {
      el.textContent = "";
      el.style.display = "none";
      return;
    }
    el.textContent = t("stats.field.expectedReturn") + ": " + (Math.round(retVal * 10) / 10) + "%";
    el.style.color = "#6ee7b7";
    el.style.display = "";
  }

  // MOEX INTEGRATION - render live quote card states (loading / data / error).
  function _renderMoexCard(state, quote) {
    if (!moexBlock) return;
    moexBlock.style.display = "";
    moexBlock.classList.remove("is-loading", "is-error");
    if (state === "loading") {
      moexBlock.classList.add("is-loading");
      if (moexPriceEl)  moexPriceEl.textContent  = t("stats.moex.loading");
      if (moexChangeEl) { moexChangeEl.textContent = "-"; moexChangeEl.className = "moex-quote-change muted"; }
      return;
    }
    if (state === "error" || !quote || quote.price == null) {
      moexBlock.classList.add("is-error");
      if (moexPriceEl)  moexPriceEl.textContent  = t("stats.moex.error");
      if (moexChangeEl) { moexChangeEl.textContent = "-"; moexChangeEl.className = "moex-quote-change muted"; }
      return;
    }
    var price = Number(quote.price);
    var chg   = (quote.changePct != null) ? Number(quote.changePct) : null;
    if (moexPriceEl) {
      moexPriceEl.textContent = (price >= 100 ? price.toFixed(2) : price.toFixed(3)) + " ₽";
    }
    if (moexChangeEl) {
      if (chg == null || !isFinite(chg)) {
        moexChangeEl.textContent = "-";
        moexChangeEl.className = "moex-quote-change muted";
      } else {
        var sign = chg > 0 ? "+" : "";
        moexChangeEl.textContent = sign + chg.toFixed(2) + "%";
        moexChangeEl.className = "moex-quote-change " + (chg > 0 ? "positive" : (chg < 0 ? "negative" : "muted"));
      }
    }
  }

  // MOEX INTEGRATION - fetch quote for the currently selected asset and render it.
  // Uses a request token so a late response from a previous ticker can't overwrite
  // the card after the user has already picked another asset.
  function _refreshMoexForSelected() {
    if (!moexBlock || !stockAssetSel) return;
    var preset = STOCK_ASSET_PRESETS[stockAssetSel.value] || null;
    if (!preset || !preset.ticker || typeof window.fetchMoexQuote !== "function") {
      moexBlock.style.display = "none";
      return;
    }
    var myToken = ++_moexReqToken;
    _renderMoexCard("loading", null);
    window.fetchMoexQuote(preset.ticker).then(function (q) {
      if (myToken !== _moexReqToken) return; // user picked another asset
      _renderMoexCard(q ? "ok" : "error", q);
    });
  }

  // FIX: dynamic deposit rate label - switches between base-only and after-promo.
  function _updateDepositRateLabel() {
    if (!depositRateLabel) return;
    var n = depositPromoMonths ? (parseInt(depositPromoMonths.value, 10) || 0) : 0;
    var key = (n > 0) ? "stats.field.depositRateAfterPromo" : "stats.field.depositRate";
    depositRateLabel.setAttribute("data-i18n", key);
    depositRateLabel.textContent = t(key);
  }

  // FIX: live recompute of blended effective deposit rate as user types.
  function _updateDepositEffectivePreview() {
    if (!depositEffPreview) return;
    var rate = parseFloat(depositRate ? depositRate.value : "");
    var term = parseInt(depositTerm ? depositTerm.value : "", 10);
    if (!isFinite(rate) || rate <= 0 || !isFinite(term) || term <= 0) {
      depositEffPreview.style.display = "none";
      depositEffPreview.textContent = "";
      return;
    }
    var promoM = parseInt(depositPromoMonths ? depositPromoMonths.value : "0", 10);
    if (!isFinite(promoM) || promoM < 0) promoM = 0;
    promoM = Math.min(promoM, 12);
    var promoR = parseFloat(depositPromoRate ? depositPromoRate.value : "");
    // If promo months > 0 but promo rate missing → preview only base (not blended).
    var params = {
      rate: rate,
      termMonths: term,
      promoMonths: promoM,
      promoRate: (promoM > 0 && isFinite(promoR) && promoR > 0) ? promoR : null,
      capitalization: _modalDepositCap || "monthly"
    };
    var eff = getStorageExpectedReturn({ type: "deposit", params: params });
    if (!isFinite(eff) || eff <= 0) {
      depositEffPreview.style.display = "none";
      depositEffPreview.textContent = "";
      return;
    }
    var pct = (Math.round(eff * 10) / 10).toString();
    depositEffPreview.textContent = t("stats.deposit.effectivePreview", { pct: pct });
    depositEffPreview.style.display = "";
  }

  // ── Working state (mirrors what will be written into appState on submit) ─
  // PORTFOLIO ALLOCATION LOGIC - local mutable working copy. Submit pushes
  // this into appState.accountStats[_statsTargetAccount].
  var _allocations = [];          // [{ id, type, percentage, details }]
  var _modalEditIndex = -1;       // -1 → adding; >=0 → editing existing
  var _modalDepositCap = "monthly";

  // FUTURE DEPOSITS PER ITEM - global savings-mode state removed; the
  // per-allocation `details.acceptsFutureDeposits` flag is the new source of truth.
  // Expose for openAccountStatsScreen (defined outside this IIFE).
  window._statsState = {
    setAllocations: function (arr /*, mode (ignored, legacy) */) {
      _allocations = Array.isArray(arr) ? arr.map(function (a) { return Object.assign({}, a, { details: Object.assign({}, a.details || {}) }); }) : [];
      _renderAllocList();
      _renderAllocProgress();
      _updateSubmitState();
    },
    getAllocations: function () { return _allocations; }
  };

  function _genAllocId() {
    return "alloc_" + Math.random().toString(36).slice(2, 9);
  }

  function _typeIcon(type) {
    switch (type) {
      case "cash":    return "💵";
      case "stock":   return "📈";
      case "deposit": return "🏦";
      case "metals":  return "🥇";
      default:        return "•";
    }
  }

  function _allocTitle(item) {
    return (typeof t === "function") ? t("stats.type." + item.type) : item.type;
  }

  // FIX: stable stock logos - delegates to renderStockLogoHtml which uses a
  // wrapper + CSS-controlled fallback (no outerHTML swap, no flash on re-render).
  function _allocIconHtml(item) {
    if (item && item.type === "stock" && item.details && item.details.ticker && typeof renderStockLogoHtml === "function") {
      return renderStockLogoHtml(item.details.ticker);
    }
    return _typeIcon(item.type);
  }

  function _allocMetaText(item) {
    var p = item.details || {};
    if (item.type === "cash") {
      var country = p.country ? (STATS_COUNTRY_MAP[p.country] ? t(STATS_COUNTRY_MAP[p.country].labelKey) : p.country) : "-";
      var infl = (p.inflation != null) ? (Math.round(p.inflation * 10) / 10) + "%" : "-";
      return country + " · " + (p.currency || "-") + " · " + t("misc.inflation") + " " + infl;
    }
    if (item.type === "stock") {
      // PORTFOLIO ALLOCATION v2 - return is preset-resolved (no manual field).
      var asset = p.asset ? t("stats.asset." + p.asset) : (p.ticker || "-");
      var sR = getStorageExpectedReturn({ type: "stock", params: p });
      return asset + " · " + (Math.round(sR * 10) / 10) + "%";
    }
    if (item.type === "deposit") {
      // PORTFOLIO ALLOCATION v2 - show the blended effective rate so users see
      // the actual yield reflecting promo + base + capitalization.
      var dR = getStorageExpectedReturn({ type: "deposit", params: p });
      var term = (p.termMonths != null) ? p.termMonths + " " + t("misc.monthShort") : "-";
      var promoStr = (p.promoMonths > 0 && p.promoRate != null) ? " · " + p.promoMonths + "m@" + (Math.round(p.promoRate * 10) / 10) + "%" : "";
      return (Math.round(dR * 10) / 10) + "% · " + term + promoStr;
    }
    if (item.type === "metals") {
      var metal = p.metal ? t("stats.metal." + p.metal) : "-";
      var mR = getStorageExpectedReturn({ type: "metals", params: p });
      return metal + " · " + (Math.round(mR * 10) / 10) + "%";
    }
    return "";
  }

  // PORTFOLIO ALLOCATION v2 - withdrawn allocations are tracked in the same
  // array but skipped from rebalance / totals / calc; they live in a separate
  // visual section as a history snapshot.
  function _isActive(a) { return a && !a.withdrawn; }
  function _activeAllocations() { return _allocations.filter(_isActive); }
  function _withdrawnAllocations() { return _allocations.filter(function (a) { return a && a.withdrawn; }); }

  function _allocTotal() {
    // Total is computed over ACTIVE allocations only.
    return _allocations.reduce(function (acc, a) { return _isActive(a) ? acc + (Number(a.percentage) || 0) : acc; }, 0);
  }

  /* PORTFOLIO ALLOCATION v2 - auto-rebalance helper.
   * After the user adds, edits or removes an active allocation, the remaining
   * active items are rescaled proportionally so the total = 100%. Rounding is
   * absorbed by the last touched item to guarantee exact 100 sum (integers).
   *
   * @param fixedIndex  index in _allocations whose percentage should NOT change
   *                    (e.g. the just-edited item). Pass -1 to rebalance all.
   */
  function _autoRebalanceActive(fixedIndex) {
    var actives = _allocations.map(function (a, i) { return _isActive(a) ? { ref: a, i: i } : null; }).filter(Boolean);
    if (!actives.length) return;

    var fixed = (typeof fixedIndex === "number" && fixedIndex >= 0)
      ? actives.filter(function (x) { return x.i === fixedIndex; })[0]
      : null;
    var movable = actives.filter(function (x) { return x !== fixed; });
    var fixedPct = fixed ? (Number(fixed.ref.percentage) || 0) : 0;
    var targetForMovable = Math.max(0, 100 - fixedPct);

    if (!movable.length) {
      // Only the fixed item exists → it must be 100.
      if (fixed) fixed.ref.percentage = 100;
      return;
    }

    var sumMovable = movable.reduce(function (s, m) { return s + (Number(m.ref.percentage) || 0); }, 0);

    if (sumMovable === 0) {
      // Distribute equally with integer remainder spread across first items.
      var per = Math.floor(targetForMovable / movable.length);
      var leftover = targetForMovable - per * movable.length;
      movable.forEach(function (m, idx) { m.ref.percentage = per + (idx < leftover ? 1 : 0); });
    } else {
      // Proportional rescale.
      var assigned = 0;
      movable.forEach(function (m, idx) {
        var scaled;
        if (idx === movable.length - 1) {
          scaled = targetForMovable - assigned; // absorb rounding
        } else {
          scaled = Math.round((Number(m.ref.percentage) || 0) * targetForMovable / sumMovable);
          assigned += scaled;
        }
        m.ref.percentage = Math.max(0, scaled);
      });
    }

    // Final guard - any over-100 due to rounding sums clipped.
    var total = _allocTotal();
    if (total !== 100 && actives.length) {
      var diff = 100 - total;
      var last = actives[actives.length - 1];
      last.ref.percentage = Math.max(0, (Number(last.ref.percentage) || 0) + diff);
    }
  }

  function _withdrawAlloc(idx) {
    var a = _allocations[idx];
    if (!a || a.withdrawn) return;
    a.withdrawn = true;
    a.withdrawnAt = new Date().toISOString();
    // Snapshot the share + effective return at the moment of withdrawal so
    // history rows can show what the slice was earning.
    a.withdrawnSnapshot = {
      percentage: a.percentage,
      expectedReturn: getStorageExpectedReturn({ type: a.type, params: a.details })
    };
    _autoRebalanceActive(-1);
    _renderAllocList();
    _renderAllocProgress();
    _updateSubmitState();
    if (typeof showToast === "function") showToast(t("portfolio.rebalanced"), "success");
  }

  function _restoreAlloc(idx) {
    var a = _allocations[idx];
    if (!a || !a.withdrawn) return;
    a.withdrawn = false;
    a.withdrawnAt = null;
    a.withdrawnSnapshot = null;
    // Bring back with whatever share was stored (may be 0 → auto-rebalance reflows).
    if (!a.percentage || a.percentage <= 0) a.percentage = 1;
    _autoRebalanceActive(-1);
    _renderAllocList();
    _renderAllocProgress();
    _updateSubmitState();
  }

  function _formatWithdrawnDate(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      var dd = String(d.getDate()).padStart(2, "0");
      var mm = String(d.getMonth() + 1).padStart(2, "0");
      return dd + "." + mm + "." + d.getFullYear();
    } catch (e) { return ""; }
  }

  function _renderAllocList() {
    if (!allocListEl) return;
    var active = _activeAllocations();
    var withdrawn = _withdrawnAllocations();

    if (!active.length && !withdrawn.length) {
      allocListEl.innerHTML = '<div class="alloc-empty">' + t("portfolio.empty") + '</div>';
      return;
    }

    var html = "";

    // PORTFOLIO ALLOCATION v2 - stacked composition bar (color per type).
    if (active.length) {
      html += '<div class="alloc-stacked" aria-hidden="true">';
      active.forEach(function (a) {
        var p = Number(a.percentage) || 0;
        if (p <= 0) return;
        html += '<div class="alloc-stacked-seg" data-type="' + a.type + '" style="width:' + p + '%" title="' + _allocTitle(a) + ' ' + p + '%"></div>';
      });
      html += '</div>';
    }

    _allocations.forEach(function (item, idx) {
      if (!item || item.withdrawn) return;
      // FIX: portfolio UX v2 - for stocks render a round company logo (with a
      // type-icon fallback if the image fails to load).
      var iconHtml = _allocIconHtml(item);
      html +=
        '<div class="alloc-item" data-type="' + item.type + '" data-alloc-idx="' + idx + '">' +
          '<div class="alloc-item-icon">' + iconHtml + '</div>' +
          '<div class="alloc-item-body">' +
            '<div class="alloc-item-title">' + _allocTitle(item) + '</div>' +
            '<div class="alloc-item-meta">' + _allocMetaText(item) + '</div>' +
          '</div>' +
          '<div class="alloc-item-right">' +
            '<div class="alloc-item-pct">' + (Number(item.percentage) || 0) + '%</div>' +
            '<button type="button" class="alloc-item-action alloc-item-action--edit" data-alloc-edit="' + idx + '" aria-label="' + t("portfolio.edit") + '">✎</button>' +
            '<button type="button" class="alloc-item-action alloc-item-action--withdraw" data-alloc-withdraw="' + idx + '" aria-label="' + t("portfolio.withdraw") + '">↓</button>' +
            '<button type="button" class="alloc-item-action alloc-item-action--remove" data-alloc-remove="' + idx + '" aria-label="' + t("portfolio.remove") + '">✕</button>' +
          '</div>' +
        '</div>';
    });

    if (withdrawn.length) {
      html += '<div class="alloc-withdrawn-section-label">' + t("portfolio.withdrawnSection") + '</div>';
      _allocations.forEach(function (item, idx) {
        if (!item || !item.withdrawn) return;
        var dateStr = _formatWithdrawnDate(item.withdrawnAt);
        // FIX: portfolio UX v2 - same logo-aware icon helper for withdrawn rows.
        var iconHtml = _allocIconHtml(item);
        html +=
          '<div class="alloc-item alloc-item--withdrawn" data-type="' + item.type + '" data-alloc-idx="' + idx + '">' +
            '<div class="alloc-item-icon">' + iconHtml + '</div>' +
            '<div class="alloc-item-body">' +
              '<div class="alloc-item-title">' + _allocTitle(item) + '</div>' +
              '<div class="alloc-item-meta">' + _allocMetaText(item) + '</div>' +
              (dateStr ? '<span class="alloc-withdrawn-badge">' + t("portfolio.withdrawnOn", { date: dateStr }) + '</span>' : '') +
            '</div>' +
            '<div class="alloc-item-right">' +
              '<div class="alloc-item-pct">' + (Number(item.percentage) || 0) + '%</div>' +
              '<button type="button" class="alloc-item-action alloc-item-action--restore" data-alloc-restore="' + idx + '" aria-label="' + t("portfolio.restore") + '">↑</button>' +
              '<button type="button" class="alloc-item-action alloc-item-action--remove" data-alloc-remove="' + idx + '" aria-label="' + t("portfolio.remove") + '">✕</button>' +
            '</div>' +
          '</div>';
      });
    }

    allocListEl.innerHTML = html;
  }

  function _renderAllocProgress() {
    // FIX: portfolio UX v2 - also keeps the "+ Add storage type" button in a
    // soft-disabled state when the portfolio is already at 100%.
    _syncAddBtnDisabled();
    if (!allocProgressEl) return;
    var total = _allocTotal(); // active total only
    var capped = Math.min(100, Math.max(0, total));
    if (allocProgressFill) allocProgressFill.style.width = capped + "%";
    allocProgressEl.classList.remove("is-over", "is-complete");
    if (total > 100) allocProgressEl.classList.add("is-over");
    else if (total === 100) allocProgressEl.classList.add("is-complete");

    if (allocProgressValue) allocProgressValue.textContent = total + "% / 100%";
    if (allocProgressLabel) {
      if (total > 100) {
        allocProgressLabel.textContent = t("portfolio.over") + ": +" + (total - 100) + "%";
      } else if (total === 100) {
        allocProgressLabel.textContent = t("portfolio.complete");
      } else if (total === 0 && !_activeAllocations().length) {
        allocProgressLabel.textContent = t("portfolio.empty");
      } else {
        allocProgressLabel.textContent = t("portfolio.remaining") + ": " + (100 - total) + "%";
      }
    }
  }

  // FIX: portfolio UX v2 - soft-disable add button at exactly 100% portfolio.
  // We don't set `disabled` so the click still reaches our handler and can
  // surface a friendly toast.
  function _syncAddBtnDisabled() {
    if (!allocAddBtn) return;
    var atFull = _allocTotal() >= 100 && _activeAllocations().length > 0;
    allocAddBtn.classList.toggle("is-disabled", atFull);
    allocAddBtn.setAttribute("aria-disabled", atFull ? "true" : "false");
  }

  // FUTURE DEPOSITS PER ITEM - savings-mode renderer removed (no UI to draw).

  function _updateSubmitState() {
    if (!submitBtn) return;
    var total = _allocTotal();
    submitBtn.disabled = !(_allocations.length > 0 && total === 100);
  }

  // ── List interactions: edit / remove / withdraw / restore ─────────────
  // PORTFOLIO ALLOCATION v2 - every action that mutates active set triggers
  // an auto-rebalance so the active total stays at exactly 100%.
  if (allocListEl) {
    allocListEl.addEventListener("click", function (e) {
      var rmBtn = e.target.closest("[data-alloc-remove]");
      if (rmBtn) {
        var ri = parseInt(rmBtn.getAttribute("data-alloc-remove"), 10);
        if (!isNaN(ri) && _allocations[ri]) {
          var wasActive = _isActive(_allocations[ri]);
          _allocations.splice(ri, 1);
          if (wasActive) _autoRebalanceActive(-1);
          _renderAllocList();
          _renderAllocProgress();
          _updateSubmitState();
        }
        return;
      }
      var edBtn = e.target.closest("[data-alloc-edit]");
      if (edBtn) {
        var ei = parseInt(edBtn.getAttribute("data-alloc-edit"), 10);
        if (!isNaN(ei) && _allocations[ei]) _openAllocModal(ei);
        return;
      }
      var wBtn = e.target.closest("[data-alloc-withdraw]");
      if (wBtn) {
        var wi = parseInt(wBtn.getAttribute("data-alloc-withdraw"), 10);
        if (!isNaN(wi) && _allocations[wi]) {
          if (window.confirm(t("portfolio.withdrawConfirm"))) _withdrawAlloc(wi);
        }
        return;
      }
      var rsBtn = e.target.closest("[data-alloc-restore]");
      if (rsBtn) {
        var rsi = parseInt(rsBtn.getAttribute("data-alloc-restore"), 10);
        if (!isNaN(rsi) && _allocations[rsi]) _restoreAlloc(rsi);
        return;
      }
    });
  }

  // FUTURE DEPOSITS PER ITEM - global savings-mode listener removed.

  // ── Add button → open modal in "add" mode ──────────────────────────────
  if (allocAddBtn) {
    // FIX: portfolio UX v2 - soft-block when portfolio is already at 100%.
    allocAddBtn.addEventListener("click", function () {
      if (allocAddBtn.classList.contains("is-disabled")) {
        showToast(t("portfolio.addBtn.fullToast"), "info");
        if (typeof haptic === "function") { try { haptic("light"); } catch (e) {} }
        return;
      }
      _openAllocModal(-1);
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // PORTFOLIO ALLOCATION LOGIC - modal: open / close / save
  // ──────────────────────────────────────────────────────────────────────
  function _toggleFieldsForType(type) {
    if (cashFields)    cashFields.style.display    = (type === "cash")    ? "" : "none";
    if (stockFields)   stockFields.style.display   = (type === "stock")   ? "" : "none";
    if (depositFields) depositFields.style.display = (type === "deposit") ? "" : "none";
    if (metalsFields)  metalsFields.style.display  = (type === "metals")  ? "" : "none";
  }

  function _selectTypeCard(type) {
    _statsSelectedType = type;
    if (typeGrid) {
      typeGrid.querySelectorAll(".stats-type-card").forEach(function (c) {
        c.classList.toggle("active", c.getAttribute("data-stype") === type);
      });
    }
    _toggleFieldsForType(type);
    // MOEX INTEGRATION - refresh live quote when user switches into stock mode.
    if (type === "stock") _refreshMoexForSelected();
    // FIX: portfolio UX v2 - keep stock-only preview in sync with type switch.
    if (type === "stock") _updateStockPreview();
    else if (stockPreviewRow) stockPreviewRow.style.display = "none";
  }

  function _openAllocModal(editIndex) {
    _modalEditIndex = (typeof editIndex === "number") ? editIndex : -1;
    var editing = _modalEditIndex >= 0;
    var item = editing ? _allocations[_modalEditIndex] : null;

    if (allocSheetTitle) {
      allocSheetTitle.textContent = editing ? t("portfolio.modal.editTitle") : t("portfolio.modal.addTitle");
    }

    // Default type: existing item's type, else first not-yet-picked, else 'cash'.
    var defaultType = editing ? item.type : "cash";
    _selectTypeCard(defaultType);

    // Restore details into the modal inputs.
    var d = (item && item.details) || {};

    // CASH
    if (countrySelect) countrySelect.value = (defaultType === "cash" && d.country) ? d.country : "";
    if (currencySelect) currencySelect.value = (defaultType === "cash" && d.currency) ? d.currency : "";
    _updateInflationPreview(null, false);
    if (defaultType === "cash" && d.country) {
      var info = STATS_COUNTRY_MAP[d.country];
      if (info && info.dbName && typeof window.getInflationRate === "function") {
        _updateInflationPreview(null, true);
        Promise.resolve(window.getInflationRate(info.dbName)).then(function (rate) { _updateInflationPreview(rate, false); });
      } else if (d.inflation != null) {
        _updateInflationPreview(d.inflation, false);
      }
    }
    _renderStatsCountryOptions();

    // PORTFOLIO ALLOCATION v2 - STOCK: only preset asset; return is shown as a hint.
    if (stockAssetSel) {
      var savedAsset = (defaultType === "stock" && d.asset && STOCK_ASSET_PRESETS[d.asset]) ? d.asset : "ru_sber";
      stockAssetSel.value = savedAsset;
      var _sPreset = STOCK_ASSET_PRESETS[stockAssetSel.value];
      _showReturnHint(stockReturnHint, _sPreset ? _sPreset.return : 0);
      // MOEX INTEGRATION - auto-load live quote when opening the modal in stock mode.
      if (defaultType === "stock") _refreshMoexForSelected();
      else if (moexBlock) moexBlock.style.display = "none";
    }
    // FUTURE DEPOSITS PER ITEM - restore per-item flag for stock.
    if (stockReplenish) {
      stockReplenish.checked = !!(defaultType === "stock" && d.acceptsFutureDeposits);
    }

    // PORTFOLIO ALLOCATION v2 - DEPOSIT: base rate + term + promo period + capitalization.
    if (depositRate) depositRate.value = (defaultType === "deposit" && d.rate != null) ? d.rate : "";
    if (depositTerm) depositTerm.value = (defaultType === "deposit" && d.termMonths != null) ? d.termMonths : "";
    if (depositPromoMonths) depositPromoMonths.value = (defaultType === "deposit" && d.promoMonths != null) ? d.promoMonths : "0";
    if (depositPromoRate) depositPromoRate.value = (defaultType === "deposit" && d.promoRate != null) ? d.promoRate : "";
    if (depositPromoRateWrap) depositPromoRateWrap.style.display = (depositPromoMonths && parseInt(depositPromoMonths.value, 10) > 0) ? "" : "none";
    _modalDepositCap = (defaultType === "deposit" && d.capitalization) ? d.capitalization : "monthly";
    if (depositCap) {
      depositCap.querySelectorAll(".stats-segment-btn").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-cap") === _modalDepositCap);
      });
    }
    // FUTURE DEPOSITS PER ITEM - checkbox now reflects acceptsFutureDeposits
    // (falls back to the legacy `replenishable` flag for back-compat).
    if (depositReplenish) {
      var depAccepts = (d.acceptsFutureDeposits != null) ? d.acceptsFutureDeposits : d.replenishable;
      depositReplenish.checked = !!(defaultType === "deposit" && depAccepts);
    }
    // FIX: sync dynamic label + live preview after restoring saved values.
    _updateDepositRateLabel();
    _updateDepositEffectivePreview();

    // PORTFOLIO ALLOCATION v2 - METALS: preset only, return shown as a hint.
    if (metalSelect) {
      var savedMetal = (defaultType === "metals" && d.metal && METAL_PRESETS[d.metal]) ? d.metal : "gold";
      metalSelect.value = savedMetal;
      var _mPreset = METAL_PRESETS[metalSelect.value];
      _showReturnHint(metalReturnHint, _mPreset ? _mPreset.return : 0);
    }

    // PORTFOLIO ALLOCATION v2 - Percentage prefill:
    //   editing → existing value;
    //   adding  → remaining slot (100 − active total), or 100/N+1 if portfolio full.
    if (allocPctInput) {
      if (editing) {
        allocPctInput.value = item.percentage || "";
      } else {
        var remaining = 100 - _allocTotal();
        if (remaining > 0) {
          allocPctInput.value = remaining;
        } else {
          var n = _activeAllocations().length;
          allocPctInput.value = (n > 0) ? Math.max(1, Math.round(100 / (n + 1))) : 100;
        }
      }
    }
    _updatePctHint();

    // FIX: portfolio UX v2 - refresh live amount & stock preview after restore.
    _updateAllocPctLive();
    _updateStockPreview();

    // Show modal.
    if (allocOverlay) allocOverlay.style.display = "block";
    if (allocSheet) {
      allocSheet.style.display = "block";
      requestAnimationFrame(function () { allocSheet.classList.add("open"); });
    }
    // FIX: portfolio UX v2 - hide bottom nav while the modal is open so the
    // top-right close button is never obscured by it.
    if (typeof hideBottomNav === "function") { try { hideBottomNav(); } catch (e) {} }
  }

  function _closeAllocModal() {
    if (allocSheet) allocSheet.classList.remove("open");
    setTimeout(function () {
      if (allocSheet) allocSheet.style.display = "none";
      if (allocOverlay) allocOverlay.style.display = "none";
    }, 320);
    _modalEditIndex = -1;
    // FIX: portfolio UX v2 - restore bottom nav after the modal animates out.
    if (typeof showBottomNav === "function") { try { showBottomNav(); } catch (e) {} }
    // Clear any stale error highlights so the next open is pristine.
    _clearFieldErrors();
  }

  // FIX: portfolio UX v2 - live "= XXX ₽" amount under the percentage input.
  function _updateAllocPctLive() {
    if (!allocPctLive) return;
    var pct = parseInt(allocPctInput ? allocPctInput.value : "", 10);
    var balKey = _statsTargetAccount || "main";
    var bal = (typeof accounts !== "undefined" && accounts && accounts[balKey] != null) ? Number(accounts[balKey]) : 0;
    if (!isFinite(pct) || pct <= 0 || pct > 100) {
      allocPctLive.classList.add("is-zero");
      allocPctLive.textContent = "-";
      return;
    }
    var amount = Math.round(bal * pct / 100);
    var symbol = (typeof getCurrencySymbol === "function") ? getCurrencySymbol() : "₽";
    var formatted = (typeof fmtConverted === "function") ? fmtConverted(amount) : String(amount);
    allocPctLive.classList.remove("is-zero");
    allocPctLive.textContent = t("portfolio.percentage.liveLabel").replace("{amount}", formatted + " " + symbol);
  }

  // FIX: stable stock logos - logo + name preview row under the stock select.
  // The static <img id="statsStockPreviewLogo"> is replaced with a fresh
  // wrapper from renderStockLogoHtml so the failure cache + CSS fallback work
  // exactly like in the list. The row never hides itself on logo error
  // (the letter chip is rendered instead).
  function _updateStockPreview() {
    if (!stockPreviewRow) return;
    var preset = STOCK_ASSET_PRESETS[stockAssetSel ? stockAssetSel.value : ""] || null;
    if (!preset || !preset.ticker) {
      stockPreviewRow.style.display = "none";
      return;
    }
    stockPreviewRow.style.display = "";
    // Replace the existing logo node with the stable wrapper. We re-query each
    // call so it works on the original <img> on first open and on the wrapper
    // after subsequent updates.
    var slot = stockPreviewRow.querySelector("#statsStockPreviewLogo, .alloc-logo-wrap, .alloc-logo-fallback");
    if (slot) {
      var tmp = document.createElement("span");
      tmp.innerHTML = renderStockLogoHtml(preset.ticker);
      var fresh = tmp.firstChild;
      if (fresh) {
        // Preserve the id on whichever wrapper takes its place (used elsewhere).
        fresh.id = "statsStockPreviewLogo";
        slot.parentNode.replaceChild(fresh, slot);
      }
    }
    if (stockPreviewName) {
      var label = stockAssetSel && stockAssetSel.options[stockAssetSel.selectedIndex] ? stockAssetSel.options[stockAssetSel.selectedIndex].text : preset.ticker;
      stockPreviewName.textContent = label;
    }
  }

  // FIX: portfolio UX v2 - required field highlight + iOS-style shake. Reuses
  // the existing `input-shake` keyframe via `.field-error` + `.field-shake`.
  function _flashFieldError(el) {
    if (!el) return;
    el.classList.add("field-error", "field-shake");
    setTimeout(function () { el.classList.remove("field-shake"); }, 400);
    var clear = function () { el.classList.remove("field-error"); el.removeEventListener("input", clear); el.removeEventListener("change", clear); };
    el.addEventListener("input", clear);
    el.addEventListener("change", clear);
  }
  function _clearFieldErrors() {
    [allocPctInput, depositRate, depositTerm, depositPromoRate].forEach(function (el) {
      if (el) el.classList.remove("field-error", "field-shake");
    });
  }
  // Returns true if all required fields for the current type are valid.
  // Side-effect: visually flashes invalid ones.
  function _validateRequiredFields(type) {
    _clearFieldErrors();
    var ok = true;
    // Portfolio share is always required.
    var pctVal = parseInt(allocPctInput ? allocPctInput.value : "", 10);
    if (!isFinite(pctVal) || pctVal < 1 || pctVal > 100) {
      _flashFieldError(allocPctInput); ok = false;
    }
    if (type === "deposit") {
      var r = parseFloat(depositRate ? depositRate.value : "");
      if (!isFinite(r) || r <= 0) { _flashFieldError(depositRate); ok = false; }
      var tm = parseInt(depositTerm ? depositTerm.value : "", 10);
      if (!isFinite(tm) || tm <= 0) { _flashFieldError(depositTerm); ok = false; }
      // Promo rate is only required when promo months > 0.
      var pm = parseInt(depositPromoMonths ? depositPromoMonths.value : "0", 10) || 0;
      if (pm > 0) {
        var pr = parseFloat(depositPromoRate ? depositPromoRate.value : "");
        if (!isFinite(pr) || pr <= 0) { _flashFieldError(depositPromoRate); ok = false; }
      }
    }
    return ok;
  }

  function _updatePctHint() {
    if (!allocPctHint) return;
    // PORTFOLIO ALLOCATION v2 - with auto-rebalance, any 1-100 share is valid;
    // the hint just tells the user what will happen ("others will be rescaled").
    var current = parseInt(allocPctInput ? allocPctInput.value : "0", 10) || 0;
    var othersCount = _activeAllocations().filter(function (a, i) {
      return _modalEditIndex < 0 || _allocations.indexOf(a) !== _modalEditIndex;
    }).length;
    if (current < 1 || current > 100) {
      allocPctHint.textContent = t("portfolio.validation.percentageInvalid");
      allocPctHint.style.color = "#ef4444";
    } else if (othersCount > 0) {
      allocPctHint.textContent = t("portfolio.rebalanced");
      allocPctHint.style.color = "rgba(110,231,183,0.75)";
    } else {
      allocPctHint.textContent = "";
      allocPctHint.style.color = "";
    }
  }

  if (allocPctInput) {
    allocPctInput.addEventListener("input", _updatePctHint);
    // FIX: portfolio UX v2 - keep the live "= XXX ₽" amount in sync as user types.
    allocPctInput.addEventListener("input", _updateAllocPctLive);
  }

  // ── Modal: type grid → switch fields ──────────────────────────────────
  if (typeGrid) {
    typeGrid.addEventListener("click", function (e) {
      var card = e.target.closest(".stats-type-card");
      if (!card) return;
      var type = card.getAttribute("data-stype");
      _selectTypeCard(type);
    });
  }

  // ── Modal: country live preview (cash) ────────────────────────────────
  if (countrySelect) {
    countrySelect.addEventListener("change", async function () {
      var code = countrySelect.value;
      var info = STATS_COUNTRY_MAP[code];
      if (info && currencySelect) currencySelect.value = info.currency;
      if (!info || !info.dbName) { _updateInflationPreview(null, false); return; }
      _updateInflationPreview(null, true);
      var rate = (typeof window.getInflationRate === "function")
        ? await window.getInflationRate(info.dbName)
        : info.inflation;
      _updateInflationPreview(rate, false);
    });
  }

  // MOEX INTEGRATION - stock asset → update return hint + pull live MOEX quote.
  if (stockAssetSel) {
    stockAssetSel.addEventListener("change", function () {
      var preset = STOCK_ASSET_PRESETS[stockAssetSel.value] || null;
      _showReturnHint(stockReturnHint, preset ? preset.return : 0);
      _refreshMoexForSelected();
      // FIX: portfolio UX v2 - refresh logo + name preview on asset change.
      _updateStockPreview();
    });
  }

  // METALS - IN DEVELOPMENT - metalSelect/hint refs are null (replaced by info card).
  if (metalSelect) {
    metalSelect.addEventListener("change", function () {
      var mp = METAL_PRESETS[metalSelect.value] || null;
      _showReturnHint(metalReturnHint, mp ? mp.return : 0);
    });
  }

  // PORTFOLIO ALLOCATION v2 - promo months → reveal/hide promo rate input.
  // FIX: Promo period for deposits - clamp 0–12, dynamic rate label, live preview.
  if (depositPromoMonths) {
    depositPromoMonths.addEventListener("input", function () {
      var n = parseInt(depositPromoMonths.value, 10);
      if (isFinite(n) && n > 12) { depositPromoMonths.value = 12; n = 12; }
      if (isFinite(n) && n < 0) { depositPromoMonths.value = 0; n = 0; }
      if (depositPromoRateWrap) depositPromoRateWrap.style.display = (n > 0) ? "" : "none";
      _updateDepositRateLabel();
      _updateDepositEffectivePreview();
    });
  }

  // FIX: live recompute on any deposit field change.
  [depositRate, depositTerm, depositPromoRate].forEach(function (el) {
    if (el) el.addEventListener("input", _updateDepositEffectivePreview);
  });

  // ── Modal: deposit capitalization segment ──────────────────────────────
  if (depositCap) {
    depositCap.addEventListener("click", function (e) {
      var btn = e.target.closest(".stats-segment-btn");
      if (!btn) return;
      depositCap.querySelectorAll(".stats-segment-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      _modalDepositCap = btn.getAttribute("data-cap") || "monthly";
      _updateDepositEffectivePreview(); // FIX: recompute when capitalization changes
    });
  }

  // ── Modal: save / cancel ───────────────────────────────────────────────
  function _validateAndCollectDetails(type) {
    if (type === "cash") {
      if (!countrySelect || !countrySelect.value) return null;
      var info = STATS_COUNTRY_MAP[countrySelect.value];
      return {
        country: countrySelect.value,
        currency: currencySelect ? currencySelect.value : (info ? info.currency : null),
        inflation: null // resolved async below in caller
      };
    }
    if (type === "stock") {
      // PORTFOLIO ALLOCATION v2 - no manual return, asset → preset return.
      var assetVal = stockAssetSel ? stockAssetSel.value : "";
      var sPreset = STOCK_ASSET_PRESETS[assetVal];
      if (!sPreset) return null;
      return {
        asset: assetVal,
        ticker: sPreset.ticker || "",
        // FUTURE DEPOSITS PER ITEM - per-allocation auto-replenishment toggle.
        acceptsFutureDeposits: !!(stockReplenish && stockReplenish.checked)
        // expectedReturn is intentionally NOT stored - resolved at runtime from preset.
      };
    }
    if (type === "deposit") {
      // PORTFOLIO ALLOCATION v2 - base rate, term, promo period, capitalization.
      var rate = parseFloat(depositRate ? depositRate.value : "");
      var term = parseInt(depositTerm ? depositTerm.value : "", 10);
      if (!isFinite(rate) || rate <= 0) return null;
      if (!isFinite(term) || term <= 0) return null;
      // FIX: Promo period for deposits - extended to 0–12 months.
      var promoM = parseInt(depositPromoMonths ? depositPromoMonths.value : "0", 10);
      if (!isFinite(promoM) || promoM < 0) promoM = 0;
      promoM = Math.min(promoM, 12);
      var promoR = parseFloat(depositPromoRate ? depositPromoRate.value : "");
      if (promoM > 0 && (!isFinite(promoR) || promoR <= 0)) return null; // require promo rate when months > 0
      // FUTURE DEPOSITS PER ITEM - the replenishment checkbox now drives the
      // shared per-item flag. We keep `replenishable` mirrored for back-compat
      // with any legacy code path that still reads it.
      var depAccepts = !!(depositReplenish && depositReplenish.checked);
      return {
        rate: rate,
        termMonths: term,
        promoMonths: promoM,
        promoRate: (promoM > 0) ? promoR : null,
        capitalization: _modalDepositCap || "monthly",
        replenishable: depAccepts,
        acceptsFutureDeposits: depAccepts
      };
    }
    if (type === "metals") {
      // METALS - IN DEVELOPMENT - saving is blocked; caller handles the toast.
      // Existing metal allocations from older state remain visible/removable.
      return null;
    }
    return null;
  }

  if (allocSaveBtn) {
    allocSaveBtn.addEventListener("click", async function () {
      var type = _statsSelectedType;
      if (!type) { showToast(t("portfolio.validation.fillFields"), "error"); return; }

      // METALS - IN DEVELOPMENT - intercept before validation so the user gets
      // a clear "coming soon" toast instead of a generic "fill fields" error.
      if (type === "metals") {
        showToast(t("metals.inDev.toast"), "info");
        return;
      }

      // FIX: portfolio UX v2 - visual required-field check with red outline +
      // iOS-style shake. Shows the new red "fill required fields" toast.
      if (!_validateRequiredFields(type)) {
        showToast(t("portfolio.validation.requiredFields"), "error");
        if (typeof haptic === "function") { try { haptic("error"); } catch (e) {} }
        return;
      }

      var details = _validateAndCollectDetails(type);
      if (!details) { showToast(t("portfolio.validation.fillFields"), "error"); return; }

      // For cash, resolve fresh inflation from Supabase (with fallback).
      if (type === "cash" && details.country) {
        var info = STATS_COUNTRY_MAP[details.country];
        if (info && info.dbName && typeof window.getInflationRate === "function") {
          try { details.inflation = await window.getInflationRate(info.dbName); }
          catch (e) { details.inflation = info.inflation; }
        } else {
          details.inflation = info ? info.inflation : null;
        }
      }

      var pct = parseInt(allocPctInput ? allocPctInput.value : "", 10);
      if (!isFinite(pct) || pct < 1 || pct > 100) {
        showToast(t("portfolio.validation.percentageInvalid"), "error");
        return;
      }

      var item = {
        id: (_modalEditIndex >= 0 && _allocations[_modalEditIndex].id) ? _allocations[_modalEditIndex].id : _genAllocId(),
        type: type,
        percentage: pct,
        details: details,
        withdrawn: false
      };

      var newIndex;
      if (_modalEditIndex >= 0) {
        _allocations[_modalEditIndex] = item;
        newIndex = _modalEditIndex;
      } else {
        _allocations.push(item);
        newIndex = _allocations.length - 1;
      }

      // PORTFOLIO ALLOCATION v2 - auto-rebalance: fix the just-edited slice and
      // rescale the other ACTIVE slices proportionally to keep total = 100%.
      _autoRebalanceActive(newIndex);

      _renderAllocList();
      _renderAllocProgress();
      _updateSubmitState();
      _closeAllocModal();
      if (_activeAllocations().length > 1 && typeof showToast === "function") {
        showToast(t("portfolio.rebalanced"), "success");
      }
    });
  }

  if (allocCancelBtn) allocCancelBtn.addEventListener("click", _closeAllocModal);
  if (allocOverlay) allocOverlay.addEventListener("click", _closeAllocModal);

  // ──────────────────────────────────────────────────────────────────────
  // PORTFOLIO ALLOCATION LOGIC - main submit: persist portfolio to state
  // ──────────────────────────────────────────────────────────────────────
  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      // PORTFOLIO ALLOCATION v2 - active total must hit 100% (withdrawn excluded).
      var activeTotal = _allocTotal();
      var activeCount = _activeAllocations().length;
      if (!activeCount || activeTotal !== 100) {
        showToast(t(activeCount ? "portfolio.validation.notFull" : "portfolio.validation.empty"), "error");
        return;
      }

      // Keep a "primary" type for legacy consumers (renderAccountBackCards
      // fallback before they read storageAllocation). Use the largest ACTIVE slice.
      var primary = _activeAllocations().slice().sort(function (a, b) { return (b.percentage || 0) - (a.percentage || 0); })[0];
      var statsData = {
        type: primary.type,
        country: (primary.type === "cash" ? primary.details.country : null) || null,
        currency: (primary.type === "cash" ? primary.details.currency : null) || null,
        inflation: (primary.type === "cash" ? primary.details.inflation : null),
        params: (primary.type !== "cash" ? Object.assign({}, primary.details) : null),
        // PORTFOLIO ALLOCATION v2 - full portfolio incl. withdrawn history.
        // FUTURE DEPOSITS PER ITEM - per-allocation acceptsFutureDeposits
        // is persisted inside `details` (no top-level futureSavingsMode anymore).
        storageAllocation: _allocations.map(function (a) {
          return {
            id: a.id,
            type: a.type,
            percentage: a.percentage,
            details: Object.assign({}, a.details),
            withdrawn: !!a.withdrawn,
            withdrawnAt: a.withdrawnAt || null,
            withdrawnSnapshot: a.withdrawnSnapshot ? Object.assign({}, a.withdrawnSnapshot) : null
          };
        })
      };

      var patch = {};
      patch[_statsTargetAccount] = statsData;
      updateState({ accountStats: patch });
      if (typeof saveFullState === "function") saveFullState();

      document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
      document.getElementById("screen-accounts").classList.add("active");
      showBottomNav();
      moveProfileToActiveHeader();
      renderAccountBackCards();
      if (typeof updatePlanHeader === "function") updatePlanHeader();
      showToast(t("stats.added"), "success");
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", function () {
      document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
      document.getElementById("screen-accounts").classList.add("active");
      showBottomNav();
      moveProfileToActiveHeader();
    });
  }
})();

function openAccountStatsScreen(accountKey) {
  // PREMIUM SYSTEM - гейт на уровне самой функции (последняя линия защиты).
  // Сюда может вести несколько путей (back-card-button, future direct calls);
  // если не премиум - открываем premium-модалку и отменяем переход.
  if (window._premiumGate && window._premiumGate("stats")) return;

  _statsTargetAccount = accountKey || "main";

  var s = getState();
  var allStats = s.accountStats || {};
  var stats = allStats[_statsTargetAccount] || {};
  _statsSelectedType = null;

  document.querySelectorAll(".screen").forEach(function (sc) { sc.classList.remove("active"); });
  document.getElementById("screen-account-stats").classList.add("active");
  hideBottomNav();
  moveProfileToActiveHeader();

  // PORTFOLIO ALLOCATION LOGIC - derive the working portfolio from saved state.
  // 1) If `storageAllocation` exists → use as-is.
  // 2) Else if legacy `type` exists → migrate to a one-item 100% portfolio.
  // 3) Otherwise → empty list.
  var allocs = [];
  if (Array.isArray(stats.storageAllocation) && stats.storageAllocation.length) {
    allocs = stats.storageAllocation;
  } else if (stats.type) {
    var details = {};
    if (stats.type === "cash") {
      details = { country: stats.country || null, currency: stats.currency || null, inflation: (stats.inflation != null ? stats.inflation : null) };
    } else if (stats.params) {
      details = Object.assign({}, stats.params);
    }
    allocs = [{ id: "alloc_" + Math.random().toString(36).slice(2, 9), type: stats.type, percentage: 100, details: details }];
  }
  // FUTURE DEPOSITS PER ITEM - global savings mode removed; per-item flag lives in details.
  if (window._statsState && typeof window._statsState.setAllocations === "function") {
    window._statsState.setAllocations(allocs);
  }

  // PORTFOLIO ALLOCATION LOGIC - prime country dropdown in the modal (fast,
  // uses cached _statsInflationRows; refresh from Supabase in background).
  _renderStatsCountryOptions();
  if (typeof window.loadInflationRates === "function") {
    Promise.resolve(window.loadInflationRates()).then(function (rows) {
      if (rows && rows.length) {
        _statsInflationRows = rows;
        _renderStatsCountryOptions();
      }
    });
  }
}

/* PORTFOLIO ALLOCATION v2 - weighted active inflation across the portfolio.
 * Uses storageAllocation when available, falls back to legacy single `inflation`.
 * Only ACTIVE (non-withdrawn) "cash" allocations carry inflation. */
function getActiveInflation() {
  var s = getState();
  var allStats = s.accountStats || {};
  function _fromStats(st) {
    if (!st) return null;
    if (Array.isArray(st.storageAllocation) && st.storageAllocation.length) {
      var sum = 0, weight = 0;
      st.storageAllocation.forEach(function (a) {
        if (a && !a.withdrawn && a.type === "cash" && a.details && a.details.inflation != null) {
          var w = Number(a.percentage) || 0;
          sum += Number(a.details.inflation) * w;
          weight += w;
        }
      });
      if (weight > 0) return sum / weight;
      return null;
    }
    if (st.inflation != null) return st.inflation;
    return null;
  }
  var v = _fromStats(allStats.main);
  if (v != null) return v;
  return _fromStats(allStats.reserve);
}

/* ----------------------------------------------------------------------------
 * NEW: Storage type - annualized expected return (%) per account stats record.
 * Returns 0 for cash / unknown / missing params (no instrument yield).
 * For deposit: converts nominal rate to effective annual using capitalization.
 * For stock / metals: uses raw expectedReturn (assumed annual %).
 * -------------------------------------------------------------------------- */
function getStorageExpectedReturn(stats) {
  if (!stats || !stats.type) return 0;
  var p = stats.params || {};

  // PORTFOLIO ALLOCATION v2 - stocks now resolve return from preset (no manual).
  if (stats.type === "stock") {
    var preset = p.asset ? STOCK_ASSET_PRESETS[p.asset] : null;
    if (preset && isFinite(preset.return)) return preset.return;
    // Backwards compat: legacy entries that still stored expectedReturn directly.
    var lr = parseFloat(p.expectedReturn);
    return (isFinite(lr) && lr > 0) ? lr : 0;
  }

  // PORTFOLIO ALLOCATION v2 - metals now resolve return from preset (no manual).
  if (stats.type === "metals") {
    var mPreset = p.metal ? METAL_PRESETS[p.metal] : null;
    if (mPreset && isFinite(mPreset.return)) return mPreset.return;
    var mLR = parseFloat(p.expectedReturn);
    return (isFinite(mLR) && mLR > 0) ? mLR : 0;
  }

  if (stats.type === "deposit") {
    // PORTFOLIO ALLOCATION v2 - blended effective rate:
    //   weighted-avg(promoRate, baseRate) by months, then compounded per capitalization.
    var rate = parseFloat(p.rate);
    if (!isFinite(rate) || rate <= 0) return 0;

    var term = parseInt(p.termMonths, 10);
    if (!isFinite(term) || term <= 0) term = 12;

    // FIX: Promo period for deposits - extended to 0–12 months.
    var promoM = parseInt(p.promoMonths, 10);
    if (!isFinite(promoM) || promoM < 0) promoM = 0;
    promoM = Math.min(promoM, 12, term);
    var promoR = parseFloat(p.promoRate);
    if (!isFinite(promoR) || promoR < 0) promoR = rate;

    // Weighted nominal annual rate (promo portion gets the higher promoRate).
    var blendedNominal;
    if (promoM > 0) {
      blendedNominal = (promoR * promoM + rate * (term - promoM)) / term;
    } else {
      blendedNominal = rate;
    }

    var n;
    switch (p.capitalization) {
      case "monthly":   n = 12; break;
      case "quarterly": n = 4;  break;
      case "end":       n = 1;  break;
      default:          n = 12;
    }
    var nominal = blendedNominal / 100;
    var eff = Math.pow(1 + nominal / n, n) - 1;
    return eff * 100;
  }
  return 0; // cash: yield is 0
}

/* ----------------------------------------------------------------------------
 * PORTFOLIO ALLOCATION LOGIC - weighted effective inflation for the whole
 * portfolio: Σ((inflation_i − expectedReturn_i) × weight_i) / Σ(weight_i)
 *
 *   cash    contributes (inflation − 0)
 *   stock   contributes (cashBaselineInflation − expectedReturn)
 *   deposit contributes (cashBaselineInflation − effectiveDepositRate)
 *   metals  contributes (cashBaselineInflation − expectedReturn)
 *
 * cashBaselineInflation = inflation taken from the cash slice (weighted avg).
 * If no cash slice → uses 0 baseline (pure yield reduces effective inflation).
 *
 * Returns null when nothing is configured. Positive = real purchasing-power
 * loss; negative = yield outpaces inflation.
 * -------------------------------------------------------------------------- */
function getEffectiveInflation() {
  var s = getState();
  var allStats = s.accountStats || {};
  var stats = allStats.main || allStats.reserve;
  if (!stats) return null;

  // PORTFOLIO ALLOCATION v2 - portfolio branch over ACTIVE allocations only.
  // Withdrawn slices are history and do not contribute to live calculations.
  if (Array.isArray(stats.storageAllocation) && stats.storageAllocation.length) {
    var active = stats.storageAllocation.filter(function (a) { return a && !a.withdrawn; });
    if (!active.length) {
      // Edge case: everything withdrawn → fall through to legacy below.
    } else {
      var cashSum = 0, cashWeight = 0;
      active.forEach(function (a) {
        if (a.type === "cash" && a.details && a.details.inflation != null) {
          var w = Number(a.percentage) || 0;
          cashSum += Number(a.details.inflation) * w;
          cashWeight += w;
        }
      });
      var baseline = (cashWeight > 0) ? (cashSum / cashWeight) : 0;

      var totalWeight = 0, weightedEff = 0;
      active.forEach(function (a) {
        var w = Number(a.percentage) || 0;
        if (w <= 0) return;
        var localInfl, localReturn;
        if (a.type === "cash") {
          localInfl = (a.details && a.details.inflation != null) ? Number(a.details.inflation) : baseline;
          localReturn = 0;
        } else {
          localInfl = baseline;
          localReturn = getStorageExpectedReturn({ type: a.type, params: a.details });
        }
        weightedEff += (localInfl - localReturn) * w;
        totalWeight += w;
      });
      if (totalWeight > 0) return weightedEff / totalWeight;
    }
  }

  // Legacy single-type fallback.
  var infl = (stats.inflation != null) ? Number(stats.inflation) : null;
  if (infl == null || !isFinite(infl)) {
    var rOnly = getStorageExpectedReturn(stats);
    if (rOnly > 0) return -rOnly;
    return null;
  }
  var ret = getStorageExpectedReturn(stats);
  return infl - ret;
}

function calculateInflationAdjustedValue(amount, inflationRate, monthsLeft) {
  if (!amount || amount <= 0) return null;
  if (!inflationRate || inflationRate <= 0) return null;
  if (!monthsLeft || monthsLeft <= 0 || !isFinite(monthsLeft)) return null;

  var years = monthsLeft / 12;
  var adjustedValue = Math.round(amount / Math.pow(1 + inflationRate, years));
  var loss = amount - adjustedValue;

  return {
    adjustedValue: adjustedValue,
    loss: loss,
    years: years
  };
}

function calculateInflationCompensation(goal, monthsLeft, inflationRate) {
  if (!goal || goal <= 0) return null;
  if (!inflationRate || inflationRate <= 0) return null;
  if (!monthsLeft || monthsLeft <= 0 || !isFinite(monthsLeft)) return null;

  var years = monthsLeft / 12;
  var realGoal = Math.round(goal * Math.pow(1 + inflationRate, years));
  var extraMonthly = Math.round((realGoal - goal) / monthsLeft);

  return {
    realGoal: realGoal,
    extraMonthly: extraMonthly
  };
}

function renderAccountBackCards() {
  var s = getState();
  var allStats = s.accountStats || {};
  var monthsLeft = (lastCalc && lastCalc.months) ? lastCalc.months : 0;

  document.querySelectorAll(".account-block.flip-wrapper").forEach(function (block) {
    var accountKey = block.getAttribute("data-account");
    var backCard = block.querySelector(".account-back-card");
    if (!backCard) return;

    var stats = allStats[accountKey] || null;

    if (!stats || !stats.type) {
      // PREMIUM SYSTEM - для не-премиум-пользователей добавляем lock-бадж
      // прямо внутрь кнопки «+ Добавить статистику». Уникальный id Lottie
      // (lottieAccountStats_<accountKey>) нужен чтобы инициализировать оба
      // (main + reserve) бэк-card'а независимо.
      var locked = !(getState().isPremium === true);
      var lottieId = "lottieAccountStats_" + accountKey;
      var lockHtml = locked
        ? '<span class="premium-lock-badge" id="lockStats_' + accountKey + '">' +
            '<span class="premium-lock-lottie" id="' + lottieId + '"></span>' +
          '</span>'
        : '';
      backCard.innerHTML = '<div class="account-back-content stats-empty">' +
        '<button type="button" class="stats-add-btn' + (locked ? ' premium-gate-btn' : '') +
        '" data-action="add-stats" data-account="' + accountKey + '"' +
        (locked ? ' data-premium-gate="stats"' : '') + '>' +
        t("stats.addBtn") + lockHtml +
        '</button>' +
        '</div>';
      // PREMIUM SYSTEM - инициализируем Lottie замок сразу после рендера.
      // renderAccountBackCards вызывается ДО запуска IIFE initPremiumSystem
      // (строка 9422 vs 10896), поэтому _initLockLottieDynamic может быть
      // ещё не экспортирован. Делаем retry-loop с интервалом 100мс пока
      // функция не появится в window.
      if (locked) {
        (function tryInitLock(attempts) {
          if (typeof window._initLockLottieDynamic === "function") {
            window._initLockLottieDynamic(lottieId);
          } else if (attempts > 0) {
            setTimeout(function () { tryInitLock(attempts - 1); }, 100);
          }
        })(30); // ~3 секунды максимум
      }
      return;
    }

    var amount = (accountKey === "main") ? accounts.main : accounts.reserve;
    var inflation = stats.inflation;

    var html = '<div class="account-back-content">';

    // PORTFOLIO ALLOCATION v2 - composite back card uses ACTIVE allocations.
    // Withdrawn slices appear as a single summary line so users still see they
    // existed, but they don't influence live calculations.
    var allAllocs = Array.isArray(stats.storageAllocation) ? stats.storageAllocation : [];
    var activeAllocs = allAllocs.filter(function (a) { return a && !a.withdrawn; });
    var withdrawnAllocs = allAllocs.filter(function (a) { return a && a.withdrawn; });
    var hasPortfolio = activeAllocs.length > 0;

    var _expReturn = 0;
    var _baselineInfl = (inflation != null) ? Number(inflation) : 0;

    if (hasPortfolio) {
      // FUTURE DEPOSITS PER ITEM - footer shows how many active slots accept
      // auto-replenishment (replaces the old global savings-mode chip).
      var acceptingCount = activeAllocs.filter(function (a) { return a && a.details && a.details.acceptsFutureDeposits; }).length;
      var acceptLabel;
      if (acceptingCount === 0) acceptLabel = t("portfolio.futureAccept.none");
      else if (acceptingCount === activeAllocs.length) acceptLabel = t("portfolio.futureAccept.all");
      else acceptLabel = t("portfolio.futureAccept.partial").replace("{n}", acceptingCount).replace("{total}", activeAllocs.length);

      html += '<div class="stats-info-row"><span>' + t("portfolio.composition") + '</span><span>' +
              activeAllocs.length + ' · ' + acceptLabel +
              '</span></div>';

      // PORTFOLIO ALLOCATION + CARD EXPANSION - per-allocation tappable row.
      // Mirrors the editor list visually (left accent + icon + meta + %) and
      // opens the detail sheet via `data-action="alloc-detail"`. Each row has
      // its own type color so users instantly see the portfolio breakdown.
      activeAllocs.forEach(function (a) {
        var lbl = allocTypeLabel(a.type);
        var instr = allocInstrumentLabel(a);
        var meta = allocBackMeta(a);
        html +=
          '<div class="acc-alloc-row" data-type="' + a.type + '" data-action="alloc-detail" data-account="' + accountKey + '" data-alloc-id="' + (a.id || "") + '" role="button" tabindex="0">' +
            // FIX: stable stock logos - wrapper-based renderer; never replaces
            // <img> via outerHTML so list re-renders cannot flash the icon.
            '<div class="acc-alloc-row-icon">' + (
              (a.type === "stock" && a.details && a.details.ticker && typeof renderStockLogoHtml === "function")
                ? renderStockLogoHtml(a.details.ticker)
                : allocTypeIcon(a.type)
            ) + '</div>' +
            '<div class="acc-alloc-row-body">' +
              '<div class="acc-alloc-row-title">' + lbl + ' · ' + instr + '</div>' +
              (meta ? '<div class="acc-alloc-row-meta">' + meta + '</div>' : '') +
            '</div>' +
            '<div class="acc-alloc-row-right">' +
              '<div class="acc-alloc-row-pct">' + (Number(a.percentage) || 0) + '%</div>' +
              '<div class="acc-alloc-row-chevron">›</div>' +
            '</div>' +
          '</div>';
      });

      if (withdrawnAllocs.length) {
        html += '<div class="stats-info-row" style="opacity:0.55"><span>' + t("portfolio.withdrawnSection") + '</span><span>' + withdrawnAllocs.length + '</span></div>';
      }

      // Compute baseline (cash-weighted) inflation + weighted expected return from ACTIVE only.
      var cashSum = 0, cashWeight = 0;
      activeAllocs.forEach(function (a) {
        if (a.type === "cash" && a.details && a.details.inflation != null) {
          var w = Number(a.percentage) || 0;
          cashSum += Number(a.details.inflation) * w;
          cashWeight += w;
        }
      });
      _baselineInfl = (cashWeight > 0) ? (cashSum / cashWeight) : 0;

      var retSum = 0, retWeight = 0;
      activeAllocs.forEach(function (a) {
        var w = Number(a.percentage) || 0;
        if (w <= 0) return;
        var r = (a.type === "cash") ? 0 : getStorageExpectedReturn({ type: a.type, params: a.details });
        retSum += r * w;
        retWeight += w;
      });
      _expReturn = (retWeight > 0) ? (retSum / retWeight) : 0;
    } else {
      // Legacy single-type back card (preserves original layout/behaviour).
      var typeLabel = getStatsTypeLabel(stats.type);
      var countryLabel = stats.country ? (STATS_COUNTRY_MAP[stats.country] ? t(STATS_COUNTRY_MAP[stats.country].labelKey) : stats.country) : "-";
      var currencyLabel = stats.currency || "-";

      html += '<div class="stats-info-row"><span>' + t("stats.storageType") + '</span><span>' + typeLabel + '</span></div>';

      if (stats.type === "cash") {
        html += '<div class="stats-info-row"><span>' + t("stats.country") + '</span><span>' + countryLabel + '</span></div>' +
                '<div class="stats-info-row"><span>' + t("stats.currency") + '</span><span>' + currencyLabel + '</span></div>';
      } else if (stats.type === "stock") {
        var _ticker = (stats.params && stats.params.ticker) ? stats.params.ticker : "-";
        var _rStock = (stats.params && stats.params.expectedReturn != null) ? stats.params.expectedReturn : 0;
        html += '<div class="stats-info-row"><span>' + t("stats.stockInfo") + '</span><span>' + _ticker + '</span></div>' +
                '<div class="stats-info-row"><span>' + t("stats.field.expectedReturn") + '</span><span>' + (Math.round(_rStock * 10) / 10) + '%</span></div>';
      } else if (stats.type === "deposit") {
        var _depRateV = (stats.params && stats.params.rate != null) ? stats.params.rate : 0;
        var _depTermV = (stats.params && stats.params.termMonths != null) ? stats.params.termMonths : 0;
        var _depCapV = (stats.params && stats.params.capitalization) || "monthly";
        var _capLabel = t("stats.cap." + _depCapV);
        var _effRate = getStorageExpectedReturn(stats);
        html += '<div class="stats-info-row"><span>' + t("stats.field.depositRate") + '</span><span>' + (Math.round(_depRateV * 10) / 10) + '%</span></div>' +
                '<div class="stats-info-row"><span>' + t("stats.field.depositTerm") + '</span><span>' + _depTermV + '</span></div>' +
                '<div class="stats-info-row"><span>' + t("stats.field.capitalization") + '</span><span>' + _capLabel + '</span></div>' +
                '<div class="stats-info-row"><span>' + t("stats.depositInfo") + '</span><span>' + (Math.round(_effRate * 10) / 10) + '%</span></div>';
      } else if (stats.type === "metals") {
        var _metalV = (stats.params && stats.params.metal) || "gold";
        var _rMetal = (stats.params && stats.params.expectedReturn != null) ? stats.params.expectedReturn : 0;
        html += '<div class="stats-info-row"><span>' + t("stats.metalInfo") + '</span><span>' + t("stats.metal." + _metalV) + '</span></div>' +
                '<div class="stats-info-row"><span>' + t("stats.field.expectedReturn") + '</span><span>' + (Math.round(_rMetal * 10) / 10) + '%</span></div>';
      }
      _expReturn = getStorageExpectedReturn(stats);
    }

    // PORTFOLIO ALLOCATION LOGIC - effective inflation drives the rest of the card.
    var _effInfl = _baselineInfl - _expReturn;
    var inflRate = _effInfl / 100;
    var result = calculateInflationAdjustedValue(amount, inflRate, monthsLeft);
    var goalVal = parseNumber(goalInput ? goalInput.value || "0" : "0");
    var comp = calculateInflationCompensation(goalVal, monthsLeft, inflRate);

    if (result || comp) {
      var timeStr = "";
      if (result) {
        if (result.years < 1) {
          var months = Math.round(result.years * 12);
          var mUnit = months === 1 ? t("stats.monthUnit1") : (months >= 2 && months <= 4 ? t("stats.monthUnit2_4") : t("stats.monthUnit5"));
          timeStr = t("stats.inMonths", { n: months, unit: mUnit });
        } else {
          timeStr = t("stats.inYears", { n: result.years.toFixed(1) });
        }
      }

      html += '<div class="inflation-card">';

      if (timeStr) {
        html += '<div class="inflation-time">' + timeStr + '</div>';
        // PORTFOLIO ALLOCATION LOGIC - disclaimer shows the effective inflation
        // (after subtracting weighted yield) so users see what actually drives
        // the loss in the card below.
        if (_effInfl > 0) {
          var _pctStr = (Math.round(_effInfl * 10) / 10).toString();
          html += '<div class="inflation-disclaimer">' + t("stats.inflationDisclaimer", { pct: _pctStr }) + '</div>';
        }
      }

      if (result) {
        html +=
          '<div class="stats-purchasing-label">' + t("stats.purchasingLabel") + '</div>' +
          '<div class="stats-purchasing-value">' + fmtConverted(result.adjustedValue) + ' ' + getCurrencySymbol() + '</div>' +
          '<div class="loss-inflation">' +
            t("stats.inflationLoss") +
            '<br>−' + fmtConverted(result.loss) + ' ' + getCurrencySymbol() + ' ' +
            '<span class="arrow-down">↓</span>' +
          '</div>';
      }

      if (comp && comp.extraMonthly > 0) {
        html +=
          '<div class="compensation-block">' +
            '<div class="compensation-label">' + t("stats.compensationLabel") + '</div>' +
            '<div class="extra-monthly">+' + fmtConverted(comp.extraMonthly) + ' ' + getCurrencySymbol() + ' ' + t("stats.extraMonthly") + '</div>' +
          '</div>';
      }

      html += '</div>';
    } else if (_effInfl < 0 && amount > 0 && monthsLeft > 0 && isFinite(monthsLeft)) {
      // NEW: Storage type - yield outpaces inflation → real gain UI
      var _years = monthsLeft / 12;
      var _grownVal = Math.round(amount * Math.pow(1 + Math.abs(inflRate), _years));
      var _gain = _grownVal - amount;
      var _gainPct = (Math.round(_expReturn * 10) / 10).toString();
      html += '<div class="inflation-card">' +
        '<div class="inflation-time" style="color:#6ee7b7;">+' + _gainPct + '% ' + t("stats.realReturn") + '</div>' +
        '<div class="inflation-disclaimer">' + t("stats.realReturnPositive") + '</div>' +
        '<div class="stats-purchasing-label">' + t("stats.purchasingLabel") + '</div>' +
        '<div class="stats-purchasing-value">' + fmtConverted(_grownVal) + ' ' + getCurrencySymbol() + '</div>' +
        '<div class="loss-inflation" style="color:#6ee7b7;">' +
          t("stats.purchasingGain") +
          '<br>+' + fmtConverted(_gain) + ' ' + getCurrencySymbol() + ' ' +
          '<span class="arrow-up">↑</span>' +
        '</div>' +
      '</div>';
    }

    html += '<button type="button" class="stats-change-btn" data-action="add-stats" data-account="' + accountKey + '">' + t("stats.changeBtn") + '</button>';
    html += '</div>';
    backCard.innerHTML = html;

    var isFlipped = block.querySelector(".flip-inner.flipped") !== null;
    syncAccountFlipHeight(block, isFlipped);
  });
}

document.addEventListener("click", function (e) {
  var btn = e.target.closest("[data-action='add-stats']");
  if (btn) {
    // PREMIUM SYSTEM - inline-гейт для динамической кнопки «+ Добавить статистику»
    if (window._premiumGate && window._premiumGate("stats")) return;
    var acc = btn.getAttribute("data-account") || "main";
    openAccountStatsScreen(acc);
  }
});

/* ============================================================================
 * DYNAMIC INFLATION - startup warmup + background refresh
 * ----------------------------------------------------------------------------
 * 1) Прогреваем кэш (loadInflationRates) на старте - будущие открытия экрана
 *    "Статистика счёта" получают список мгновенно.
 * 2) Для сохранённых accountStats.main / .reserve - асинхронно перевычитываем
 *    inflation_rate из БД. Если изменилась - updateState + ререндер. Не блокирует
 *    UI, не показывает спиннер; на любые ошибки fallback на старое значение.
 * ============================================================================ */
(function bootstrapInflation() {
  if (typeof window.loadInflationRates !== "function") return;
  // Чуть отложенный запуск, чтобы не конкурировать с критическим init UI.
  setTimeout(function () {
    Promise.resolve(window.loadInflationRates()).then(function (rows) {
      if (rows && rows.length) {
        _statsInflationRows = rows;
      }
      // Обновляем accountStats только если в state есть сохранённая страна.
      // PORTFOLIO ALLOCATION LOGIC - refresh both legacy `inflation` field and
      // every cash slice inside storageAllocation (each may have its own country).
      var s = (typeof getState === "function") ? getState() : null;
      var allStats = (s && s.accountStats) || {};
      var keys = ["main", "reserve"];
      var changed = false;
      var pending = [];
      keys.forEach(function (key) {
        var st = allStats[key];
        if (!st) return;

        // Legacy single-field refresh.
        if (st.country) {
          var info = STATS_COUNTRY_MAP[st.country];
          if (info && info.dbName) {
            pending.push(
              Promise.resolve(window.getInflationRate(info.dbName)).then(function (rate) {
                if (rate != null && isFinite(rate) && rate !== st.inflation) {
                  st.inflation = rate;
                  changed = true;
                }
              }).catch(function () { /* keep old */ })
            );
          }
        }

        // Portfolio cash slices refresh.
        if (Array.isArray(st.storageAllocation)) {
          st.storageAllocation.forEach(function (a) {
            if (!a || a.type !== "cash" || !a.details || !a.details.country) return;
            var aInfo = STATS_COUNTRY_MAP[a.details.country];
            if (!aInfo || !aInfo.dbName) return;
            pending.push(
              Promise.resolve(window.getInflationRate(aInfo.dbName)).then(function (rate) {
                if (rate != null && isFinite(rate) && rate !== a.details.inflation) {
                  a.details.inflation = rate;
                  changed = true;
                }
              }).catch(function () { /* keep old */ })
            );
          });
        }
      });
      Promise.all(pending).then(function () {
        if (changed) {
          var patch = {};
          keys.forEach(function (key) { if (allStats[key]) patch[key] = allStats[key]; });
          if (typeof updateState === "function") updateState({ accountStats: patch });
          if (typeof renderAccountBackCards === "function") renderAccountBackCards();
          if (typeof updatePlanHeader === "function") updatePlanHeader();
          if (typeof saveFullState === "function") saveFullState();
          console.log("[Inflation] accountStats обновлены свежими ставками из Supabase");
        }
      });
    });
  }, 1200); // после старта основного UI
})();

renderAccountBackCards();

/* ============================================================================
 * PORTFOLIO ALLOCATION + CARD EXPANSION - per-allocation deep-detail sheet
 * ----------------------------------------------------------------------------
 * Opens a premium bottom sheet when the user taps any allocation row on the
 * account back-card. Renders four sections (params / share / analytics /
 * history) tailored to the slice type. All numbers are computed live from
 * current state; goal-related calculations remain untouched.
 * ============================================================================ */
function _allocDetailParamsHtml(item) {
  if (!item) return "";
  var p = item.details || {};
  var rows = [];
  if (item.type === "cash") {
    rows.push([t("stats.country"),  p.country ? (STATS_COUNTRY_MAP[p.country] ? t(STATS_COUNTRY_MAP[p.country].labelKey) : p.country) : "-"]);
    rows.push([t("stats.currency"), p.currency || "-"]);
    rows.push([t("misc.inflation"), (p.inflation != null) ? (Math.round(p.inflation * 10) / 10) + "%" : "-"]);
  } else if (item.type === "stock") {
    rows.push([t("stats.stockInfo"), p.asset ? t("stats.asset." + p.asset) : "-"]);
    if (p.ticker) rows.push(["Ticker", p.ticker]);
    // FUTURE DEPOSITS PER ITEM - surface the per-item flag in the detail view.
    rows.push([t("stats.field.acceptsFutureDeposits.short"), p.acceptsFutureDeposits ? "✓" : "-"]);
  } else if (item.type === "metals") {
    // METALS - IN DEVELOPMENT - show the legacy chosen metal but no editable params.
    rows.push([t("stats.metalInfo"), p.metal ? t("stats.metal." + p.metal) : "-"]);
  } else if (item.type === "deposit") {
    rows.push([t("stats.field.depositRate"), (p.rate != null) ? (Math.round(p.rate * 10) / 10) + "%" : "-"]);
    rows.push([t("stats.field.depositTerm"), (p.termMonths != null) ? p.termMonths + " " + t("misc.monthShort") : "-"]);
    if (p.promoMonths > 0) {
      rows.push([t("stats.field.promoMonths"), p.promoMonths + " " + t("misc.monthShort")]);
      if (p.promoRate != null) rows.push([t("stats.field.promoRate"), (Math.round(p.promoRate * 10) / 10) + "%"]);
    }
    rows.push([t("stats.field.capitalization"), t("stats.cap." + (p.capitalization || "monthly"))]);
    // FUTURE DEPOSITS PER ITEM - prefer the new flag, fall back to legacy `replenishable`.
    var depAcc = (p.acceptsFutureDeposits != null) ? p.acceptsFutureDeposits : p.replenishable;
    rows.push([t("stats.field.acceptsFutureDeposits.short"), depAcc ? "✓" : "-"]);
  }
  var html = '<div class="alloc-detail-rows">';
  rows.forEach(function (r) {
    html += '<div class="alloc-detail-row"><span class="alloc-detail-row-label">' + r[0] + '</span><span class="alloc-detail-row-value">' + r[1] + '</span></div>';
  });
  html += '</div>';

  // MOEX INTEGRATION - placeholder for live quote; filled async in showAllocationDetail.
  if (item.type === "stock" && p.ticker) {
    html += '<div id="allocDetailMoexQuote" class="moex-quote-card is-loading" style="margin-top:12px">' +
      '<div class="moex-quote-row"><span class="moex-quote-label">' + t("stats.moex.price") + '</span><span class="moex-quote-price">' + t("stats.moex.loading") + '</span></div>' +
      '<div class="moex-quote-row"><span class="moex-quote-label">' + t("stats.moex.change") + '</span><span class="moex-quote-change muted">-</span></div>' +
      '<div class="moex-quote-source">' + t("stats.moex.source") + '</div>' +
    '</div>';
  }
  return html;
}

function _allocShareAmountStr(accountKey, percentage) {
  var bal = (accountKey === "main") ? (accounts ? accounts.main : 0) : (accounts ? accounts.reserve : 0);
  var amt = Math.round((Number(bal) || 0) * (Number(percentage) || 0) / 100);
  return fmtConverted(amt) + " " + getCurrencySymbol();
}

function _allocDetailShareHtml(accountKey, item) {
  var pct = Number(item.percentage) || 0;
  return '<div class="alloc-detail-rows">' +
    '<div class="alloc-detail-row"><span class="alloc-detail-row-label">' + t("portfolio.detail.share.percent") + '</span><span class="alloc-detail-row-value positive">' + pct + '%</span></div>' +
    '<div class="alloc-detail-row"><span class="alloc-detail-row-label">' + t("portfolio.detail.share.amount") + '</span><span class="alloc-detail-row-value">' + _allocShareAmountStr(accountKey, pct) + '</span></div>' +
  '</div>';
}

function _allocDetailAnalyticsHtml(accountKey, stats, item) {
  var expReturn = (item.type === "cash") ? 0 : getStorageExpectedReturn({ type: item.type, params: item.details });
  // Baseline inflation = cash-weighted across ACTIVE portfolio.
  var cashSum = 0, cashWeight = 0;
  (stats.storageAllocation || []).forEach(function (a) {
    if (a && !a.withdrawn && a.type === "cash" && a.details && a.details.inflation != null) {
      var w = Number(a.percentage) || 0;
      cashSum += Number(a.details.inflation) * w;
      cashWeight += w;
    }
  });
  var baselineInfl = (cashWeight > 0) ? (cashSum / cashWeight) : 0;
  var localInfl = (item.type === "cash" && item.details && item.details.inflation != null) ? Number(item.details.inflation) : baselineInfl;
  var realReturn = expReturn - localInfl; // positive = beats inflation

  var html = '<div class="alloc-detail-rows">' +
    '<div class="alloc-detail-row"><span class="alloc-detail-row-label">' + t("portfolio.detail.analytics.expectedReturn") + '</span><span class="alloc-detail-row-value ' + (expReturn > 0 ? "positive" : "muted") + '">' + (Math.round(expReturn * 10) / 10) + '%</span></div>' +
    '<div class="alloc-detail-row"><span class="alloc-detail-row-label">' + t("portfolio.detail.analytics.inflation") + '</span><span class="alloc-detail-row-value muted">' + (Math.round(localInfl * 10) / 10) + '%</span></div>' +
    '<div class="alloc-detail-row"><span class="alloc-detail-row-label">' + t("portfolio.detail.analytics.realReturn") + '</span><span class="alloc-detail-row-value ' + (realReturn > 0 ? "positive" : (realReturn < 0 ? "negative" : "muted")) + '">' + (realReturn > 0 ? "+" : "") + (Math.round(realReturn * 10) / 10) + '%</span></div>' +
  '</div>';

  // Projection block - uses goal timeline if known, otherwise show note.
  var monthsLeft = (typeof lastCalc !== "undefined" && lastCalc && lastCalc.months) ? lastCalc.months : 0;
  if (monthsLeft > 0 && isFinite(monthsLeft)) {
    var years = monthsLeft / 12;
    var bal = (accountKey === "main") ? (accounts ? accounts.main : 0) : (accounts ? accounts.reserve : 0);
    var sliceAmount = (Number(bal) || 0) * (Number(item.percentage) || 0) / 100;
    var rateFraction = realReturn / 100;
    var monthlyRate = Math.pow(1 + rateFraction, 1 / 12) - 1;
    var projectedBase = sliceAmount * Math.pow(1 + rateFraction, years);

    // FUTURE DEPOSITS PER ITEM - split the household's planned monthly savings
    // across active allocations that opted into auto-replenishment, weighted by
    // their share of the portfolio. The current item's slice grows as an
    // annuity at the same real return; non-accepting items see no top-ups.
    var accepts = !!(item.details && item.details.acceptsFutureDeposits);
    var monthlySave = (typeof lastCalc !== "undefined" && lastCalc && lastCalc.monthlySave) ? Number(lastCalc.monthlySave) : 0;
    var acceptingPctSum = 0;
    (stats.storageAllocation || []).forEach(function (a) {
      if (a && !a.withdrawn && a.details && a.details.acceptsFutureDeposits) {
        acceptingPctSum += Number(a.percentage) || 0;
      }
    });
    var monthlyShare = 0;
    if (accepts && monthlySave > 0 && acceptingPctSum > 0) {
      monthlyShare = monthlySave * ((Number(item.percentage) || 0) / acceptingPctSum);
    }

    // Annuity future value with the real monthly rate; degrades to a plain sum
    // when realReturn is 0 to avoid div-by-zero.
    var contribFV = 0;
    if (monthlyShare > 0) {
      contribFV = (Math.abs(monthlyRate) < 1e-9)
        ? monthlyShare * monthsLeft
        : monthlyShare * ((Math.pow(1 + monthlyRate, monthsLeft) - 1) / monthlyRate);
    }

    var projected = Math.round(projectedBase + contribFV);
    var delta = projected - Math.round(sliceAmount);

    var nUnit, nVal;
    if (years < 1) {
      nVal = Math.round(monthsLeft);
      nUnit = nVal === 1 ? t("stats.monthUnit1") : (nVal >= 2 && nVal <= 4 ? t("stats.monthUnit2_4") : t("stats.monthUnit5"));
    } else {
      nVal = years.toFixed(1);
      nUnit = t("misc.yearShort") || "лет";
    }

    html += '<div class="alloc-detail-section-label" style="margin-top:14px;">' + t("portfolio.detail.analytics.projection", { n: nVal, unit: nUnit }) + '</div>';
    html += '<div class="alloc-detail-metric"><div class="alloc-detail-metric-label">' + t("portfolio.detail.analytics.projectionValue") + '</div><div class="alloc-detail-metric-value">' + fmtConverted(projected) + ' ' + getCurrencySymbol() + '</div></div>';
    html += '<div class="alloc-detail-rows" style="margin-top:8px;">' +
      '<div class="alloc-detail-row"><span class="alloc-detail-row-label">' + t("portfolio.detail.analytics.projectionDelta") + '</span><span class="alloc-detail-row-value ' + (delta > 0 ? "positive" : (delta < 0 ? "negative" : "muted")) + '">' + (delta > 0 ? "+" : "") + fmtConverted(delta) + ' ' + getCurrencySymbol() + '</span></div>' +
    '</div>';
  } else {
    html += '<div class="alloc-detail-empty" style="margin-top:10px;">' + t("portfolio.detail.analytics.noProjection") + '</div>';
  }

  return html;
}

function _allocDetailHistoryHtml(item) {
  if (!item || !item.withdrawn) return "";
  var dateStr = "";
  try {
    var d = new Date(item.withdrawnAt);
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    dateStr = dd + "." + mm + "." + d.getFullYear();
  } catch (e) {}
  var snap = item.withdrawnSnapshot || {};
  return '<div class="alloc-detail-rows">' +
    '<div class="alloc-detail-row"><span class="alloc-detail-row-label">' + t("portfolio.withdrawnOn", { date: "" }).replace("{date}", "").replace(/^\s+|\s+$/g, "") + '</span><span class="alloc-detail-row-value">' + (dateStr || "-") + '</span></div>' +
    '<div class="alloc-detail-row"><span class="alloc-detail-row-label">' + t("portfolio.detail.history.snapshotShare") + '</span><span class="alloc-detail-row-value">' + (snap.percentage != null ? snap.percentage + "%" : "-") + '</span></div>' +
    '<div class="alloc-detail-row"><span class="alloc-detail-row-label">' + t("portfolio.detail.history.snapshotReturn") + '</span><span class="alloc-detail-row-value">' + (snap.expectedReturn != null ? (Math.round(snap.expectedReturn * 10) / 10) + "%" : "-") + '</span></div>' +
  '</div>';
}

function showAllocationDetail(accountKey, allocId) {
  var sheet = document.getElementById("allocDetailSheet");
  var overlay = document.getElementById("allocDetailOverlay");
  var titleEl = document.getElementById("allocDetailTitle");
  var subEl = document.getElementById("allocDetailSubtitle");
  var iconEl = document.getElementById("allocDetailHeaderIcon");
  var bodyEl = document.getElementById("allocDetailBody");
  if (!sheet || !overlay || !bodyEl) return;

  var s = getState();
  var allStats = s.accountStats || {};
  var stats = allStats[accountKey];
  if (!stats || !Array.isArray(stats.storageAllocation)) return;
  var item = stats.storageAllocation.filter(function (a) { return a && a.id === allocId; })[0];
  if (!item) return;

  // Header.
  sheet.setAttribute("data-type", item.type);
  // FIX: stable stock logos - same wrapper-based renderer (CSS-only fallback).
  if (iconEl) {
    iconEl.classList.remove("has-logo");
    if (item.type === "stock" && item.details && item.details.ticker && typeof renderStockLogoHtml === "function") {
      iconEl.classList.add("has-logo");
      iconEl.innerHTML = renderStockLogoHtml(item.details.ticker);
    } else {
      iconEl.textContent = allocTypeIcon(item.type);
    }
  }
  if (titleEl) titleEl.textContent = allocTypeLabel(item.type) + " · " + allocInstrumentLabel(item);
  if (subEl) {
    var sub = (item.percentage || 0) + "%";
    if (item.withdrawn) sub += " · " + t("portfolio.withdrawnSection").toLowerCase();
    subEl.textContent = sub;
  }

  // Body.
  var html = "";
  html += '<div><div class="alloc-detail-section-label">' + t("portfolio.detail.section.params") + '</div>' + _allocDetailParamsHtml(item) + '</div>';
  html += '<div><div class="alloc-detail-section-label">' + t("portfolio.detail.section.share") + '</div>' + _allocDetailShareHtml(accountKey, item) + '</div>';
  if (!item.withdrawn) {
    html += '<div><div class="alloc-detail-section-label">' + t("portfolio.detail.section.analytics") + '</div>' + _allocDetailAnalyticsHtml(accountKey, stats, item) + '</div>';
  } else {
    html += '<div><div class="alloc-detail-section-label">' + t("portfolio.detail.section.history") + '</div>' + _allocDetailHistoryHtml(item) + '</div>';
  }
  bodyEl.innerHTML = html;

  overlay.style.display = "block";
  sheet.style.display = "block";
  requestAnimationFrame(function () { sheet.classList.add("open"); });
  // FIX: portfolio UX v2 - hide bottom nav so the top-right close (✕) stays
  // unobstructed by the tab bar while reading allocation details.
  if (typeof hideBottomNav === "function") { try { hideBottomNav(); } catch (e) {} }

  // MOEX INTEGRATION - async-fill the live quote card if this is a stock allocation.
  if (item.type === "stock" && item.details && item.details.ticker && typeof window.fetchMoexQuote === "function") {
    var ticker = item.details.ticker;
    window.fetchMoexQuote(ticker).then(function (q) {
      var card = document.getElementById("allocDetailMoexQuote");
      if (!card) return;
      card.classList.remove("is-loading", "is-error");
      var priceEl  = card.querySelector(".moex-quote-price");
      var changeEl = card.querySelector(".moex-quote-change");
      if (!q || q.price == null) {
        card.classList.add("is-error");
        if (priceEl)  priceEl.textContent  = t("stats.moex.error");
        if (changeEl) { changeEl.textContent = "-"; changeEl.className = "moex-quote-change muted"; }
        return;
      }
      var price = Number(q.price);
      if (priceEl) priceEl.textContent = (price >= 100 ? price.toFixed(2) : price.toFixed(3)) + " ₽";
      if (changeEl) {
        var chg = (q.changePct != null) ? Number(q.changePct) : null;
        if (chg == null || !isFinite(chg)) {
          changeEl.textContent = "-";
          changeEl.className = "moex-quote-change muted";
        } else {
          changeEl.textContent = (chg > 0 ? "+" : "") + chg.toFixed(2) + "%";
          changeEl.className = "moex-quote-change " + (chg > 0 ? "positive" : (chg < 0 ? "negative" : "muted"));
        }
      }
    });
  }
}

function _closeAllocDetail() {
  var sheet = document.getElementById("allocDetailSheet");
  var overlay = document.getElementById("allocDetailOverlay");
  if (sheet) sheet.classList.remove("open");
  setTimeout(function () {
    if (sheet) sheet.style.display = "none";
    if (overlay) overlay.style.display = "none";
  }, 320);
  // FIX: portfolio UX v2 - bring the nav back after the detail sheet closes.
  if (typeof showBottomNav === "function") { try { showBottomNav(); } catch (e) {} }
}

// PORTFOLIO ALLOCATION + CARD EXPANSION - delegated click for back-card rows
// and the modal close/overlay. Lives on document so it survives any DOM
// re-render of `.account-back-content`.
document.addEventListener("click", function (e) {
  var row = e.target.closest("[data-action='alloc-detail']");
  if (row) {
    e.stopPropagation();
    showAllocationDetail(row.getAttribute("data-account") || "main", row.getAttribute("data-alloc-id") || "");
    return;
  }
  if (e.target.closest("#allocDetailClose") || e.target.id === "allocDetailOverlay") {
    _closeAllocDetail();
  }
});

/* ============================================================
 *  ADVANCED GOALS SYSTEM
 *  Multi-goal management, 3-state flip, accounts local nav,
 *  goal-management screen (priorities / deadlines / allocation)
 * ============================================================ */

(function initGoalsSystem() {

  var MAX_GOALS = 3;

  /* ───── Swipe wrapper ──────────────────────────────────── */

  var graphFlipWrapper = document.getElementById("flipWrapper");
  var graphGoalIndicator = document.getElementById("graphGoalIndicator");
  var _slideAnimating = false;

  /* ───── setActiveGoal - single entry point for switching goals ─── */

  function resetAccountFlips() {
    document.querySelectorAll(".account-block.flip-wrapper").forEach(function (block) {
      var inner = block.querySelector(".flip-inner");
      if (inner && inner.classList.contains("flipped")) {
        inner.classList.remove("flipped");
        inner.style.transition = "";
        inner.style.transform = "";
        syncAccountFlipHeight(block, false);
      }
    });
  }

  function updateFactInputVisibility() {
    var factRow = document.querySelector(".fact-input-row");
    var recordRow = document.getElementById("cashflowRecordRow");

    // Доп. цели (activeGoalIndex>0): прячем и поле факта, и кнопки записи (как было).
    if (activeGoalIndex > 0) {
      if (factRow) factRow.style.display = "none";
      if (recordRow) recordRow.style.display = "none";
      return;
    }

    var s = (typeof getState === "function") ? getState() : {};
    var isCashflow = (s.financialModel === "cashflow");
    var incomeVar = (s.incomeType || "fixed") === "variable";
    var expenseVar = (s.expenseType || "fixed") === "variable";
    // В гибкой модели (хотя бы одна сторона «Нефиксированный») показываем кнопки
    // записи вместо ручного поля «Сколько вы отложили». В простом режиме - поле.
    var showRecords = isCashflow && (incomeVar || expenseVar);

    if (showRecords && recordRow) {
      if (factRow) factRow.style.display = "none";
      recordRow.style.display = "";
      var incBtn = document.getElementById("recordIncomeBtn");
      var expBtn = document.getElementById("recordExpenseBtn");
      // Кнопка только для стороны, которая в режиме «Нефиксированный».
      if (incBtn) incBtn.style.display = incomeVar ? "" : "none";
      if (expBtn) expBtn.style.display = expenseVar ? "" : "none";
    } else {
      if (factRow) factRow.style.display = "";
      if (recordRow) recordRow.style.display = "none";
    }
  }

  function setActiveGoal(index) {
    var goals = getGoals();
    if (goals.length <= 1) index = 0;
    if (index < 0 || index >= goals.length) return;
    activeGoalIndex = index;
    updateState({ activeGoalIndex: index });
    saveFullState();
    if (typeof ProtocolGraph !== "undefined" && ProtocolGraph.hideTooltip) ProtocolGraph.hideTooltip();
    recalcPlan();
    resetAccountFlips();
    updateFactInputVisibility();
    updateAccountsLocalNav();
    updateGraphGoalIndicator();
    if (typeof renderSVGGraph === "function") renderSVGGraph();
    if (typeof updatePlanHeader === "function") updatePlanHeader();
  }

  window.setActiveGoal = setActiveGoal;
  window.updateFactInputVisibility = updateFactInputVisibility;
  window.updateGraphGoalIndicator = updateGraphGoalIndicator;
  window.updateAccountsLocalNav = updateAccountsLocalNav;

  /* ───── Graph goal slide + swipe ─────────────────────────── */

  function getGoalFaceCount() {
    return Math.min(getGoals().length, MAX_GOALS);
  }

  function setGraphFace(idx, goLeft) {
    var count = getGoalFaceCount();
    if (count <= 1) return;
    idx = ((idx % count) + count) % count;
    if (idx === activeGoalIndex || _slideAnimating) return;

    if (typeof ProtocolGraph !== "undefined" && ProtocolGraph.hideTooltip) ProtocolGraph.hideTooltip();

    var advCard = document.getElementById("adviceCard");
    if (!advCard) { setActiveGoal(idx); return; }

    if (goLeft === undefined) {
      if (activeGoalIndex === count - 1 && idx === 0) goLeft = true;
      else if (activeGoalIndex === 0 && idx === count - 1) goLeft = false;
      else goLeft = idx > activeGoalIndex;
    }

    _slideAnimating = true;

    advCard.classList.remove("swipe-dragging", "swipe-cancel", "swipe-enter");
    advCard.classList.add("swipe-exit");
    advCard.style.transform = goLeft ? "translateX(-110%)" : "translateX(110%)";
    advCard.style.opacity = "0";

    setTimeout(function () {
      advCard.classList.remove("swipe-exit");
      setActiveGoal(idx);

      advCard.style.transition = "none";
      advCard.style.transform = goLeft ? "translateX(70px)" : "translateX(-70px)";
      advCard.style.opacity = "0";

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          advCard.style.transition = "";
          advCard.classList.add("swipe-enter");
          advCard.style.transform = "translateX(0)";
          advCard.style.opacity = "1";

          setTimeout(function () {
            advCard.classList.remove("swipe-enter");
            advCard.style.transform = "";
            advCard.style.opacity = "";
            advCard.style.transition = "";
            _slideAnimating = false;
          }, 400);
        });
      });
    }, 360);
  }

  /* ───── Touch swipe: finger-following drag ───────────────── */

  if (graphFlipWrapper) {
    var _swStartX = 0;
    var _swStartY = 0;
    var _swDeltaX = 0;
    var _swActive = false;
    var _swLocked = false;
    var _swRafId = null;
    var GF_THRESHOLD = 80;

    graphFlipWrapper.addEventListener("touchstart", function (e) {
      if (_slideAnimating || !e.touches || !e.touches.length) return;
      var advCard = document.getElementById("adviceCard");
      if (!advCard) return;
      _swStartX = e.touches[0].clientX;
      _swStartY = e.touches[0].clientY;
      _swDeltaX = 0;
      _swActive = true;
      _swLocked = false;

      advCard.classList.remove("swipe-exit", "swipe-enter", "swipe-cancel");
      advCard.classList.add("swipe-dragging");
    }, { passive: true });

    graphFlipWrapper.addEventListener("touchmove", function (e) {
      if (!_swActive || !e.touches || !e.touches.length) return;

      var cx = e.touches[0].clientX;
      var cy = e.touches[0].clientY;
      var rawDx = cx - _swStartX;
      var rawDy = cy - _swStartY;

      if (!_swLocked) {
        if (Math.abs(rawDx) < 8 && Math.abs(rawDy) < 8) return;
        if (Math.abs(rawDy) > Math.abs(rawDx)) {
          _swActive = false;
          var advCard = document.getElementById("adviceCard");
          if (advCard) {
            advCard.classList.remove("swipe-dragging");
            advCard.style.transform = "";
            advCard.style.opacity = "";
          }
          return;
        }
        _swLocked = true;
      }

      e.preventDefault();
      _swDeltaX = rawDx;

      if (_swRafId) cancelAnimationFrame(_swRafId);
      _swRafId = requestAnimationFrame(function () {
        _swRafId = null;
        var advCard = document.getElementById("adviceCard");
        if (!advCard) return;
        advCard.style.transform = "translateX(" + _swDeltaX + "px)";
        var progress = Math.min(Math.abs(_swDeltaX) / 250, 1);
        advCard.style.opacity = String(1 - progress * 0.4);
      });
    }, { passive: false });

    function finishSwipe() {
      if (!_swActive && !_swLocked) return;
      _swActive = false;
      _swLocked = false;

      if (_swRafId) { cancelAnimationFrame(_swRafId); _swRafId = null; }

      var advCard = document.getElementById("adviceCard");
      if (!advCard) return;
      advCard.classList.remove("swipe-dragging");

      var count = getGoalFaceCount();
      var dx = _swDeltaX;

      if (Math.abs(dx) > GF_THRESHOLD && count > 1) {
        var goLeft = dx < 0;
        var next;
        if (goLeft) next = (activeGoalIndex + 1) % count;
        else        next = (activeGoalIndex - 1 + count) % count;

        if (typeof haptic === "function") haptic("light");
        setGraphFace(next, goLeft);
        return;
      }

      advCard.classList.add("swipe-cancel");
      advCard.style.transform = "translateX(0)";
      advCard.style.opacity = "1";
      setTimeout(function () {
        advCard.classList.remove("swipe-cancel");
        advCard.style.transform = "";
        advCard.style.opacity = "";
      }, 300);
    }

    graphFlipWrapper.addEventListener("touchend", finishSwipe);
    graphFlipWrapper.addEventListener("touchcancel", finishSwipe);
  }

  /* ───── Graph goal indicator dots ───────────────────────── */

  function updateGraphGoalIndicator() {
    if (!graphGoalIndicator) return;
    var goals = getGoals();
    if (goals.length <= 1) {
      graphGoalIndicator.classList.remove("visible");
      graphGoalIndicator.innerHTML = "";
      return;
    }
    graphGoalIndicator.classList.add("visible");
    var html = "";
    for (var i = 0; i < goals.length && i < MAX_GOALS; i++) {
      html += '<span class="graph-goal-dot' + (i === activeGoalIndex ? ' active' : '') + '" data-idx="' + i + '"></span>';
    }
    graphGoalIndicator.innerHTML = html;
    graphGoalIndicator.querySelectorAll(".graph-goal-dot").forEach(function (dot) {
      dot.addEventListener("click", function () {
        if (typeof haptic === "function") haptic("light");
        setGraphFace(Number(this.dataset.idx));
      });
    });
  }

  /* ───── Accounts Local Nav ────────────────────────────────── */

  var localNav = document.getElementById("accountsLocalNav");
  var localNavScroll = localNav ? localNav.querySelector(".accounts-local-nav-scroll") : null;
  var goalNavLottiePaths = [
    "assets/animation/Number-1-Square_.json",
    "assets/animation/Number-2-Square_.json",
    "assets/animation/Number-3-Square_.json"
  ];

  function updateAccountsLocalNav(overrideIndex) {
    if (!localNav || !localNavScroll) return;
    var goals = getGoals();
    if (goals.length <= 1) { localNav.classList.remove("visible"); return; }
    localNav.classList.add("visible");

    var activeIdx = overrideIndex !== undefined ? overrideIndex : activeGoalIndex;
    var existing = localNavScroll.querySelectorAll(".goal-nav-icon");
    var needRebuild = (existing.length !== Math.min(goals.length, MAX_GOALS));

    if (needRebuild) {
      localNavScroll.innerHTML = "";
      for (var i = 0; i < goals.length && i < MAX_GOALS; i++) {
        var btn = document.createElement("button");
        btn.className = "goal-nav-icon" + (i === activeIdx ? " active" : "");
        btn.setAttribute("data-goal-idx", String(i));
        var lottieDiv = document.createElement("div");
        lottieDiv.className = "goal-nav-lottie";
        btn.appendChild(lottieDiv);
        if (typeof lottie !== "undefined") {
          lottie.loadAnimation({
            container: lottieDiv,
            renderer: "svg",
            loop: false,
            autoplay: false,
            path: goalNavLottiePaths[i] || goalNavLottiePaths[0]
          });
        }
        btn.addEventListener("click", (function (idx) {
          return function () {
            if (typeof haptic === "function") haptic("light");
            updateAccountsLocalNav(idx);
            setActiveGoal(idx);
            renderAccountsUI();
          };
        })(i));
        localNavScroll.appendChild(btn);
      }
    } else {
      for (var j = 0; j < existing.length; j++) {
        var isActive = (j === activeIdx);
        if (existing[j].classList.contains("active") !== isActive) {
          existing[j].classList.toggle("active", isActive);
        }
      }
    }
  }

  /* ───── Advanced Emerald Cards ──────────────────────────────── */

  var advCardGoalsBtn = document.getElementById("advCardGoalsBtn");
  var advCardGoalsTitle = document.getElementById("advCardGoalsTitle");
  var advCardGoalsDesc = document.getElementById("advCardGoalsDesc");
  var advCardDeadlines = document.getElementById("advCardDeadlines");
  var advCardPriorities = document.getElementById("advCardPriorities");
  var advancedGoalsBack = document.getElementById("advancedGoalsBack");

  function showAdvancedFog() {
    var fog = document.querySelector(".advanced-fog");
    if (!fog) return;
    fog.classList.remove("advanced-fog--hidden");
    fog.classList.add("advanced-fog--visible");
  }

  function hideAdvancedFog() {
    var fog = document.querySelector(".advanced-fog");
    if (!fog) return;
    fog.classList.remove("advanced-fog--visible");
    fog.classList.add("advanced-fog--hidden");
  }

  function openAdvancedGoalsScreen() {
    goalsListCameFromAdvanced = true;
    hideAdvancedFog();
    document.getElementById("screen-advanced").classList.remove("active");
    document.getElementById("screen-advanced-goals").classList.add("active");
    renderAdvancedGoals();
  }

  function closeAdvancedGoalsScreen() {
    document.getElementById("screen-advanced-goals").classList.remove("active");
    document.getElementById("screen-advanced").classList.add("active");
    showAdvancedFog();
    updateAdvCards();
  }

  var goalTimelineDraft = null;
  var goalTimelineOriginal = null;

  function openGoalTimelineManager() {
    var real = getGoals();
    goalTimelineOriginal = JSON.parse(JSON.stringify(real));
    goalTimelineDraft = JSON.parse(JSON.stringify(real));

    hideAdvancedFog();
    document.getElementById("screen-advanced").classList.remove("active");
    document.getElementById("screen-goal-timeline").classList.add("active");
    renderGoalTimeline();
  }

  function closeGoalTimelineScreen() {
    goalTimelineDraft = null;
    goalTimelineOriginal = null;
    document.getElementById("screen-goal-timeline").classList.remove("active");
    document.getElementById("screen-advanced").classList.add("active");
    showAdvancedFog();
    updateAdvCards();
  }

  var goalPriorityDraft = null;
  var goalPriorityOriginal = null;

  function openGoalPriorityManager() {
    var real = getGoals();
    goalPriorityOriginal = JSON.parse(JSON.stringify(real));
    goalPriorityDraft = JSON.parse(JSON.stringify(real));

    hideAdvancedFog();
    document.getElementById("screen-advanced").classList.remove("active");
    document.getElementById("screen-goal-priority").classList.add("active");
    renderGoalPriority(goalPriorityDraft);
  }

  function closeGoalPriorityScreen() {
    goalPriorityDraft = null;
    goalPriorityOriginal = null;
    document.getElementById("screen-goal-priority").classList.remove("active");
    document.getElementById("screen-advanced").classList.add("active");
    showAdvancedFog();
    updateAdvCards();
  }

  /* ── "Ваши цели" / "Добавить цель" card on advanced screen ── */
  if (advCardGoalsBtn) {
    advCardGoalsBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      var goals = getGoals();
      if (goals.length === 0) {
        openAdvGoalSheet(null);
      } else {
        openAdvancedGoalsScreen();
      }
    });
  }

  window.updateGoalsButton = function () { /* no-op: goalsMainBtn removed */ };

  var goalsListCameFromAdvanced = false;

  if (advancedGoalsBack) {
    advancedGoalsBack.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      if (goalsListCameFromAdvanced) {
        closeAdvancedGoalsScreen();
      } else {
        document.body.classList.remove("advanced-active");
        openScreen("goals", buttons[3]);
        if (typeof showBottomNav === "function") showBottomNav();
        updateGoalsButton();
      }
    });
  }

  /* ── "Управление сроками" → goal-timeline ── */
  if (advCardDeadlines) {
    advCardDeadlines.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      if (getGoals().length > 0) openGoalTimelineManager();
    });
  }

  /* ── "Приоритеты" → goal-priority ── */
  if (advCardPriorities) {
    advCardPriorities.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      if (getGoals().length > 0) openGoalPriorityManager();
    });
  }

  var goalTimelineBack = document.getElementById("goalTimelineBack");
  if (goalTimelineBack) {
    goalTimelineBack.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      closeGoalTimelineScreen();
    });
  }

  var goalPriorityBack = document.getElementById("goalPriorityBack");
  if (goalPriorityBack) {
    goalPriorityBack.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      closeGoalPriorityScreen();
    });
  }

  function updateAdvCards() {
    if (!advCardGoalsTitle || !advCardGoalsDesc || !advCardGoalsBtn) return;
    advCardGoalsTitle.innerText = t("advGoals.newGoal");
    advCardGoalsDesc.innerText = t("advGoals.newGoalDesc");
    advCardGoalsBtn.classList.remove("disabled-card");
  }

  /* ───── Goal Create/Edit Sheet ─────────────────────────────── */

  var advGoalsList = document.getElementById("advancedGoalsList");
  var addGoalBtn = document.getElementById("addGoalBtn");
  var advGoalOverlay = document.getElementById("advGoalOverlay");
  var advGoalSheet = document.getElementById("advGoalSheet");
  var advGoalSheetTitle = document.getElementById("advGoalSheetTitle");
  var advGoalTitleInput = document.getElementById("advGoalTitle");
  var advGoalAmountInput = document.getElementById("advGoalAmount");
  var advGoalSave = document.getElementById("advGoalSave");
  var advPriorityToggle = document.getElementById("advPriorityToggle");
  var priorityHintEl = document.getElementById("priorityHint");

  var editingGoalId = null;
  var selectedPriority = 1;

  function getPriorityHintText(p) {
    return t("advGoals.priorityHint" + p);
  }

  function willShiftOtherGoals(priority) {
    if (editingGoalId) return false;
    var goals = getGoals();
    return goals.some(function (g) { return g.priority >= priority; });
  }

  function showPriorityHint(priority) {
    if (!priorityHintEl) return;
    var text = getPriorityHintText(priority);
    var shift = willShiftOtherGoals(priority);
    var html = '<span>' + text.replace(/\n/g, '<br>') + '</span>';
    if (shift) {
      html += '<span class="priority-hint-shift">' + t("advGoals.priorityShift") + '</span>';
    }
    priorityHintEl.innerHTML = html;
    requestAnimationFrame(function () { priorityHintEl.classList.add("visible"); });
  }

  function hidePriorityHint() {
    if (priorityHintEl) priorityHintEl.classList.remove("visible");
  }

  function getMaxAllowedPriority() {
    var goals = getGoals();
    var count = editingGoalId ? goals.length : goals.length + 1;
    return Math.min(count, MAX_GOALS);
  }

  function updatePriorityButtons() {
    if (!advPriorityToggle) return;
    var maxP = getMaxAllowedPriority();
    advPriorityToggle.querySelectorAll(".mode-btn").forEach(function (b) {
      var val = Number(b.dataset.value);
      b.classList.toggle("prio-disabled", val > maxP);
    });
  }

  function setAdvPriority(val) {
    selectedPriority = val;
    if (!advPriorityToggle) return;
    advPriorityToggle.querySelectorAll(".mode-btn").forEach(function (b) {
      b.classList.toggle("active", Number(b.dataset.value) === val);
    });
    showPriorityHint(val);
  }

  if (advPriorityToggle) {
    advPriorityToggle.querySelectorAll(".mode-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var val = Number(this.dataset.value);
        if (val > getMaxAllowedPriority()) return;
        if (typeof haptic === "function") haptic("light");
        setAdvPriority(val);
      });
    });
  }

  function openAdvGoalSheet(goalId) {
    editingGoalId = goalId || null;
    var g = goalId ? getGoalById(goalId) : null;
    if (advGoalSheetTitle) advGoalSheetTitle.innerText = g ? t("advGoals.editTitle") : t("advGoals.newGoal");
    if (advGoalTitleInput) advGoalTitleInput.value = g ? g.title : "";
    if (advGoalAmountInput) advGoalAmountInput.value = g ? formatNumber(String(g.amount || 0)) : "";
    updatePriorityButtons();
    hidePriorityHint();
    setAdvPriority(g ? g.priority : getNextFreePriority());
    ProtoSheet.open(advGoalSheet, advGoalOverlay);
  }

  function closeAdvGoalSheet() {
    ProtoSheet.close(advGoalSheet, advGoalOverlay, {
      onClosed: function () { hidePriorityHint(); }
    });
    editingGoalId = null;
  }

  function getNextFreePriority() {
    var goals = getGoals();
    var count = goals.length;
    if (count === 0) return 1;
    return Math.min(count + 1, MAX_GOALS);
  }

  if (advGoalOverlay) { advGoalOverlay.addEventListener("click", closeAdvGoalSheet); }
  ProtoSheet.initSwipe(advGoalSheet, closeAdvGoalSheet);

  if (advGoalAmountInput) {
    advGoalAmountInput.addEventListener("input", function (e) {
      e.target.value = formatNumber(e.target.value);
    });
  }

  /* ───── Priority Insertion ───────────────────────────────── */

  function insertGoalWithPriority(goals, newGoal, priority) {
    goals.forEach(function (g) {
      if (g.priority >= priority) {
        g.priority += 1;
      }
    });
    newGoal.priority = priority;
    goals.push(newGoal);
    goals.sort(function (a, b) { return a.priority - b.priority; });
  }

  /* ───── SAVE BUTTON - creates/edits goal via state-manager ── */

  function addGoal() {
    var title = advGoalTitleInput ? advGoalTitleInput.value.trim() : "";
    var amount = advGoalAmountInput ? parseNumber(advGoalAmountInput.value || "0") : 0;
    var priority = selectedPriority || 1;

    if (!title || !amount) {
      if (typeof haptic === "function") haptic("error");
      if (typeof showToast === "function") showToast(t("advGoals.fillRequired"), "error");
      return;
    }

    var goals = getGoals();

    if (editingGoalId) {
      var existing = getGoalById(editingGoalId);
      if (existing) {
        var oldPriority = existing.priority;
        existing.title = title;
        existing.amount = amount;
        if (priority !== oldPriority) {
          existing.priority = priority;
          resolvePriorityConflicts(editingGoalId, goals);
        }
        if (existing === goals[0]) {
          goalMeta.title = title;
          if (goalInput) goalInput.value = formatNumber(String(amount));
        }
      }
      goals.sort(function (a, b) { return a.priority - b.priority; });
    } else {
      if (goals.length >= MAX_GOALS) {
        if (typeof showToast === "function") showToast(t("advGoals.maxGoals"), "error");
        return;
      }
      var newGoal = {
        id: generateGoalId(),
        title: title,
        amount: amount,
        saved: 0,
        priority: 1,
        monthlyShare: 0,
        monthsLeft: 0,
        paused: false
      };
      insertGoalWithPriority(goals, newGoal, priority);
      if (goals.length === 1) {
        goalMeta.title = title;
        if (goalInput) goalInput.value = formatNumber(String(amount));
      }
    }

    computeGoalsAllocation(goals, plannedMonthly || 0);
    persistGoals(goals);

    closeAdvGoalSheet();
    recalcPlan();
    renderAdvancedGoals();
    updateAccountsLocalNav();
    updateGraphGoalIndicator();
    updateAdvCards();
    if (typeof renderGoals === "function") renderGoals();
    if (typeof renderAccountsUI === "function") renderAccountsUI();
    if (typeof renderSVGGraph === "function") renderSVGGraph();
  }

  if (advGoalSave) {
    advGoalSave.onclick = function () {
      if (typeof haptic === "function") haptic("medium");
      addGoal();
    };
  }

  function resolvePriorityConflicts(keepId, goals) {
    var byPriority = {};
    goals.forEach(function (g) {
      if (!byPriority[g.priority]) byPriority[g.priority] = [];
      byPriority[g.priority].push(g);
    });
    Object.keys(byPriority).forEach(function (p) {
      var arr = byPriority[p];
      if (arr.length <= 1) return;
      var bump = Number(p);
      arr.forEach(function (g) {
        if (g.id !== keepId) {
          bump++;
          while (bump <= MAX_GOALS && goals.some(function (x) { return x.priority === bump && x.id !== g.id; })) bump++;
          if (bump > MAX_GOALS) bump = MAX_GOALS;
          g.priority = bump;
        }
      });
    });
  }

  function deleteGoal(goalId) {
    var goals = getGoals();
    if (goals.length <= 1) return;
    var idx = -1;
    for (var i = 0; i < goals.length; i++) { if (goals[i].id === goalId) { idx = i; break; } }
    if (idx < 0) return;

    goals.splice(idx, 1);
    if (!goals.some(function (g) { return g.priority === 1; })) { goals[0].priority = 1; }
    goals.sort(function (a, b) { return a.priority - b.priority; });
    computeGoalsAllocation(goals, plannedMonthly || 0);
    persistGoals(goals);

    if (activeGoalIndex >= goals.length) activeGoalIndex = goals.length - 1;
    renderAdvancedGoals();
    setActiveGoal(activeGoalIndex);
  }

  if (addGoalBtn) {
    addGoalBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (typeof haptic === "function") haptic("light");
      openAdvGoalSheet(null);
    });
  }

  function updateAddGoalBtnVisibility() {
    if (!addGoalBtn) return;
    var goals = getGoals();
    addGoalBtn.style.display = goals.length >= MAX_GOALS ? "none" : "";
  }

  /* ───── Render: Goals List (screen-advanced-goals) ─────────── */

  function renderAdvancedGoals() {
    if (!advGoalsList) return;
    var goals = getGoals();

    updateAddGoalBtnVisibility();
    updateAdvCards();
    advGoalsList.innerHTML = "";

    goals.forEach(function (g) {
      var card = document.createElement("div");
      card.className = "adv-goal-card" + (g.priority === 1 ? " primary" : "");
      var pClass = g.priority === 1 ? "adv-goal-card-priority p1" : "adv-goal-card-priority";
      var pctDone = g.amount > 0 ? Math.min(100, Math.round(((g.saved || 0) / g.amount) * 100)) : 0;

      card.innerHTML =
        '<div class="adv-goal-card-header">' +
          '<div class="adv-goal-card-title">' + escapeHtml(g.title) + '</div>' +
          '<div class="' + pClass + '">P' + g.priority + '</div>' +
        '</div>' +
        '<div class="adv-goal-card-info">' +
          '<span>' + t("advGoals.savedLabel") + ': <b>' + fmtConverted(g.saved || 0) + ' ' + getCurrencySymbol() + '</b></span>' +
          '<span>' + t("advGoals.goalLabel") + ': <b>' + fmtConverted(g.amount || 0) + ' ' + getCurrencySymbol() + '</b></span>' +
        '</div>' +
        '<div class="adv-goal-card-info">' +
          '<span>' + t("advGoals.perMonthLabel") + ': <b>' + fmtConverted(g.monthlyShare || 0) + ' ' + getCurrencySymbol() + '</b></span>' +
          '<span>' + t("advGoals.termLabel") + ': <b>' + (g.monthsLeft || "-") + ' ' + t("advGoals.termMonths") + '</b></span>' +
        '</div>' +
        '<div class="adv-goal-card-progress">' +
          '<div style="height:4px;border-radius:4px;background:#222;overflow:hidden">' +
            '<div style="height:100%;width:' + pctDone + '%;background:#3a7bfd;transition:width .4s ease"></div>' +
          '</div>' +
          '<div style="font-size:12px;opacity:.5;margin-top:3px">' + pctDone + '%</div>' +
        '</div>' +
        '<div class="adv-goal-card-actions">' +
          (g.priority === 1 ? '' : '<button class="adv-goal-edit-btn" data-goal-id="' + g.id + '">' + t("advGoals.editBtn") + '</button>') +
          (goals.length > 1 ? '<button class="adv-goal-delete-btn" data-goal-id="' + g.id + '">' + t("advGoals.deleteBtn") + '</button>' : '') +
        '</div>';
      advGoalsList.appendChild(card);
    });

    advGoalsList.querySelectorAll(".adv-goal-edit-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (typeof haptic === "function") haptic("light");
        openAdvGoalSheet(this.dataset.goalId);
      });
    });
    advGoalsList.querySelectorAll(".adv-goal-delete-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (typeof haptic === "function") haptic("light");
        deleteGoal(this.dataset.goalId);
      });
    });
  }

  /* ───── Render: Goal Timeline (screen-goal-timeline) ───── */

  var goalTimelineAllocation = document.getElementById("goalTimelineAllocation");

  function getEffectiveDuration(draftGoal, previewGoal, minMonths) {
    if (draftGoal.timelineOverrideMonths && draftGoal.timelineOverrideMonths >= minMonths) {
      return draftGoal.timelineOverrideMonths;
    }
    return previewGoal.monthsLeft || minMonths || 1;
  }

  function renderGoalTimeline() {
    var draft = goalTimelineDraft || getGoals();
    var monthly = plannedMonthly || 0;

    if (!goalTimelineAllocation) return;
    goalTimelineAllocation.innerHTML = "";

    var preview = computeTimelinePreview(draft, monthly);

    var usedTotal = 0;
    preview.forEach(function (g) { usedTotal += (g.monthlyShare || 0); });

    if (monthly > 0 && draft.length > 0) {
      var totalEl = document.createElement("div");
      totalEl.className = "goal-mgmt-total";
      totalEl.innerHTML = t("timeline.toSavings") + ": <b>" + fmtConverted(monthly) + " " + getCurrencySymbol() + "</b>" +
        (usedTotal > monthly
          ? ' <span class="timeline-over-limit">' + t("timeline.overLimit") + ' ' + fmtConverted(usedTotal - monthly) + ' ' + getCurrencySymbol() + '</span>'
          : "");
      goalTimelineAllocation.appendChild(totalEl);
    }

    preview.forEach(function (gPreview, idx) {
      var draftGoal = draft[idx];
      var remaining = Math.max(0, (draftGoal.amount || 0) - (draftGoal.saved || 0));
      var minMonths = computeMinAllowedMonths(draftGoal, monthly);
      var isComplete = remaining <= 0;
      var isPaused = !!draftGoal.paused;
      var pctDone = draftGoal.amount > 0 ? Math.min(100, Math.round(((draftGoal.saved || 0) / draftGoal.amount) * 100)) : 0;

      var effectiveDur = getEffectiveDuration(draftGoal, gPreview, minMonths);
      var hasOverride = !!draftGoal.timelineOverrideMonths;
      var overrideInvalid = hasOverride && draftGoal.timelineOverrideMonths < minMonths;
      var requiredMonthly = effectiveDur > 0 ? Math.ceil(remaining / effectiveDur) : 0;

      var card = document.createElement("div");
      card.className = "goal-timeline-card" + (isPaused ? " paused" : "") + (isComplete ? " completed" : "");

      var pausedTag = isPaused ? '<span class="goal-prio-paused-tag">' + t("timeline.paused") + '</span>' : '';
      var completedTag = isComplete ? '<span class="goal-timeline-done-tag">' + t("timeline.completed") + '</span>' : '';

      var html =
        '<div class="goal-timeline-header">' +
          '<div class="goal-timeline-name">' + escapeHtml(draftGoal.title) + ' ' + pausedTag + completedTag + '</div>' +
        '</div>' +
        '<div class="goal-timeline-progress">' +
          '<span>' + t("timeline.pctDone", { pct: pctDone }) + '</span>' +
          '<span>' + fmtConverted(draftGoal.saved || 0) + ' / ' + fmtConverted(draftGoal.amount || 0) + ' ' + getCurrencySymbol() + '</span>' +
        '</div>';

      if (!isComplete) {
        html +=
          '<div class="goal-timeline-duration-row">' +
            '<div class="goal-timeline-duration-label">' + t("timeline.duration") + '</div>' +
            '<div class="goal-timeline-stepper" data-idx="' + idx + '">' +
              '<button class="goal-timeline-step-btn minus" data-idx="' + idx + '"' +
                (effectiveDur <= minMonths ? ' disabled' : '') + '>−</button>' +
              '<span class="goal-timeline-step-value">' + effectiveDur + ' ' + t("timeline.monthsUnit") + '</span>' +
              '<button class="goal-timeline-step-btn plus" data-idx="' + idx + '">+</button>' +
            '</div>' +
          '</div>' +
          '<div class="goal-timeline-preview">' +
            t("timeline.requiredSaving") + ': <b>' + fmtConverted(requiredMonthly) + ' ' + getCurrencySymbol() + ' ' + t("timeline.perMonth") + '</b>' +
          '</div>' +
          '<div class="goal-timeline-minmax">' +
            t("timeline.minimum") + ': ' + minMonths + ' ' + t("timeline.monthsUnit") +
            (hasOverride && !overrideInvalid
              ? ' · <span class="goal-timeline-custom-tag">' + t("timeline.customTerm") + '</span>'
              : ' · ' + t("timeline.auto")) +
          '</div>';

        if (isPaused) {
          html += '<div class="goal-timeline-paused-hint">' + t("timeline.pausedHint") + '</div>';
        }

        if (overrideInvalid) {
          html += '<div class="goal-timeline-limit-hint">' + t("timeline.unrealisticHint") + '</div>';
        } else if (effectiveDur <= minMonths && minMonths > 1) {
          html += '<div class="goal-timeline-limit-hint">' + t("timeline.minLimitHint") + '</div>';
        }
      }

      card.innerHTML = html;
      goalTimelineAllocation.appendChild(card);
    });

    goalTimelineAllocation.querySelectorAll(".goal-timeline-step-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (this.disabled) return;
        if (typeof haptic === "function") haptic("light");
        var idx = Number(this.dataset.idx);
        var draftGoal = goalTimelineDraft[idx];
        if (!draftGoal) return;

        var minMonths = computeMinAllowedMonths(draftGoal, monthly);
        var previewClone = computeTimelinePreview(goalTimelineDraft, monthly);
        var effectiveDur = getEffectiveDuration(draftGoal, previewClone[idx], minMonths);

        if (this.classList.contains("minus")) {
          var newDur = effectiveDur - 1;
          if (newDur < minMonths) return;
          draftGoal.timelineOverrideMonths = newDur;
        } else {
          draftGoal.timelineOverrideMonths = effectiveDur + 1;
        }

        renderGoalTimeline();
      });
    });

    var goalTimelineBody = document.getElementById("goalTimelineBody");
    var existingSaveBtn = document.getElementById("saveGoalTimelineBtn");
    if (!existingSaveBtn && goalTimelineBody) {
      var saveBtn = document.createElement("button");
      saveBtn.id = "saveGoalTimelineBtn";
      saveBtn.className = "advanced-settings-btn save-priority-btn";
      saveBtn.type = "button";
      saveBtn.textContent = t("timeline.saveBtn");
      goalTimelineBody.appendChild(saveBtn);
    }

    var saveTimelineBtn = document.getElementById("saveGoalTimelineBtn");
    if (saveTimelineBtn) {
      saveTimelineBtn.onclick = function () {
        if (typeof haptic === "function") haptic("medium");

        if (!goalTimelineDraft || !goalTimelineOriginal) {
          showToast(t("timeline.noChanges"), "info");
          return;
        }

        var changed = false;
        for (var i = 0; i < goalTimelineDraft.length; i++) {
          var origVal = goalTimelineOriginal[i] ? (goalTimelineOriginal[i].timelineOverrideMonths || null) : null;
          var draftVal = goalTimelineDraft[i].timelineOverrideMonths || null;
          if (origVal !== draftVal) {
            changed = true;
            break;
          }
        }

        if (!changed) {
          showToast(t("timeline.noChanges"), "info");
          return;
        }

        var realGoals = getGoals();
        goalTimelineDraft.forEach(function (dg) {
          for (var k = 0; k < realGoals.length; k++) {
            if (realGoals[k].id === dg.id) {
              var dgMin = computeMinAllowedMonths(dg, monthly);
              if (dg.timelineOverrideMonths && dg.timelineOverrideMonths >= dgMin) {
                realGoals[k].timelineOverrideMonths = dg.timelineOverrideMonths;
              } else {
                realGoals[k].timelineOverrideMonths = null;
              }
              break;
            }
          }
        });

        computeGoalsAllocation(realGoals, monthly);
        persistGoals(realGoals);
        recalcPlan();

        goalTimelineOriginal = JSON.parse(JSON.stringify(getGoals()));
        goalTimelineDraft = JSON.parse(JSON.stringify(getGoals()));
        renderGoalTimeline();

        renderGoals();
        if (typeof renderProtocolAdviceGraph === "function") renderProtocolAdviceGraph();
        renderAccountsUI();
        if (typeof updateGraphGoalIndicator === "function") updateGraphGoalIndicator();
        if (typeof updateAccountsLocalNav === "function") updateAccountsLocalNav();
        showToast(t("timeline.saved"), "success");
      };
    }
  }

  /* ───── Render: Goal Priority (screen-goal-priority) ───── */

  var goalPriorityList = document.getElementById("goalPriorityList");

  function resolveDraftPriorityConflicts(keepId, draftGoals) {
    var byPriority = {};
    draftGoals.forEach(function (g) {
      if (!byPriority[g.priority]) byPriority[g.priority] = [];
      byPriority[g.priority].push(g);
    });
    Object.keys(byPriority).forEach(function (p) {
      var arr = byPriority[p];
      if (arr.length <= 1) return;
      var bump = Number(p);
      arr.forEach(function (g) {
        if (g.id !== keepId) {
          bump++;
          while (bump <= 3 && draftGoals.some(function (x) { return x.priority === bump && x.id !== g.id; })) bump++;
          if (bump > 3) bump = 3;
          g.priority = bump;
        }
      });
    });
  }

  function renderGoalPriority(draftGoals) {
    var goals = draftGoals || getGoals();

    if (!goalPriorityList) return;

    var previewClone = JSON.parse(JSON.stringify(goals));
    computeGoalsAllocation(previewClone, plannedMonthly || 0);

    var goalPriorityBody = document.getElementById("goalPriorityBody");
    goalPriorityList.innerHTML = "";

    previewClone.forEach(function (g) {
      var card = document.createElement("div");
      card.className = "goal-mgmt-prio-card" + (g.priority === 1 ? " primary" : "");
      var pctDone = g.amount > 0 ? Math.min(100, Math.round(((g.saved || 0) / g.amount) * 100)) : 0;
      var pausedTag = g.paused ? ' <span class="goal-prio-paused-tag">' + t("timeline.paused") + '</span>' : '';
      card.innerHTML =
        '<div class="goal-mgmt-prio-header">' +
          '<div class="goal-mgmt-prio-name">' + escapeHtml(g.title) + pausedTag + '</div>' +
          '<div class="goal-mgmt-prio-badge">P' + g.priority + '</div>' +
        '</div>' +
        '<div class="goal-mgmt-prio-info">' +
          '<span>' + t("timeline.pctDone", { pct: pctDone }) + '</span>' +
          '<span>' + fmtConverted(g.saved || 0) + ' / ' + fmtConverted(g.amount || 0) + ' ' + getCurrencySymbol() + '</span>' +
        '</div>' +
        '<div class="goal-mgmt-prio-detail">' +
          t("priority.saving") + ': ' + fmtConverted(g.monthlyShare || 0) + ' ' + getCurrencySymbol() + ' ' + t("timeline.perMonth") +
          '<br>' + t("priority.goalReachedIn") + ': ' + (g.monthsLeft || "-") + ' ' + t("timeline.monthsUnit") +
        '</div>' +
        '<div class="goal-mgmt-prio-controls">' +
          '<label class="goal-mgmt-prio-label">' + t("priority.label") + '</label>' +
          '<div class="toggle-group goal-mgmt-prio-toggle" data-goal-id="' + g.id + '">' +
            '<button class="mode-btn' + (g.priority === 1 ? " active" : "") + '" data-value="1">1</button>' +
            '<button class="mode-btn' + (g.priority === 2 ? " active" : "") + '" data-value="2">2</button>' +
            '<button class="mode-btn' + (g.priority === 3 ? " active" : "") + '" data-value="3">3</button>' +
          '</div>' +
        '</div>';
      goalPriorityList.appendChild(card);
    });

    goalPriorityList.querySelectorAll(".goal-mgmt-prio-toggle").forEach(function (toggle) {
      var goalId = toggle.dataset.goalId;
      toggle.querySelectorAll(".mode-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (typeof haptic === "function") haptic("light");
          var newP = Number(this.dataset.value);

          if (goalPriorityDraft) {
            var dg = null;
            for (var i = 0; i < goalPriorityDraft.length; i++) {
              if (goalPriorityDraft[i].id === goalId) { dg = goalPriorityDraft[i]; break; }
            }
            if (!dg) return;
            dg.priority = newP;
            resolveDraftPriorityConflicts(goalId, goalPriorityDraft);
            goalPriorityDraft.sort(function (a, b) { return a.priority - b.priority; });
            renderGoalPriority(goalPriorityDraft);
          } else {
            var goal = getGoalById(goalId);
            if (!goal) return;
            goal.priority = newP;
            var g2 = getGoals();
            resolvePriorityConflicts(goalId, g2);
            g2.sort(function (a, b) { return a.priority - b.priority; });
            computeGoalsAllocation(g2, plannedMonthly || 0);
            persistGoals(g2);
            recalcPlan();
            renderGoalPriority();
            updateAccountsLocalNav();
            updateGraphGoalIndicator();
          }
        });
      });
    });

    var existingSaveBtn = document.getElementById("saveGoalPriorityBtn");
    if (!existingSaveBtn && goalPriorityBody) {
      var saveBtn = document.createElement("button");
      saveBtn.id = "saveGoalPriorityBtn";
      saveBtn.className = "advanced-settings-btn save-priority-btn";
      saveBtn.type = "button";
      saveBtn.textContent = t("priority.saveBtn");
      goalPriorityBody.appendChild(saveBtn);
    }

    var savePrioBtn = document.getElementById("saveGoalPriorityBtn");
    if (savePrioBtn) {
      savePrioBtn.onclick = function () {
        if (typeof haptic === "function") haptic("medium");

        if (!goalPriorityDraft || !goalPriorityOriginal) {
          showToast(t("priority.noChanges"), "info");
          return;
        }

        var changed = false;
        for (var i = 0; i < goalPriorityDraft.length; i++) {
          var orig = null;
          for (var j = 0; j < goalPriorityOriginal.length; j++) {
            if (goalPriorityOriginal[j].id === goalPriorityDraft[i].id) {
              orig = goalPriorityOriginal[j];
              break;
            }
          }
          if (!orig || orig.priority !== goalPriorityDraft[i].priority) {
            changed = true;
            break;
          }
        }

        if (!changed) {
          showToast(t("priority.noChanges"), "info");
          return;
        }

        var realGoals = getGoals();
        goalPriorityDraft.forEach(function (dg) {
          for (var k = 0; k < realGoals.length; k++) {
            if (realGoals[k].id === dg.id) {
              realGoals[k].priority = dg.priority;
              break;
            }
          }
        });
        realGoals.sort(function (a, b) { return a.priority - b.priority; });
        computeGoalsAllocation(realGoals, plannedMonthly || 0);
        persistGoals(realGoals);
        recalcPlan();
        renderGoalPriority(realGoals);
        renderGoals();
        if (typeof renderProtocolAdviceGraph === "function") renderProtocolAdviceGraph();
        renderAccountsUI();
        if (typeof updateGraphGoalIndicator === "function") updateGraphGoalIndicator();
        if (typeof updateAccountsLocalNav === "function") updateAccountsLocalNav();
        showToast(t("priority.saved"), "success");

        goalPriorityOriginal = JSON.parse(JSON.stringify(realGoals));
        goalPriorityDraft = JSON.parse(JSON.stringify(realGoals));
      };
    }
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ───── Initialize ─────────────────────────────────────────── */

  ensureDefaultGoal();
  var initGoals = getGoals();
  computeGoalsAllocation(initGoals, plannedMonthly || 0);
  persistGoals(initGoals);
  renderAdvancedGoals();
  updateAdvCards();

  var savedIdx = getState().activeGoalIndex || 0;
  if (savedIdx > 0 && savedIdx < initGoals.length) {
    activeGoalIndex = savedIdx;
  }

  updateAccountsLocalNav();
  updateGraphGoalIndicator();

})();

/* ===== GOAL CARD SWIPE (screen-goals) ===== */

var _goalSwipeAnimating = false;

function goalSwipeToIndex(idx, goLeft) {
  var goals = getGoals();
  var count = Math.min(goals.length, 3);
  if (count <= 1) return;
  idx = ((idx % count) + count) % count;
  if (idx === activeGoalIndex || _goalSwipeAnimating) return;

  if (typeof ProtocolGraph !== "undefined" && ProtocolGraph.hideTooltip) ProtocolGraph.hideTooltip();

  var content = document.getElementById("goalSwipeContent");
  if (!content) { setActiveGoal(idx); return; }

  if (goLeft === undefined) {
    goLeft = idx > activeGoalIndex;
  }

  _goalSwipeAnimating = true;
  content.style.transition = "transform 0.35s cubic-bezier(.4,0,.2,1), opacity 0.3s ease";
  content.style.transform = goLeft ? "translateX(-110%)" : "translateX(110%)";
  content.style.opacity = "0";

  setTimeout(function () {
    if (typeof setActiveGoal === "function") {
      setActiveGoal(idx);
    } else {
      activeGoalIndex = idx;
      updateState({ activeGoalIndex: idx });
      saveFullState();
    }
    renderGoals();

    content.style.transition = "none";
    content.style.transform = goLeft ? "translateX(70px)" : "translateX(-70px)";
    content.style.opacity = "0";

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        content.style.transition = "transform 0.35s cubic-bezier(.4,0,.2,1), opacity 0.3s ease";
        content.style.transform = "translateX(0)";
        content.style.opacity = "1";

        setTimeout(function () {
          content.style.transform = "";
          content.style.opacity = "";
          content.style.transition = "";
          _goalSwipeAnimating = false;
        }, 380);
      });
    });
  }, 350);
}

// ════════════════════════════════════════════════════════════════════════════
// PREMIUM SYSTEM
// ────────────────────────────────────────────────────────────────────────────
// Централизованная система проверки премиум-статуса и управления модалкой.
//
// Точки входа (5 штук):
//   1. changePaceBtn  - Изменить темп накоплений
//   2. addDebtsBtn    - Добавить кредиты и долги
//   3. flexibleToggle - Гибкая финансовая модель
//   4. advancedBtn    - Расширенные настройки
//   5. account flip (обратная сторона) - Статистика счёта
//
// Паттерн: каждая кнопка оборачивается через wrapPremiumGate(btn, original).
// При isPremium=false - открывается модалка. При true - выполняется original.
// Lock-анимации Lottie инициализируются один раз после DOM-ready.
// ════════════════════════════════════════════════════════════════════════════

(function initPremiumSystem() {
  // ── Helpers ────────────────────────────────────────────────────────────

  /**
   * SUBSCRIPTION MODEL - определяет, активна ли премиум-подписка СЕЙЧАС.
   *
   * Учитывает:
   *   • appState.isPremium (boolean флаг покупки)
   *   • appState.premiumUntil (дата окончания подписки, ISO-строка)
   *
   * Правила:
   *   • isPremium=false → false (нет подписки).
   *   • isPremium=true + premiumUntil > now() → true (активная подписка).
   *   • isPremium=true + premiumUntil <= now() → false (подписка истекла).
   *
   * Истёкшая подписка: локально effectivePremium=false; is_premium в БД
   * обновляет webhook/cron (клиент не пишет premium-поля).
   *
   * Экспортируется как window.isPremiumActive для использования из других
   * IIFE и тестов из консоли разработчика.
   */
  function isPremiumActive() {
    var s = (typeof getState === "function") ? getState() : (window.appState || {});
    if (s.isPremium !== true) return false;
    if (!s.premiumUntil) return false;
    var until = new Date(s.premiumUntil).getTime();
    if (isNaN(until)) return false;
    return until > Date.now();
  }

  /** Backward-compatible alias - все существующие call-site'ы используют isPremium(). */
  function isPremium() {
    return isPremiumActive();
  }

  // Экспортируем оба для внешнего использования.
  if (typeof window !== "undefined") {
    window.isPremiumActive = isPremiumActive;
  }

  /**
   * PREMIUM SYSTEM - единый перехватчик кликов через body-level capture-делегацию.
   * Это надёжнее, чем привязка к каждой кнопке отдельно, потому что:
   *   - срабатывает на ЛЮБОЙ элемент с [data-premium-gate], даже если он создан
   *     динамически (например, "+Добавить статистику" в перевёрнутой карточке);
   *   - capture phase + stopImmediatePropagation блокируют:
   *       • bubble-listeners (addEventListener),
   *       • onclick property,
   *       • document-level delegated listeners (как у data-action='add-stats');
   *   - не зависит от порядка инициализации других IIFE.
   */
  function globalGateHandler(e) {
    if (isPremium()) return;
    var target = e.target;
    if (!target || !target.closest) return;

    // 1. Прямые премиум-кнопки с data-premium-gate
    var gateBtn = target.closest("[data-premium-gate]");
    // 2. Динамическая кнопка "Добавить статистику" (внутри перевёрнутой карточки)
    var statsBtn = target.closest("[data-action='add-stats']");

    var feature = null;
    if (gateBtn) feature = gateBtn.getAttribute("data-premium-gate");
    else if (statsBtn) feature = "stats";
    else return;

    // Блокируем ВСЁ - оригинальные хендлеры (onclick, addEventListener bubble,
    // document delegation) не должны сработать.
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    if (typeof haptic === "function") haptic("light");
    openPremiumModal(feature);
  }

  // Обновляем визуальное состояние (класс premium-locked) всех gate-кнопок.
  function syncPremiumGateUI() {
    var locked = !isPremium();
    document.querySelectorAll(".premium-gate-btn").forEach(function (btn) {
      btn.classList.toggle("premium-locked", locked);
    });
    // Обратная сторона счёта - показываем/скрываем premium-hint
    var hint = document.getElementById("accountBackPremiumHint");
    if (hint) hint.style.display = locked ? "" : "none";
  }

  // ── Lottie Locks ───────────────────────────────────────────────────────
  //
  // Грузим JSON-анимацию ОДИН раз через fetch и кэшируем в _lockAnimData.
  // Затем для каждого контейнера создаём loadAnimation с `animationData`
  // (не `path`) - это надёжнее, чем 5 параллельных XHR через lottie-web,
  // и решает баг "анимация только на одной кнопке".

  var _lottieInstances = {};
  var LOCK_ANIM_PATH = "./assets/animation/Lock-2.json";
  var _lockAnimData = null;     // загруженный JSON
  var _lockAnimPromise = null;  // pending fetch

  function loadLockAnimData() {
    if (_lockAnimData) return Promise.resolve(_lockAnimData);
    if (_lockAnimPromise) return _lockAnimPromise;
    _lockAnimPromise = fetch(LOCK_ANIM_PATH)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) { _lockAnimData = json; return json; })
      .catch(function () { return null; });
    return _lockAnimPromise;
  }

  function initLockLottie(containerId, loop) {
    var el = document.getElementById(containerId);
    if (!el || typeof lottie === "undefined") return;
    if (_lottieInstances[containerId]) return; // уже инициализирован

    loadLockAnimData().then(function (data) {
      if (!data) return; // graceful - файл не найден
      if (_lottieInstances[containerId]) return; // защита от race
      try {
        _lottieInstances[containerId] = lottie.loadAnimation({
          container: el,
          renderer: "svg",
          loop: loop !== false,
          autoplay: true,
          animationData: data
        });
      } catch (e) { /* noop */ }
    });
  }

  function initAllLockLotties() {
    if (isPremium()) return; // замки не нужны если уже премиум
    initLockLottie("lottieChangePace",     true);
    initLockLottie("lottieAddDebts",       true);
    initLockLottie("lottieFlexible",       true);
    initLockLottie("lottieAdvanced",       true);
    initLockLottie("lottieAdvancedGoals",  true); // PREMIUM SYSTEM - видимая кнопка «Расширенные настройки»
    initLockLottie("lottieAccountStats",   true);
    // PREMIUM SYSTEM - динамические stats-кнопки (renderAccountBackCards рендерит их
    // ДО того, как IIFE экспортирует _initLockLottieDynamic, поэтому делаем повторную
    // попытку здесь, после старта IIFE).
    initLockLottie("lottieAccountStats_main",    true);
    initLockLottie("lottieAccountStats_reserve", true);
  }

  // Показываем/скрываем сами badge-элементы
  function syncLockBadgesVisibility() {
    var locked = !isPremium();
    ["lockChangePace","lockAddDebts","lockFlexible","lockAdvanced","lockAdvancedGoals"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = locked ? "" : "none";
    });
  }

  // ── Premium Modal ──────────────────────────────────────────────────────

  // PREMIUM MODAL - индекс текущего слайда
  var _currentSlide = 0;
  var _totalSlides = 5;

  // PREMIUM SLIDE VIDEOS - управление воспроизведением видео в слайдах.
  // ───────────────────────────────────────────────────────────────────────
  // Параллельно играет МАКСИМУМ одно видео - то, что соответствует
  // _currentSlide. Остальные ставим на pause(). Это экономит CPU/батарею
  // на iOS (5 одновременных <video> декодеров просаживают FPS sheet'а).
  //
  // Учёт пользовательской настройки:
  //   settings.disableLoadingVideo === true → ВСЕ видео скрываются
  //   (display:none) и не играются. Та же настройка теперь отвечает за
  //   loading screen И за премиум-карусель - одной галочкой пользователь
  //   отключает все фоновые видео в приложении.
  function _arePremiumVideosDisabled() {
    var s = (typeof getState === "function") ? (getState().settings || {})
          : ((window.appState && window.appState.settings) || {});
    return s.disableLoadingVideo === true;
  }
  function _getPremiumSlideVideos() {
    return document.querySelectorAll(".premium-slide-video");
  }
  // Применяем/снимаем display:none ко всем видео в слайдах в соответствии
  // с текущей настройкой. Вызывается при открытии модалки.
  function _applyPremiumVideosVisibility() {
    var disabled = _arePremiumVideosDisabled();
    _getPremiumSlideVideos().forEach(function (v) {
      v.style.display = disabled ? "none" : "";
      if (disabled) {
        try { v.pause(); } catch (_e) { /* noop */ }
      }
    });
  }
  // PREMIUM SLIDE VIDEOS - sliding-window pre-warm стратегия.
  // ───────────────────────────────────────────────────────────────────────
  // Раньше все 5 видео имели preload="metadata" → одновременная загрузка
  // 5 файлов при открытии модалки → конкуренция за bandwidth на 3G/4G,
  // ни одно не успевало быть готовым к play() → визуально «не играют».
  //
  // Теперь стратегия: грузим только активный слайд + ОДИН сосед справа
  // и слева (т.н. sliding window размером 3). При свайпе окно сдвигается
  // - соседи начинают прогружаться ЗАГОДЯ, поэтому к моменту их активации
  // видео уже почти готово к воспроизведению.
  // Остальные слайды держим в preload="none" → нулевой сетевой трафик.
  function _prewarmSlideVideos(activeIdx) {
    if (_arePremiumVideosDisabled()) return;
    _getPremiumSlideVideos().forEach(function (v) {
      var idx = parseInt(v.getAttribute("data-premium-video"), 10);
      var distance = Math.abs(idx - activeIdx);
      if (distance <= 1) {
        // В окне - разрешаем полную загрузку. Меняем атрибут только если
        // он ещё не "auto" - лишний .load() ломает уже идущий download.
        if (v.getAttribute("preload") !== "auto") {
          v.setAttribute("preload", "auto");
          // .load() гарантирует, что новое preload значение применилось
          // и запустилась реальная загрузка. readyState === 0 = HAVE_NOTHING,
          // только в этом состоянии нужен load() - иначе уже грузится.
          if (v.readyState === 0) {
            try { v.load(); } catch (_e) { /* noop */ }
          }
        }
      } else {
        // Вне окна - освобождаем ресурсы. Снять preload-атрибут полностью
        // нельзя без .load() (старая загрузка продолжится), но мы хотя бы
        // ставим паузу - это останавливает декодер и активный сетевой fetch.
        try { v.pause(); } catch (_e) { /* noop */ }
      }
    });
  }

  // Запускает видео активного слайда. Если оно ещё не готово (readyState < 2,
  // HAVE_CURRENT_DATA), вешает one-shot canplay-listener и стартует, как только
  // браузер скажет «готов». Это решает проблему `play() rejected because no
  // data` на медленных сетях.
  function _playVideoWhenReady(v) {
    // Дублируем критичные атрибуты для надёжности на iOS WebView -
    // некоторые версии «забывают» muted/playsInline при первом .load().
    v.muted = true;
    v.playsInline = true;

    function attemptPlay() {
      try {
        var p = v.play();
        if (p && typeof p.then === "function") {
          p.catch(function (err) {
            // Если ещё не дошло до HAVE_CURRENT_DATA - ждём canplay и пробуем.
            if (v.readyState < 2) {
              v.addEventListener("canplay", attemptPlay, { once: true });
            } else {
              console.warn("[PremiumVideo] play() rejected:", err && err.message);
            }
          });
        }
      } catch (e) {
        console.warn("[PremiumVideo] play() exception:", e && e.message);
      }
    }

    if (v.readyState >= 2) {
      // Достаточно данных - играем сразу.
      attemptPlay();
    } else {
      // Не готово: ставим listener + пробуем (race-safe: если canplay
      // случится между этими двумя строками, attemptPlay сам подтянет).
      v.addEventListener("canplay", attemptPlay, { once: true });
      attemptPlay();
    }
  }

  // Запускает видео активного слайда, паузит остальные.
  // Безопасно к повторным вызовам (play() на уже играющем видео - no-op).
  function _updateActiveSlideVideo() {
    if (_arePremiumVideosDisabled()) return;
    // 1) Sliding window: грузим только current + соседей.
    _prewarmSlideVideos(_currentSlide);
    // 2) Активный слайд - пытаемся play() (с ожиданием canplay при необходимости).
    _getPremiumSlideVideos().forEach(function (v) {
      var idx = parseInt(v.getAttribute("data-premium-video"), 10);
      if (idx === _currentSlide) {
        _playVideoWhenReady(v);
      } else {
        try { v.pause(); } catch (_e) { /* noop */ }
      }
    });
  }
  // Пауза всех видео при закрытии модалки - освобождаем декодер.
  function _pauseAllPremiumVideos() {
    _getPremiumSlideVideos().forEach(function (v) {
      try { v.pause(); } catch (_e) { /* noop */ }
    });
  }

  function openPremiumModal(feature) {
    var overlay = document.getElementById("premiumOverlay");
    var sheet   = document.getElementById("premiumSheet");
    if (!overlay || !sheet) return;

    // PREMIUM MODAL - модалка всегда открывается с первого слайда,
    // независимо от того, какую премиум-кнопку нажал пользователь.
    // Параметр feature оставлен в сигнатуре для возможной аналитики.
    void feature;

    overlay.classList.remove("hidden");
    sheet.classList.remove("hidden", "sheet-leaving");
    void sheet.offsetWidth; // reflow для анимации
    sheet.classList.add("sheet-entering");

    // PREMIUM SLIDE VIDEOS - синхронизируем видимость по настройке
    // disableLoadingVideo (пользователь мог переключить её между сессиями).
    _applyPremiumVideosVisibility();

    // PREMIUM MODAL: fixed swipe stability + layout
    // goToSlide(0) ПОСЛЕ снятия .hidden - scrollLeft не работает на
    // display:none-элементах, поэтому сбрасываем позицию ТОЛЬКО когда
    // .premium-slides уже отрендерен и имеет ненулевой clientWidth.
    // Двойной rAF - гарантия, что layout полностью применился.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        goToSlide(0, false);
        // PREMIUM SLIDE VIDEOS - первый запуск видео первого слайда.
        // goToSlide() уже выставил _currentSlide=0, теперь стартуем play().
        _updateActiveSlideVideo();
      });
    });

    setTimeout(function () { sheet.classList.remove("sheet-entering"); }, 450);

    // SUBSCRIPTION MODEL: обновляем status-block (если подписка активна,
    // показываем «Premium активен до X · автопродление вкл/выкл»).
    if (typeof refreshPremiumStatusBlock === "function") refreshPremiumStatusBlock();

    // Инициализируем crown-анимацию один раз - через тот же кэш animationData.
    if (typeof lottie !== "undefined" && !_lottieInstances["__crown"]) {
      var crownEl = document.getElementById("lottiePremiumCrown");
      if (crownEl) {
        loadLockAnimData().then(function (data) {
          if (!data || _lottieInstances["__crown"]) return;
          try {
            _lottieInstances["__crown"] = lottie.loadAnimation({
              container: crownEl,
              renderer: "svg",
              loop: true,
              autoplay: true,
              animationData: data
            });
          } catch (e) { /* noop */ }
        });
      }
    }
  }

  // SUBSCRIPTION MODEL - обновляет блок текущего статуса подписки в
  // премиум-модалке. Видимость и текст полностью контролируются стейтом:
  //   • appState.isPremium && isPremiumActive() → показываем блок;
  //   • appState.premiumUntil → форматируем дату «до 18 июня»;
  //   • appState.autoRenew → «🔄 Автопродление включено» / «ℹ️ Без автопродления».
  //
  // Вызывается:
  //   1. При открытии модалки (openPremiumModal).
  //   2. После успешной оплаты (onStarsPaymentSucceeded).
  //   3. После DB-синка (syncUserAccessFlagsFromDB).
  function refreshPremiumStatusBlock() {
    var block = document.getElementById("premiumStatusBlock");
    if (!block) return;

    var s = (typeof getState === "function") ? getState() : (window.appState || {});
    var active = (typeof isPremiumActive === "function") ? isPremiumActive() : !!s.isPremium;

    if (!active || !s.premiumUntil) {
      block.style.display = "none";
      return;
    }

    // Форматируем дату в соответствии с текущим языком приложения.
    var lang = (s.settings && s.settings.language) ? s.settings.language : "ru";
    var until = new Date(s.premiumUntil);
    var dateStr = formatPremiumDate(until, lang);

    var dateEl = document.getElementById("premiumStatusUntil");
    if (dateEl) dateEl.textContent = dateStr;

    var renewEl = document.getElementById("premiumStatusAutoRenew");
    if (renewEl) {
      if (s.autoRenew === true) {
        renewEl.textContent = t("premium.status.autoRenewOn");
        renewEl.classList.add("is-on");
        renewEl.classList.remove("is-off");
      } else {
        renewEl.textContent = t("premium.status.autoRenewOff");
        renewEl.classList.add("is-off");
        renewEl.classList.remove("is-on");
      }
    }

    block.style.display = "";
  }

  // Локализованное форматирование даты для status-block.
  // RU: "18 июня", EN: "Jun 18". Совпадает с форматом из Edge Functions.
  function formatPremiumDate(d, lang) {
    var day = d.getDate();
    var m = d.getMonth();
    var monthsRu = ["января","февраля","марта","апреля","мая","июня",
      "июля","августа","сентября","октября","ноября","декабря"];
    var monthsEn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    if (lang && lang.toLowerCase().indexOf("ru") === 0) {
      return day + " " + monthsRu[m];
    }
    return monthsEn[m] + " " + day;
  }

  // Экспортируем для DB-sync кода (он лежит в другом IIFE).
  window._refreshPremiumStatusBlock = refreshPremiumStatusBlock;

  // PREMIUM PROFILE BADGE - анимированная корона (Lottie king1.json).
  // ──────────────────────────────────────────────────────────────────────────
  // Загружаем JSON один раз, кешируем в _kingAnimData; loadKingAnimData()
  // возвращает существующий промис при параллельных вызовах. Если файл
  // недоступен - graceful fallback: badge остаётся видимой, но иконка пуста
  // (нет визуального бага).
  var KING_ANIM_PATH = "./assets/animation/king1.json";
  var _kingAnimData = null;
  var _kingAnimPromise = null;
  var _kingLottieInstance = null;

  function loadKingAnimData() {
    if (_kingAnimData) return Promise.resolve(_kingAnimData);
    if (_kingAnimPromise) return _kingAnimPromise;
    _kingAnimPromise = fetch(KING_ANIM_PATH)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) { _kingAnimData = json; return json; })
      .catch(function () { return null; });
    return _kingAnimPromise;
  }

  // Lazy-init Lottie-инстанса в #profilePremiumBadgeIcon. Вызывается из
  // refreshProfilePremiumBadge() ТОЛЬКО когда badge становится видимой -
  // экономим ресурсы у пользователей без премиума.
  function ensureKingLottie() {
    if (_kingLottieInstance) return;
    var el = document.getElementById("profilePremiumBadgeIcon");
    if (!el || typeof lottie === "undefined") return;
    loadKingAnimData().then(function (data) {
      if (!data || _kingLottieInstance) return;
      try {
        _kingLottieInstance = lottie.loadAnimation({
          container: el,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: data
        });
      } catch (e) { /* graceful */ }
    });
  }

  // PREMIUM PROFILE BADGE - управляет видимостью изумрудной плашки «Premium»
  // на экране профиля. Видимость завязана на isPremiumActive() - то есть
  // одновременно appState.isPremium === true И premium_until > now().
  // При первой активации lazy-init'ит Lottie-корону.
  function refreshProfilePremiumBadge() {
    var badge = document.getElementById("profilePremiumBadge");
    if (!badge) return;
    var active = (typeof isPremiumActive === "function") ? isPremiumActive()
                  : !!(window.appState && window.appState.isPremium);
    if (active) {
      badge.classList.add("is-visible");
      badge.setAttribute("aria-hidden", "false");
      ensureKingLottie();
    } else {
      badge.classList.remove("is-visible");
      badge.setAttribute("aria-hidden", "true");
    }
  }
  window._refreshProfilePremiumBadge = refreshProfilePremiumBadge;

  function closePremiumModal() {
    var overlay = document.getElementById("premiumOverlay");
    var sheet   = document.getElementById("premiumSheet");
    if (!sheet) return;
    sheet.classList.remove("sheet-entering");
    sheet.classList.add("sheet-leaving");
    // PREMIUM SLIDE VIDEOS - паузим все видео сразу при закрытии,
    // НЕ дожидаясь анимации скрытия sheet'а - освобождаем видео-декодер.
    _pauseAllPremiumVideos();
    setTimeout(function () {
      sheet.classList.add("hidden");
      sheet.classList.remove("sheet-leaving");
      if (overlay) overlay.classList.add("hidden");
    }, 320);
  }

  // PREMIUM MODAL: fixed swipe stability + layout
  // ───────────────────────────────────────────────────────────────────────────
  // Карусель работает на нативном CSS scroll-snap (overflow-x: auto +
  // scroll-snap-type: x mandatory в .premium-slides). Это даёт:
  //   • стабильный touch на ВСЕХ слайдах (iOS WebView обрабатывает свайп сам);
  //   • нативный momentum, bounce-эффект на краях;
  //   • гарантированный snap к ближайшему слайду на отпускании;
  //   • никаких ручных touchstart/touchmove/touchend → никаких зависших состояний.
  //
  // JS отвечает только за:
  //   1. программный скролл к нужному слайду (goToSlide → element.scrollTo)
  //   2. трекинг текущего слайда через scroll-event для обновления dots
  function goToSlide(idx, animate) {
    _currentSlide = Math.max(0, Math.min(idx, _totalSlides - 1));
    var slides = document.getElementById("premiumSlides");
    if (slides) {
      var w = slides.clientWidth || 0;
      var target = _currentSlide * w;
      if (animate === false) {
        // Мгновенный jump (без smooth-scroll) - для openPremiumModal.
        slides.scrollLeft = target;
      } else {
        // Плавный программный скролл с native snap.
        try {
          slides.scrollTo({ left: target, behavior: "smooth" });
        } catch (_e) {
          // Старые iOS могут не поддерживать scrollTo с опциями.
          slides.scrollLeft = target;
        }
      }
    }
    // Dots - синхронизируем сразу (нативный scroll-event подхватит позже).
    document.querySelectorAll(".premium-dot").forEach(function (dot, i) {
      dot.classList.toggle("active", i === _currentSlide);
    });
    // PREMIUM SLIDE VIDEOS - обновляем активное видео при программном
    // переходе (тап по dot / openPremiumModal). Тот же _updateActiveSlideVideo
    // вызывается и из scroll-трекера - двойной вызов безопасен (idempotent).
    if (typeof _updateActiveSlideVideo === "function") _updateActiveSlideVideo();
  }

  // PREMIUM MODAL: fixed swipe stability + layout
  // ─────────────────────────────────────────────────────────────────────────
  // 1) Трекер активного слайда через scroll-event на .premium-slides.
  //    Сам свайп обрабатывает БРАУЗЕР через CSS scroll-snap-type: x mandatory.
  //
  // 2) JS-ассист на touchend - фиксит баг «свайп срабатывает через раз».
  //    Корневая причина: native scroll-snap решает «лететь вперёд или откатить»
  //    по СКОРОСТИ свайпа. Если палец двигался медленно - снап откатывается
  //    к исходному слайду, и пользователь видит «не сработало». Решение:
  //    на touchend смотрим НАПРАВЛЕНИЕ и ДИСТАНЦИЮ движения пальца. Если
  //    палец прошёл > 12% ширины - гарантированно переходим к соседнему
  //    слайду через scrollTo, перекрывая native snap. Скорость уже не важна.
  (function initSlideScrollTracking() {
    var slides = document.getElementById("premiumSlides");
    if (!slides) return;

    var rafPending = false;

    function syncCurrentSlideFromScroll() {
      var w = slides.clientWidth || 1;
      var idx = Math.round(slides.scrollLeft / w);
      if (idx < 0) idx = 0;
      if (idx > _totalSlides - 1) idx = _totalSlides - 1;
      if (idx === _currentSlide) return;
      _currentSlide = idx;
      document.querySelectorAll(".premium-dot").forEach(function (dot, i) {
        dot.classList.toggle("active", i === _currentSlide);
      });
      // PREMIUM SLIDE VIDEOS - стартуем видео нового активного слайда,
      // паузим предыдущее. Вызывается на каждый свайп/scroll-snap.
      _updateActiveSlideVideo();
    }

    slides.addEventListener("scroll", function () {
      // requestAnimationFrame-троттлинг - scroll-event на iOS может фaйрить
      // по 60+ раз в секунду; считаем индекс не чаще раза за кадр.
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () {
        rafPending = false;
        syncCurrentSlideFromScroll();
      });
    }, { passive: true });

    // ── JS-ассист: гарантированный snap по направлению свайпа ──
    var touchStartX = 0;
    var touchStartScrollLeft = 0;
    var hasActiveTouch = false;

    slides.addEventListener("touchstart", function (e) {
      if (!e.touches || e.touches.length !== 1) {
        hasActiveTouch = false;
        return;
      }
      touchStartX = e.touches[0].clientX;
      touchStartScrollLeft = slides.scrollLeft;
      hasActiveTouch = true;
    }, { passive: true });

    slides.addEventListener("touchend", function (e) {
      if (!hasActiveTouch) return;
      hasActiveTouch = false;
      if (!e.changedTouches || e.changedTouches.length === 0) return;

      var endX = e.changedTouches[0].clientX;
      var deltaX = endX - touchStartX;
      var w = slides.clientWidth || 1;
      // 12% от ширины - низкий порог, делает свайп очень отзывчивым,
      // но защищает от случайных микро-движений (тапы / scroll-init).
      var threshold = w * 0.12;

      var startSlideIdx = Math.round(touchStartScrollLeft / w);
      var intendedSlide = startSlideIdx;
      // PREMIUM CAROUSEL - циклический свайп. Если на последнем слайде
      // пользователь свайпает вперёд (или на первом - назад), перелистываем
      // в противоположный конец карусели через мгновенный jump (goToSlide
      // c animate=false). Smooth-scroll через 4 слайда выглядел бы как
      // длинная «обратная перемотка» - instant jump UX из Instagram Stories
      // воспринимается как естественная «петля».
      if (deltaX < -threshold) {
        if (startSlideIdx >= _totalSlides - 1) {
          if (typeof haptic === "function") haptic("light");
          goToSlide(0, false);
          return;
        }
        intendedSlide = startSlideIdx + 1;
      } else if (deltaX > threshold) {
        if (startSlideIdx <= 0) {
          if (typeof haptic === "function") haptic("light");
          goToSlide(_totalSlides - 1, false);
          return;
        }
        intendedSlide = startSlideIdx - 1;
      }

      var targetScrollLeft = intendedSlide * w;
      // rAF - даём native snap чуть-чуть стартануть, потом перехватываем
      // через scrollTo. Если native уже идёт в нужную точку - scrollTo
      // просто подтверждает её и snap завершается плавно.
      requestAnimationFrame(function () {
        if (Math.abs(slides.scrollLeft - targetScrollLeft) > 1) {
          try {
            slides.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
          } catch (_e) {
            slides.scrollLeft = targetScrollLeft;
          }
        }
      });
    }, { passive: true });

    slides.addEventListener("touchcancel", function () {
      hasActiveTouch = false;
    }, { passive: true });
  })();

  // ── Event listeners для модалки ────────────────────────────────────────

  var closeBtn   = document.getElementById("premiumCloseBtn");
  var overlay    = document.getElementById("premiumOverlay");
  var buyBtn     = document.getElementById("premiumBuyBtn");

  if (closeBtn)  closeBtn.addEventListener("click",  closePremiumModal);
  if (overlay)   overlay.addEventListener("click",   closePremiumModal);
  if (buyBtn) {
    buyBtn.addEventListener("click", buyPremiumWithStars);
  }

  // TELEGRAM STARS - обработчик нажатия на «Оформить Premium».
  // ─────────────────────────────────────────────────────────────────────────
  // Flow:
  //   1. createStarsInvoice() (supabase.js) → POST /functions/v1/create-stars-invoice
  //      → бэкенд (Edge Function) дёргает Bot API createInvoiceLink (XTR, 150⭐)
  //      → возвращает invoice_url + payload.
  //   2. tg.openInvoice(invoice_url, callback).
  //   3. callback("paid") → optimistic isPremium в appState (до webhook), success-toast,
  //      конфетти, закрытие модалки, перерисовка UI.
  //   4. callback("cancelled"|"failed") → toast с пояснением, модалка остаётся.
  //   5. Параллельно - bot webhook (stars-payment-webhook) поставит is_premium
  //      серверно из обработчика successful_payment. syncUserAccessFlagsFromDB
  //      подтвердит флаг на следующем тике (~через 1.5с).
  //
  // Функция экспортируется в window.buyPremiumWithStars - её можно вызвать
  // из любого внешнего кода / отладочной консоли.
  var _paymentInFlight = false;
  async function buyPremiumWithStars() {
    if (_paymentInFlight) return;
    if (typeof haptic === "function") haptic("medium");

    var tgApi = window.Telegram && window.Telegram.WebApp;
    if (!tgApi || typeof tgApi.openInvoice !== "function") {
      showToast(t("payment.unavailable"), "error");
      return;
    }
    if (typeof window.createStarsInvoice !== "function") {
      showToast(t("payment.unavailable"), "error");
      return;
    }

      _paymentInFlight = true;
    try {
      // SUBSCRIPTION MODEL - читаем выбор пользователя:
      //   true  → subscription invoice (Telegram списывает 150⭐ каждые 30 дней
      //           автоматически, отмена через Telegram Settings).
      //   false → одноразовая оплата на 30 дней.
      // Дефолт false: пользователь должен ЯВНО согласиться на recurring.
      var autoRenewCb = document.getElementById("premiumAutoRenew");
      var autoRenew = !!(autoRenewCb && autoRenewCb.checked);
      console.log("[Stars] buyPremiumWithStars: auto_renew=" + autoRenew);

      // Дисейблим кнопку на время запроса, чтобы не было двойных кликов.
      if (buyBtn) {
        buyBtn.disabled = true;
        buyBtn.style.opacity = "0.65";
      }
      showToast(t("payment.processing"), "info", { duration: 1800 });

      var invoice = await window.createStarsInvoice(autoRenew);
      if (!invoice || !invoice.invoice_url) {
        showToast(t("payment.failed"), "error");
        return;
      }

      tgApi.openInvoice(invoice.invoice_url, function (status) {
        // status: "paid" | "cancelled" | "failed" | "pending"
        if (status === "paid") {
          onStarsPaymentSucceeded();
        } else if (status === "cancelled") {
          showToast(t("payment.cancelled"), "info");
        } else if (status === "failed") {
          showToast(t("payment.failed"), "error");
        }
        // "pending" - Telegram сообщит позже через invoiceClosed, ничего не делаем.
      });
    } catch (e) {
      console.error("[Stars] handleBuyPremium exception:", e);
      showToast(t("payment.failed"), "error");
    } finally {
      _paymentInFlight = false;
      if (buyBtn) {
        buyBtn.disabled = false;
        buyBtn.style.opacity = "";
      }
    }
  }

  // TELEGRAM STARS - действия после успешной оплаты.
  // Оптимистично включаем premium локально + пишем в БД клиентом (страховка),
  // показываем success-UI с конфетти и закрываем модалку. Background sync
  // через ~1.5с подтвердит флаг из БД (если bot webhook сработал - там true).
  async function onStarsPaymentSucceeded() {
    try {
      if (typeof haptic === "function") haptic("success");

      // 1. Локальный state - мгновенно.
      // SUBSCRIPTION MODEL: оптимистично проставляем premium_until = +30 дней
      // и auto_renew по чекбоксу. Webhook на бэкенде поставит canonical-значения
      // через ~1-3 секунды, и syncUserAccessFlagsFromDB перепишет наши значения
      // на серверные (даты практически одинаковые).
      var autoRenewCb2 = document.getElementById("premiumAutoRenew");
      var autoRenew2 = !!(autoRenewCb2 && autoRenewCb2.checked);
      var until30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (typeof updateState === "function") {
        updateState({
          isPremium: true,
          premiumUntil: until30d,
          autoRenew: autoRenew2
        });
      } else if (window.appState) {
        window.appState.isPremium = true;
        window.appState.premiumUntil = until30d;
        window.appState.autoRenew = autoRenew2;
      }
      if (typeof saveFullState === "function") {
        try { saveFullState(); } catch (e) { console.warn("[Stars] saveFullState:", e); }
      }

      // 2. Перерисовываем premium-UI.
      if (typeof window._syncPremiumUI === "function") window._syncPremiumUI();
      if (typeof renderAccountBackCards === "function") renderAccountBackCards();
      if (typeof refreshProfileStats === "function") refreshProfileStats();
      // SUBSCRIPTION MODEL: обновляем status-block в премиум-модалке
      // (он будет виден уже на следующем открытии).
      if (typeof window._refreshPremiumStatusBlock === "function") {
        window._refreshPremiumStatusBlock();
      }

      // 3. Cloud push - premium-флаг должен немедленно улететь на другие устройства.
      if (window.CloudSync && typeof window.CloudSync.pushToCloud === "function") {
        try { window.CloudSync.pushToCloud(); } catch (e) { console.warn("[Stars] cloud push:", e); }
      }

      // 4. Success UX - конфетти + toast + закрытие модалки.
      //    Конфетти запускаем чуть раньше, чтобы пользователь увидел вспышку
      //    ДО анимации закрытия sheet'а.
      fireConfetti();
      showToast(t("payment.success.title") + " · " + t("payment.success.text"), "success", { duration: 3500 });
      setTimeout(function () { closePremiumModal(); }, 350);

      // Premium в БД выставляет только stars-payment-webhook (не клиент).
      if (typeof window.syncUserAccessFlagsFromDB === "function") {
        setTimeout(function () {
          try { window.syncUserAccessFlagsFromDB(); } catch (e) { /* graceful */ }
        }, 2000);
      }
    } catch (e) {
      console.error("[Stars] onStarsPaymentSucceeded exception:", e);
    }
  }

  // TELEGRAM STARS - премиальное конфетти после успешной оплаты.
  // ─────────────────────────────────────────────────────────────────────────
  // Лёгкая DOM-реализация без внешних зависимостей: создаём 90 цветных
  // частиц в fixed-overlay поверх всего экрана. Каждая стартует у центра,
  // получает случайное направление + вращение, и через ~3 секунды слой
  // удаляется из DOM. Цвета подобраны под премиум-палитру (золото + emerald).
  //
  // pointer-events: none - не блокирует клики по UI. z-index: 99999 -
  // выше любых модалок/тостов.
  function fireConfetti() {
    try {
      var COLORS  = ["#FFD700", "#10b981", "#34d399", "#FFFFFF", "#FBBF24", "#F59E0B", "#6EE7B7"];
      var COUNT   = 90;
      var BASE_MS = 2800;

      var layer = document.createElement("div");
      layer.setAttribute("aria-hidden", "true");
      layer.style.cssText = [
        "position:fixed",
        "inset:0",
        "pointer-events:none",
        "z-index:99999",
        "overflow:hidden"
      ].join(";");
      document.body.appendChild(layer);

      for (var i = 0; i < COUNT; i++) {
        (function () {
          var el = document.createElement("div");
          var size      = 6 + Math.random() * 8;
          var color     = COLORS[Math.floor(Math.random() * COLORS.length)];
          var startLeft = 50 + (Math.random() - 0.5) * 24; // ±12% от центра
          var spread    = (Math.random() - 0.5) * 1200;    // горизонтальный разлёт
          var fall      = 750 + Math.random() * 350;       // финальное падение вниз
          var rot       = Math.random() * 720 - 360;
          var dur       = BASE_MS + Math.random() * 1200;
          var dly       = Math.random() * 220;
          var isCircle  = Math.random() > 0.5;

          el.style.cssText = [
            "position:absolute",
            "left:" + startLeft + "%",
            "top:42%",
            "width:" + size + "px",
            "height:" + size + "px",
            "background:" + color,
            "border-radius:" + (isCircle ? "50%" : "2px"),
            "opacity:1",
            "transform:translate(0,0) rotate(0deg)",
            "box-shadow:0 0 6px " + color + "55",
            "transition:transform " + dur + "ms cubic-bezier(.18,.7,.36,1) " + dly + "ms,"
                     + "opacity " + dur + "ms ease-out " + dly + "ms"
          ].join(";");
          layer.appendChild(el);

          // Двойной rAF - гарантия, что transform применится из стартовой
          // позиции (без двойного rAF браузер может слить два style-write
          // в один frame и пропустить transition).
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              el.style.transform = "translate(" + spread + "px," + fall + "px) rotate(" + rot + "deg)";
              el.style.opacity   = "0";
            });
          });
        })();
      }

      // Чистим overlay из DOM, чтобы не копились слои при повторных оплатах.
      setTimeout(function () {
        if (layer.parentNode) layer.parentNode.removeChild(layer);
      }, BASE_MS + 2000);
    } catch (e) {
      console.warn("[Stars] fireConfetti exception:", e && e.message);
    }
  }

  // Экспортируем функции в window - пригодится для отладки и внешних вызовов.
  window.buyPremiumWithStars = buyPremiumWithStars;
  window.fireConfetti        = fireConfetti;

  // SUBSCRIPTION MODEL - deep-link `?premium=open`.
  // Когда пользователь жмёт «Вернуть Premium» в DM от бота, кнопка открывает
  // Mini App с URL `<MINI_APP_URL>?premium=open`. Здесь мы ловим параметр
  // и сразу открываем премиум-модалку, чтобы пользователю не приходилось
  // искать кнопку самому. Поддерживаем оба источника: URL query и start_param
  // (последний приходит от t.me/<bot>/<app>?startapp=premium).
  (function autoOpenPremiumModalFromDeepLink() {
    try {
      var shouldOpen = false;
      try {
        var qp = new URLSearchParams(window.location.search);
        if (qp.get("premium") === "open") shouldOpen = true;
      } catch (_e) { /* IE-graceful */ }
      try {
        var w = window.Telegram && window.Telegram.WebApp;
        var sp = w && w.initDataUnsafe && w.initDataUnsafe.start_param;
        if (sp === "premium" || sp === "premium_open") shouldOpen = true;
      } catch (_e) { /* graceful */ }
      if (!shouldOpen) return;

      // Откладываем открытие до полной готовности UI - premium-модалка
      // зависит от подгрузки state'а и инициализации dots.
      function tryOpen() {
        try {
          if (typeof openPremiumModal === "function") {
            openPremiumModal();
            console.log("[Premium] auto-opened from deep-link");
            return true;
          }
        } catch (e) { console.warn("[Premium] auto-open failed:", e && e.message); }
        return false;
      }
      if (document.readyState === "complete") {
        setTimeout(tryOpen, 600);
      } else {
        window.addEventListener("load", function () { setTimeout(tryOpen, 600); });
      }
    } catch (e) {
      console.warn("[Premium] deep-link parser exception:", e && e.message);
    }
  })();

  // TELEGRAM STARS - подписка на invoiceClosed (бекап-канал, если callback
  // openInvoice по какой-то причине не вызвался). Telegram emit'ит это
  // событие при закрытии нативного оплатного UI с тем же status'ом.
  if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.onEvent === "function") {
    try {
      window.Telegram.WebApp.onEvent("invoiceClosed", function (e) {
        if (!e || e.status !== "paid") return;
        // Если onStarsPaymentSucceeded уже отработал из callback - повторный
        // вызов идемпотентен (isPremium уже true, UI уже перерисован).
        if (typeof getState === "function" && getState().isPremium === true) return;
        onStarsPaymentSucceeded();
      });
    } catch (e) {
      console.warn("[Stars] onEvent invoiceClosed не поддерживается:", e && e.message);
    }
  }

  // Dots-навигация
  document.querySelectorAll(".premium-dot").forEach(function (dot) {
    dot.addEventListener("click", function () {
      var idx = parseInt(dot.getAttribute("data-dot"), 10);
      if (!isNaN(idx)) goToSlide(idx, true);
    });
  });

  // ── Перехват 5 премиум-точек через ЕДИНЫЙ body-capture listener ──────
  //
  // Перехватываются:
  //   1. [data-premium-gate="pace"]     - кнопка changePaceBtn
  //   2. [data-premium-gate="debts"]    - кнопка addDebtsBtn
  //   3. [data-premium-gate="flexible"] - flexibleToggle
  //   4. [data-premium-gate="advanced"] - advancedBtn (FAB)
  //   5. [data-action="add-stats"]       - динамическая кнопка статистики
  //
  // Capture phase на document.body гарантирует, что мы получаем событие
  // ДО любых других обработчиков (включая onclick=, addEventListener bubble
  // и document.addEventListener delegation для [data-action='add-stats']).
  document.body.addEventListener("click", globalGateHandler, true);
  // На всякий случай - touchend (некоторые WebView в Telegram могут не
  // диспатчить click консистентно при tap'е по кнопке с overflow).
  document.body.addEventListener("touchend", function (e) {
    // Только если это потенциальная премиум-цель - иначе пропускаем.
    var t = e.target;
    if (!t || !t.closest) return;
    if (!t.closest("[data-premium-gate],[data-action='add-stats']")) return;
    globalGateHandler(e);
  }, true);

  // ── Инициализация при старте ───────────────────────────────────────────

  syncPremiumGateUI();
  syncLockBadgesVisibility();
  // Lottie грузим чуть отложенно, чтобы не блокировать первый рендер
  setTimeout(initAllLockLotties, 800);

  // Экспортируем для возможного вызова извне (после смены isPremium)
  window._syncPremiumUI = function () {
    syncPremiumGateUI();
    syncLockBadgesVisibility();
    if (!isPremium()) initAllLockLotties();
    // PREMIUM PROFILE BADGE - изумрудная плашка «Premium» рядом с именем
    // в профиле. Обновляется вместе с остальным premium-UI.
    if (typeof window._refreshProfilePremiumBadge === "function") {
      window._refreshProfilePremiumBadge();
    }
  };

  // PREMIUM SYSTEM - экспорт inline-гейта для прямого вызова в обработчиках.
  // Если возвращает true - оригинальный обработчик должен немедленно выйти.
  // Это «belt and suspenders» дополнение к body capture: если capture phase
  // по какой-то причине не блокирует (WebView quirks) - inline-check всё равно
  // не даст функции выполниться.
  window._premiumGate = function (feature) {
    if (isPremium()) return false;
    if (typeof haptic === "function") haptic("light");
    openPremiumModal(feature);
    return true;
  };

  // PREMIUM SYSTEM - экспорт для инициализации Lottie на ДИНАМИЧЕСКИ
  // создаваемых элементах (например, кнопка «+ Добавить статистику»,
  // которую рендерит renderAccountBackCards).
  //
  // Каждый раз renderAccountBackCards делает backCard.innerHTML = "..." -
  // старый DOM-узел убивается, но _lottieInstances хранит ссылку на него
  // и initLockLottie возвращается раньше времени с пометкой «уже создан».
  // Поэтому здесь явно убиваем стэйл-инстанс и повторно инициализируем.
  window._initLockLottieDynamic = function (containerId) {
    if (_lottieInstances[containerId]) {
      try { _lottieInstances[containerId].destroy(); } catch (e) {}
      delete _lottieInstances[containerId];
    }
    initLockLottie(containerId, true);
  };
})();

/* ===== PACE CHANGE SCREEN ===== */
(function initPaceChangeScreen() {
  var changePaceBtn = document.getElementById("changePaceBtn");
  var paceBackBtn = document.getElementById("paceBack");
  var paceConfirmBtn = document.getElementById("paceConfirmBtn");
  var paceModeButtons = document.querySelectorAll("#paceModeButtons .mode-btn");
  var pacePreviewCard = document.getElementById("pacePreviewCard");

  var draftPace = null;
  var originalPace = null;

  function getPaceLabel(mode) { return t("calc.mode." + mode); }
  var paceHintEl = document.getElementById("paceHint");

  function updatePaceHint(mode) {
    if (paceHintEl) paceHintEl.textContent = t("pace.hint." + mode) || "";
  }

  function simulatePace(mode) {
    var goalVal = parseNumber(goalInput ? goalInput.value || "0" : "0");
    var incomeVal = parseNumber(incomeInput ? incomeInput.value || "0" : "0");
    var expensesVal = parseNumber(expensesInput ? expensesInput.value || "0" : "0") + getDebtMonthlyTotal();
    if (goalVal <= 0 || incomeVal <= expensesVal) return null;

    var s = getState();
    var events = assembleCashflowEvents();
    var _pePace = (typeof _partialExpenseForNow === "function") ? _partialExpenseForNow() : { status: null, paidAmount: 0 };
    var engine = new CashflowEngine({
      modelType: s.financialModel || "simple",
      baseConfig: {
        goal: goalVal,
        income: incomeVal,
        expenses: expensesVal,
        saved: initialBalance,
        mode: mode,
        hasReserve: chosenPlan === "buffer",
        currentMonthExpenseStatus: _pePace.status,
        currentMonthExpensePaidAmount: _pePace.paidAmount
      },
      events: events
    });
    var d = engine.recalculate();
    if (!d.ok) return null;
    return { monthlySave: d.monthlySave, months: d.monthsLeft };
  }

  function openPaceScreen() {
    originalPace = saveMode || "calm";
    draftPace = originalPace;

    var curLabel = getPaceLabel(originalPace);
    var curModeEl = document.getElementById("paceCurrentMode");
    var curMonthlyEl = document.getElementById("paceCurrentMonthly");
    var curMonthsEl = document.getElementById("paceCurrentMonths");
    if (curModeEl) curModeEl.textContent = curLabel;
    if (curMonthlyEl) curMonthlyEl.textContent = fmtConverted(lastCalc.monthlySave || plannedMonthly || 0);
    if (curMonthsEl) curMonthsEl.textContent = lastCalc.months || "-";

    paceModeButtons.forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === draftPace);
    });

    updatePaceHint(draftPace);
    openScreen("pace", null);
    hideBottomNav();
    updatePacePreview();
  }

  function updatePacePreview() {
    if (!pacePreviewCard) return;
    if (draftPace === originalPace) {
      pacePreviewCard.style.display = "block";
      var txtEl = document.getElementById("pacePreviewText");
      if (txtEl) txtEl.innerHTML = t("pace.current");
      var pmEl = document.getElementById("pacePreviewMonthly");
      var pmoEl = document.getElementById("pacePreviewMonths");
      if (pmEl) pmEl.textContent = fmtConverted(lastCalc.monthlySave || 0);
      if (pmoEl) pmoEl.textContent = lastCalc.months || "-";
      return;
    }

    var sim = simulatePace(draftPace);
    if (!sim) {
      pacePreviewCard.style.display = "none";
      return;
    }
    pacePreviewCard.style.display = "block";

    var curMonthly = lastCalc.monthlySave || plannedMonthly || 0;
    var curMonths = lastCalc.months || 0;
    var diff = sim.monthlySave - curMonthly;
    var monthsDiff = curMonths - sim.months;
    var txtEl = document.getElementById("pacePreviewText");

    if (diff > 0) {
      txtEl.innerHTML = t("pace.increased", {amount: fmtConverted(Math.abs(diff)) + " " + getCurrencySymbol(), months: Math.abs(monthsDiff)}).replace(/\n/g, "<br>");
    } else if (diff < 0) {
      txtEl.innerHTML = t("pace.decreased", {amount: fmtConverted(Math.abs(diff)) + " " + getCurrencySymbol(), months: Math.abs(monthsDiff)}).replace(/\n/g, "<br>");
    } else {
      txtEl.innerHTML = t("pace.current");
    }

    var pmEl = document.getElementById("pacePreviewMonthly");
    var pmoEl = document.getElementById("pacePreviewMonths");
    if (pmEl) pmEl.textContent = fmtConverted(sim.monthlySave);
    if (pmoEl) pmoEl.textContent = sim.months;
  }

  if (changePaceBtn) {
    changePaceBtn.addEventListener("click", function () {
      // PREMIUM SYSTEM - inline-гейт (защита если body capture не сработал)
      if (window._premiumGate && window._premiumGate("pace")) return;
      if (typeof haptic === "function") haptic("light");
      openPaceScreen();
      // PREMIUM TOUR - мини-онбординг при первом открытии Pace.
      if (typeof startPremiumFeatureTour === "function") {
        setTimeout(function () { startPremiumFeatureTour("pace"); }, 400);
      }
    });
  }

  paceModeButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      draftPace = btn.dataset.mode;
      paceModeButtons.forEach(function (b) {
        b.classList.toggle("active", b.dataset.mode === draftPace);
      });
      updatePaceHint(draftPace);
      updatePacePreview();
    });
  });

  if (paceBackBtn) {
    paceBackBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      draftPace = null;
      originalPace = null;
      showBottomNav();
      openScreen("calc", buttons[0]);
    });
  }

  if (paceConfirmBtn) {
    paceConfirmBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("medium");
      if (!draftPace || draftPace === originalPace) {
        showToast(t("pace.noChange"), "info");
        return;
      }

      saveMode = draftPace;
      selectedMode = draftPace;
      modeButtons.forEach(function (b) {
        b.classList.toggle("active", b.dataset.mode === draftPace);
      });

      recalcPlan();

      if (typeof renderProtocolAdviceGraph === "function") renderProtocolAdviceGraph();
      renderGoals();
      renderAccountsUI();
      if (typeof updateGraphGoalIndicator === "function") updateGraphGoalIndicator();
      if (typeof updateAccountsLocalNav === "function") updateAccountsLocalNav();

      var smEl = document.getElementById("summaryMonthly");
      var smoEl = document.getElementById("summaryMonths");
      var smoodeEl = document.getElementById("summaryMode");
      if (smEl && lastCalc.monthlySave) smEl.innerText = fmtConverted(lastCalc.monthlySave);
      if (smoEl && lastCalc.months) smoEl.innerText = lastCalc.months;
      if (smoodeEl) smoodeEl.innerText = getPaceLabel(saveMode);

      saveFullState();

      originalPace = draftPace;
      showToast(t("pace.updated"), "success");

      showBottomNav();
      openScreen("calc", buttons[0]);
    });
  }
})();

/* ===== DEBTS / CREDITS SCREEN ===== */
(function initDebtsScreen() {
  var addDebtsBtn = document.getElementById("addDebtsBtn");
  var debtsBackBtn = document.getElementById("debtsBack");
  var addDebtBtn = document.getElementById("addDebtBtn");
  var debtEntryOverlay = document.getElementById("debtEntryOverlay");
  var debtEntryNo = document.getElementById("debtEntryNo");
  var debtEntryYes = document.getElementById("debtEntryYes");
  var addDebtOverlay = document.getElementById("addDebtOverlay");
  var addDebtSheet = document.getElementById("addDebtSheet");
  var debtSaveBtn = document.getElementById("debtSaveBtn");
  var debtPlanningToggle = document.getElementById("debtPlanningToggle");
  var debtTypeToggle = document.querySelectorAll("#debtTypeToggle .mode-btn");
  var debtCardFields = document.getElementById("debtCardFields");

  function getTypeLabel(type) {
    var map = { credit: "debts.credit", debt: "debts.debt", installment: "debts.installment", card: "debts.creditCard" };
    return t(map[type] || "debts.debt");
  }
  var editingDebtId = null;

  function getDebts() {
    return getState().debts || [];
  }

  function persistDebts(debts) {
    updateState({ debts: debts.map(function (d) { return { ...d }; }) });
    saveFullState();
  }

  function openDebtsScreen() {
    advanceDebtPeriods();
    var s = getState();
    if (debtPlanningToggle) debtPlanningToggle.checked = !!s.debtPlanningMode;
    _activeDebtIdx = s.activeDebtIndex || 0;
    clampDebtIndex();

    renderDebtList();
    renderDebtSummary();
    updateDebtModeUI();
    openScreen("debts", null);

    if (!s.debtOverlaySeen && debtEntryOverlay) {
      debtEntryOverlay.classList.add("visible");
    }
  }

  function closeDebtsScreen() {
    openScreen("calc", buttons[0]);
  }

  function renderDebtSummary() {
    var debts = getDebts();
    var totalAmount = 0, totalRemaining = 0, nextPayment = null;
    debts.forEach(function (d) {
      if (d.isActive === false) return;
      totalAmount += Number(d.totalAmount) || 0;
      totalRemaining += Number(d.remainingAmount) || 0;
      if (d.nextPaymentDate) {
        var nd = new Date(d.nextPaymentDate);
        if (!nextPayment || nd < nextPayment) nextPayment = nd;
      }
    });

    var totalEl = document.getElementById("debtSummaryTotal");
    var remainEl = document.getElementById("debtSummaryRemaining");
    var nextEl = document.getElementById("debtSummaryNext");
    var statusEl = document.getElementById("debtSummaryStatus");

    if (totalEl) totalEl.textContent = fmtConverted(totalAmount) + " " + getCurrencySymbol();
    if (remainEl) remainEl.textContent = fmtConverted(totalRemaining) + " " + getCurrencySymbol();
    if (nextEl) {
      if (nextPayment) {
        nextEl.textContent = nextPayment.getDate() + " " + getMonthNameShort(nextPayment.getMonth());
      } else {
        nextEl.textContent = "-";
      }
    }

    var s = getState();
    if (statusEl) {
      if (debts.length === 0) {
        statusEl.textContent = "";
      } else if (s.debtPlanningMode) {
        statusEl.textContent = t("debts.accounted");
      } else {
        statusEl.textContent = t("debts.tracked");
      }
    }
  }

  var _activeDebtIdx = getState().activeDebtIndex || 0;

  function clampDebtIndex() {
    var debts = getDebts();
    if (debts.length === 0) { _activeDebtIdx = 0; return; }
    if (_activeDebtIdx >= debts.length) _activeDebtIdx = debts.length - 1;
    if (_activeDebtIdx < 0) _activeDebtIdx = 0;
  }

  function setActiveDebtIndex(idx) {
    var debts = getDebts();
    if (debts.length === 0) { _activeDebtIdx = 0; return; }
    _activeDebtIdx = Math.max(0, Math.min(idx, debts.length - 1));
    updateState({ activeDebtIndex: _activeDebtIdx });
    saveFullState();
  }

  function renderDebtCard(d) {
    var typeLabel = getTypeLabel(d.type);
    var _locale = getCurrentLanguage() === "en" ? "en-US" : "ru-RU";
    var endStr = d.endDate ? new Date(d.endDate).toLocaleDateString(_locale, { month: "short", year: "numeric" }) : "-";
    var nextStr = d.nextPaymentDate ? new Date(d.nextPaymentDate).toLocaleDateString(_locale, { day: "numeric", month: "short" }) : "-";

    // REALISTIC DEBT LOGIC - Russian banks - агрегированные показатели.
    var stats = getDebtStats(d);
    var isCard = d.type === "card";

    var html = '<div class="debt-item-card" data-debt-id="' + d.id + '">'
      + '<div class="debt-item-header">'
      + '<div class="debt-item-title">' + (d.title || t("misc.noTitle")) + '</div>'
      + '<span class="debt-item-type-badge">' + typeLabel + '</span>'
      + '</div>';

    // REALISTIC DEBT LOGIC - Russian banks - grace-period badge для карт.
    if (isCard && stats && stats.grace) {
      if (stats.grace.inGrace) {
        html += '<div class="debt-grace-badge debt-grace-badge--active">'
          + '<span class="debt-grace-dot"></span>'
          + t("debts.graceActive", { days: stats.grace.daysLeft })
          + '</div>';
      } else if ((Number(d.remainingAmount) || 0) > 0) {
        html += '<div class="debt-grace-badge debt-grace-badge--expired">'
          + '<span class="debt-grace-dot"></span>'
          + t("debts.graceExpired")
          + '</div>';
      }
    }

    // REALISTIC DEBT LOGIC - Russian banks - прогресс-бар выплат.
    if (stats && stats.alreadyPaidPercent >= 0 && (Number(d.totalAmount) || Number(d.loanAmount) || 0) > 0) {
      html += '<div class="debt-progress-block">'
        + '<div class="debt-progress-label">'
        + '<span>' + t("debts.alreadyPaid") + '</span>'
        + '<span>' + fmtConverted(stats.alreadyPaid) + ' ' + getCurrencySymbol() + ' • ' + stats.alreadyPaidPercent + '%</span>'
        + '</div>'
        + '<div class="debt-progress-track"><div class="debt-progress-fill" style="width:' + stats.alreadyPaidPercent + '%"></div></div>'
        + '</div>';
    }

    html += '<div class="debt-item-rows">'
      + '<div class="debt-item-row"><span>' + t("debts.totalAmount") + '</span><span>' + fmtConverted(Number(d.totalAmount) || 0) + ' ' + getCurrencySymbol() + '</span></div>'
      + '<div class="debt-item-row"><span>' + t("debts.remaining") + '</span><span>' + fmtConverted(Number(d.remainingAmount) || 0) + ' ' + getCurrencySymbol() + '</span></div>'
      + '<div class="debt-item-row"><span>' + t("debts.monthlyPayment") + '</span><span>' + fmtConverted(Number(d.monthlyPayment) || 0) + ' ' + getCurrencySymbol() + '</span></div>';

    // REALISTIC DEBT LOGIC - Russian banks - ставка и срок для кредитов.
    if (!isCard && Number(d.interestRate) > 0) {
      html += '<div class="debt-item-row"><span>' + t("debts.interestRate") + '</span><span>' + d.interestRate + '%</span></div>';
    }
    if (!isCard && Number(d.termMonths) > 0) {
      html += '<div class="debt-item-row"><span>' + t("debts.termMonths") + '</span><span>' + d.termMonths + ' ' + t("debts.monthsShort") + '</span></div>';
    }

    html += '<div class="debt-item-row"><span>' + t("debts.nextPayment") + '</span><span>' + nextStr + '</span></div>'
      + '<div class="debt-item-row"><span>' + t("debts.endDate") + '</span><span>' + endStr + '</span></div>';

    // REALISTIC DEBT LOGIC - Russian banks - поля кредитной карты.
    if (isCard && d.creditLimit) {
      html += '<div class="debt-item-row"><span>' + t("debts.creditLimit") + '</span><span>' + fmtConverted(Number(d.creditLimit) || 0) + ' ' + getCurrencySymbol() + '</span></div>';
      html += '<div class="debt-item-row"><span>' + t("debts.freeLimit") + '</span><span>' + fmtConverted(Number(d.freeLimit) || 0) + ' ' + getCurrencySymbol() + '</span></div>';
    }
    if (isCard && Number(d.interestRate) > 0) {
      html += '<div class="debt-item-row"><span>' + t("debts.interestRate") + '</span><span>' + d.interestRate + '%</span></div>';
    }
    if (isCard && stats && stats.grace && !stats.grace.inGrace && stats.grace.minPayment > 0) {
      html += '<div class="debt-item-row"><span>' + t("debts.minPayment") + '</span><span>' + fmtConverted(stats.grace.minPayment) + ' ' + getCurrencySymbol() + '</span></div>';
    }

    // REALISTIC DEBT LOGIC - Russian banks - переплата и прогноз срока.
    if (stats && stats.interestRemaining > 0) {
      html += '<div class="debt-item-row"><span>' + t("debts.interestRemaining") + '</span><span>' + fmtConverted(stats.interestRemaining) + ' ' + getCurrencySymbol() + '</span></div>';
    }
    if (stats && stats.estimatedPayoffMonths !== Infinity && stats.estimatedPayoffMonths > 0) {
      html += '<div class="debt-item-row"><span>' + t("debts.estimatedPayoff") + '</span><span>' + stats.estimatedPayoffMonths + ' ' + t("debts.monthsShort") + '</span></div>';
    }

    if (d.note) {
      html += '<div class="debt-item-row"><span>' + t("debts.note") + '</span><span>' + d.note + '</span></div>';
    }

    html += '</div>'
      + '<div class="debt-item-actions">'
      + '<button class="debt-item-history-btn" data-history-id="' + d.id + '">' + t("debts.historyBtn") + '</button>'
      + '<button class="debt-item-delete-btn" data-delete-id="' + d.id + '">' + t("debts.deleteBtn") + '</button>'
      + '</div>'
      + '</div>';
    return html;
  }

  function renderDebtSwipeIndicator() {
    var indicator = document.getElementById("debtSwipeIndicator");
    if (!indicator) return;
    var debts = getDebts();
    if (debts.length <= 1) { indicator.innerHTML = ""; return; }

    var html = "";
    debts.forEach(function (d, i) {
      html += '<span class="debt-swipe-dot' + (i === _activeDebtIdx ? ' active' : '') + '" data-didx="' + i + '"></span>';
    });
    indicator.innerHTML = html;

    indicator.querySelectorAll(".debt-swipe-dot").forEach(function (dot) {
      dot.addEventListener("click", function () {
        var target = parseInt(dot.getAttribute("data-didx"), 10);
        if (target !== _activeDebtIdx) {
          if (typeof haptic === "function") haptic("light");
          debtSwipeToIndex(target, target > _activeDebtIdx);
        }
      });
    });
  }

  function renderDebtList() {
    var cardEl = document.getElementById("debtActiveCard");
    var wrapperEl = document.getElementById("debtSwipeWrapper");
    if (!cardEl) return;
    var debts = getDebts();

    var toggleWrap = document.querySelector(".debt-planning-toggle-wrap");
    var manualBlock = document.getElementById("debtManualRepayBlock");

    if (debts.length === 0) {
      if (toggleWrap) toggleWrap.style.display = "none";
      if (manualBlock) manualBlock.style.display = "none";
      cardEl.innerHTML = '<div class="debt-empty-hint">' + t("debts.emptyHint") + '</div>';
      if (wrapperEl) wrapperEl.style.display = "";
      renderDebtSwipeIndicator();
      return;
    }

    if (toggleWrap) toggleWrap.style.display = "";
    if (manualBlock) manualBlock.style.display = "";

    clampDebtIndex();
    var d = debts[_activeDebtIdx];
    cardEl.innerHTML = renderDebtCard(d);
    if (wrapperEl) wrapperEl.style.display = "";

    renderDebtSwipeIndicator();

    cardEl.querySelectorAll(".debt-item-history-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (typeof haptic === "function") haptic("light");
        openDebtHistorySheet(btn.dataset.historyId);
      });
    });

    cardEl.querySelectorAll(".debt-item-delete-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (typeof haptic === "function") haptic("medium");
        var id = btn.dataset.deleteId;
        var debts = getDebts().filter(function (d) { return d.id !== id; });
        persistDebts(debts);
        clampDebtIndex();
        setActiveDebtIndex(_activeDebtIdx);
        renderDebtList();
        renderDebtSummary();
        updateDebtModeUI();
        recalcWithDebts();
        showToast(t("debts.deleted"), "success");
      });
    });
  }

  // ── Debt swipe system ──
  var _debtSwipeAnimating = false;

  function debtSwipeToIndex(idx, goLeft) {
    var debts = getDebts();
    if (debts.length <= 1) return;
    idx = Math.max(0, Math.min(idx, debts.length - 1));
    if (idx === _activeDebtIdx || _debtSwipeAnimating) return;

    var content = document.getElementById("debtSwipeContent");
    if (!content) { setActiveDebtIndex(idx); renderDebtList(); return; }

    _debtSwipeAnimating = true;
    content.style.transition = "transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.25s ease";
    content.style.transform = goLeft ? "translateX(-100%)" : "translateX(100%)";
    content.style.opacity = "0";

    setTimeout(function () {
      setActiveDebtIndex(idx);
      renderDebtList();

      content.style.transition = "none";
      content.style.transform = goLeft ? "translateX(60px)" : "translateX(-60px)";
      content.style.opacity = "0";

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          content.style.transition = "transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.25s ease";
          content.style.transform = "translateX(0)";
          content.style.opacity = "1";

          setTimeout(function () {
            content.style.transform = "";
            content.style.opacity = "";
            content.style.transition = "";
            _debtSwipeAnimating = false;
          }, 320);
        });
      });
    }, 300);
  }

  // ── Debt touch swipe ──
  (function initDebtSwipe() {
    var wrapper = document.getElementById("debtSwipeWrapper");
    if (!wrapper) return;

    var _dsStartX = 0, _dsStartY = 0, _dsDeltaX = 0, _dsActive = false, _dsLocked = false, _dsRafId = null;
    var DS_THRESHOLD = 60;

    wrapper.addEventListener("touchstart", function (e) {
      if (_debtSwipeAnimating) return;
      _dsStartX = e.touches[0].clientX;
      _dsStartY = e.touches[0].clientY;
      _dsDeltaX = 0;
      _dsActive = true;
      _dsLocked = false;
      var content = document.getElementById("debtSwipeContent");
      if (content) content.style.transition = "none";
    }, { passive: true });

    wrapper.addEventListener("touchmove", function (e) {
      if (!_dsActive) return;
      var rawDx = e.touches[0].clientX - _dsStartX;
      var rawDy = e.touches[0].clientY - _dsStartY;

      if (!_dsLocked) {
        if (Math.abs(rawDx) < 8 && Math.abs(rawDy) < 8) return;
        if (Math.abs(rawDy) > Math.abs(rawDx)) {
          _dsActive = false;
          var c = document.getElementById("debtSwipeContent");
          if (c) { c.style.transform = ""; c.style.opacity = ""; }
          return;
        }
        _dsLocked = true;
      }

      e.preventDefault();
      _dsDeltaX = rawDx;

      if (_dsRafId) cancelAnimationFrame(_dsRafId);
      _dsRafId = requestAnimationFrame(function () {
        _dsRafId = null;
        var content = document.getElementById("debtSwipeContent");
        if (!content) return;
        content.style.transform = "translateX(" + _dsDeltaX + "px)";
        var progress = Math.min(Math.abs(_dsDeltaX) / 200, 1);
        content.style.opacity = String(1 - progress * 0.4);
      });
    }, { passive: false });

    function finishDebtSwipe() {
      if (!_dsActive && !_dsLocked) return;
      _dsActive = false;
      _dsLocked = false;

      if (_dsRafId) { cancelAnimationFrame(_dsRafId); _dsRafId = null; }

      var content = document.getElementById("debtSwipeContent");
      if (!content) return;

      var debts = getDebts();
      var dx = _dsDeltaX;

      if (Math.abs(dx) > DS_THRESHOLD && debts.length > 1) {
        var goLeft = dx < 0;
        var next;
        if (goLeft) next = Math.min(_activeDebtIdx + 1, debts.length - 1);
        else next = Math.max(_activeDebtIdx - 1, 0);

        if (next !== _activeDebtIdx) {
          if (typeof haptic === "function") haptic("light");
          debtSwipeToIndex(next, goLeft);
          return;
        }
      }

      content.style.transition = "transform 0.25s ease, opacity 0.15s ease";
      content.style.transform = "translateX(0)";
      content.style.opacity = "1";
      setTimeout(function () {
        content.style.transform = "";
        content.style.opacity = "";
        content.style.transition = "";
      }, 260);
    }

    wrapper.addEventListener("touchend", finishDebtSwipe, { passive: true });
    wrapper.addEventListener("touchcancel", finishDebtSwipe, { passive: true });
  })();

  function recalcWithDebts() {
    var s = getState();
    if (s.debtPlanningMode) {
      recalcPlan();
      if (typeof renderProtocolAdviceGraph === "function") renderProtocolAdviceGraph();
      renderGoals();
      renderAccountsUI();
      if (typeof updateGraphGoalIndicator === "function") updateGraphGoalIndicator();
      if (typeof updateAccountsLocalNav === "function") updateAccountsLocalNav();
    }
  }

  function openAddDebtSheet(existingDebt) {
    editingDebtId = existingDebt ? existingDebt.id : null;
    var title = document.getElementById("debtTitle");
    var totalAmt = document.getElementById("debtTotalAmount");
    var remainAmt = document.getElementById("debtRemainingAmount");
    var monthlyPay = document.getElementById("debtMonthlyPayment");
    var nextDate = document.getElementById("debtNextDate");
    var endDate = document.getElementById("debtEndDate");
    var creditLim = document.getElementById("debtCreditLimit");
    var freeLim = document.getElementById("debtFreeLimit");
    var note = document.getElementById("debtNote");

    // REALISTIC DEBT LOGIC - Russian banks - новые поля формы.
    var interestRate = document.getElementById("debtInterestRate");
    var termMonths = document.getElementById("debtTermMonths");
    var graceDays = document.getElementById("debtGracePeriodDays");
    var minPct = document.getElementById("debtMinPaymentPercent");
    var creditFields = document.getElementById("debtCreditFields");

    if (existingDebt) {
      if (title) title.value = existingDebt.title || "";
      if (totalAmt) totalAmt.value = existingDebt.totalAmount ? formatNumber(String(existingDebt.totalAmount)) : "";
      if (remainAmt) remainAmt.value = existingDebt.remainingAmount ? formatNumber(String(existingDebt.remainingAmount)) : "";
      if (monthlyPay) monthlyPay.value = existingDebt.monthlyPayment ? formatNumber(String(existingDebt.monthlyPayment)) : "";
      if (nextDate) nextDate.value = existingDebt.nextPaymentDate || "";
      if (endDate) endDate.value = existingDebt.endDate || "";
      if (creditLim) creditLim.value = existingDebt.creditLimit ? formatNumber(String(existingDebt.creditLimit)) : "";
      if (freeLim) freeLim.value = existingDebt.freeLimit ? formatNumber(String(existingDebt.freeLimit)) : "";
      if (note) note.value = existingDebt.note || "";

      // REALISTIC DEBT LOGIC - Russian banks
      if (interestRate) interestRate.value = existingDebt.interestRate ? String(existingDebt.interestRate) : "";
      if (termMonths) termMonths.value = existingDebt.termMonths ? String(existingDebt.termMonths) : "";
      if (graceDays) graceDays.value = existingDebt.gracePeriodDays ? String(existingDebt.gracePeriodDays) : "";
      if (minPct) minPct.value = existingDebt.minPaymentPercent ? String(existingDebt.minPaymentPercent) : "";

      var debtType = existingDebt.type || "credit";
      debtTypeToggle.forEach(function (b) {
        b.classList.toggle("active", b.dataset.value === debtType);
      });
      if (debtCardFields) debtCardFields.style.display = debtType === "card" ? "" : "none";
      // REALISTIC DEBT LOGIC - Russian banks - блок параметров кредита скрыт
      // только для записей типа "debt" (просто долг знакомому без процентов).
      if (creditFields) creditFields.style.display = (debtType === "debt" || debtType === "card") ? "none" : "";
    } else {
      [title, totalAmt, remainAmt, monthlyPay, nextDate, endDate, creditLim, freeLim, note,
       interestRate, termMonths, graceDays, minPct].forEach(function (el) {
        if (el) el.value = "";
      });
      debtTypeToggle.forEach(function (b, i) { b.classList.toggle("active", i === 0); });
      if (debtCardFields) debtCardFields.style.display = "none";
      // REALISTIC DEBT LOGIC - Russian banks - по умолчанию активен тип "credit",
      // поэтому показываем блок процентной ставки/срока.
      if (creditFields) creditFields.style.display = "";
    }

    ProtoSheet.open(addDebtSheet, addDebtOverlay);
  }

  function closeAddDebtSheet() {
    ProtoSheet.close(addDebtSheet, addDebtOverlay);
    editingDebtId = null;
  }

  function getSelectedDebtType() {
    var active = document.querySelector("#debtTypeToggle .mode-btn.active");
    return active ? active.dataset.value : "credit";
  }

  if (addDebtsBtn) {
    addDebtsBtn.addEventListener("click", function () {
      // PREMIUM SYSTEM - inline-гейт
      if (window._premiumGate && window._premiumGate("debts")) return;
      if (typeof haptic === "function") haptic("light");
      openDebtsScreen();
      // PREMIUM TOUR - мини-онбординг при первом открытии Debts.
      if (typeof startPremiumFeatureTour === "function") {
        setTimeout(function () { startPremiumFeatureTour("debts"); }, 400);
      }
    });
  }

  if (debtsBackBtn) {
    debtsBackBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      closeDebtsScreen();
    });
  }

  if (debtEntryNo) {
    debtEntryNo.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      updateState({ debtOverlaySeen: true });
      saveFullState();
      if (debtEntryOverlay) debtEntryOverlay.classList.remove("visible");
      showToast(t("debts.entryNoToast"), "info", { duration: 6000, screenScope: "debts" });
    });
  }

  if (debtEntryYes) {
    debtEntryYes.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      updateState({ debtOverlaySeen: true });
      saveFullState();
      if (debtEntryOverlay) debtEntryOverlay.classList.remove("visible");
      showToast(t("debts.entryYesToast"), "info", { duration: 6000, screenScope: "debts" });
    });
  }

  if (addDebtBtn) {
    addDebtBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      openAddDebtSheet(null);
    });
  }

  if (addDebtOverlay) {
    addDebtOverlay.addEventListener("click", function () {
      closeAddDebtSheet();
    });
  }
  ProtoSheet.initSwipe(addDebtSheet, closeAddDebtSheet);

  debtTypeToggle.forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      debtTypeToggle.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var typeVal = btn.dataset.value;
      if (debtCardFields) debtCardFields.style.display = typeVal === "card" ? "" : "none";
      // REALISTIC DEBT LOGIC - Russian banks - блок «процентная ставка + срок»
      // нужен только для типов credit / installment. Для "debt" (личный долг
      // знакомому) и "card" (своя логика grace-периода) - скрываем.
      var creditFieldsEl = document.getElementById("debtCreditFields");
      if (creditFieldsEl) creditFieldsEl.style.display = (typeVal === "debt" || typeVal === "card") ? "none" : "";
    });
  });

  [document.getElementById("debtTotalAmount"),
   document.getElementById("debtRemainingAmount"),
   document.getElementById("debtMonthlyPayment"),
   document.getElementById("debtCreditLimit"),
   document.getElementById("debtFreeLimit")].forEach(function (el) {
    if (el) {
      el.addEventListener("input", function () {
        el.value = formatNumber(el.value);
      });
    }
  });

  // REALISTIC DEBT LOGIC - Russian banks - отдельный форматтер для
  // процентных/числовых полей: разрешаем точку как десятичный разделитель.
  function formatRateInput(el) {
    if (!el) return;
    el.addEventListener("input", function () {
      var v = el.value.replace(",", ".").replace(/[^\d.]/g, "");
      var parts = v.split(".");
      if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
      el.value = v;
    });
  }
  formatRateInput(document.getElementById("debtInterestRate"));
  formatRateInput(document.getElementById("debtMinPaymentPercent"));
  // termMonths и gracePeriodDays - целочисленные.
  [document.getElementById("debtTermMonths"),
   document.getElementById("debtGracePeriodDays")].forEach(function (el) {
    if (el) {
      el.addEventListener("input", function () {
        el.value = el.value.replace(/[^\d]/g, "");
      });
    }
  });

  if (debtSaveBtn) {
    debtSaveBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("medium");

      var titleEl = document.getElementById("debtTitle");
      var monthlyPayEl = document.getElementById("debtMonthlyPayment");
      if (!titleEl || !titleEl.value.trim()) { showToast(t("debts.noTitle"), "error"); return; }

      var type = getSelectedDebtType();

      // REALISTIC DEBT LOGIC - Russian banks - извлекаем новые параметры.
      var interestRate = parseFloat((document.getElementById("debtInterestRate") || {}).value || "0") || 0;
      var termMonths = parseInt((document.getElementById("debtTermMonths") || {}).value || "0", 10) || 0;
      var gracePeriodDays = type === "card"
        ? (parseInt((document.getElementById("debtGracePeriodDays") || {}).value || "55", 10) || 55)
        : 0;
      var minPaymentPercent = type === "card"
        ? (parseFloat((document.getElementById("debtMinPaymentPercent") || {}).value || "5") || 5)
        : 0;

      var totalAmt = parseNumber(document.getElementById("debtTotalAmount").value || "0");
      var remainAmt = parseNumber(document.getElementById("debtRemainingAmount").value || "0");
      var monthlyPayRaw = parseNumber(monthlyPayEl.value || "0");

      // REALISTIC DEBT LOGIC - Russian banks - для credit / installment, если
      // пользователь не указал ежемесячный платёж, но указал ставку и срок -
      // рассчитываем аннуитет автоматически по формуле РФ-банков.
      var monthlyPay = monthlyPayRaw;
      if ((type === "credit" || type === "installment") && monthlyPay <= 0
          && totalAmt > 0 && termMonths > 0) {
        monthlyPay = calculateAnnuityPayment(totalAmt, interestRate, termMonths);
      }

      // Карты могут не иметь monthlyPayment (выплачивается минимальный по grace).
      // Для всех остальных типов платёж обязателен.
      if (type !== "card" && (!monthlyPay || monthlyPay <= 0)) {
        showToast(t("debts.noPayment"), "error");
        return;
      }

      var entry = {
        id: editingDebtId || ("debt_" + Date.now() + "_" + Math.floor(Math.random() * 1000)),
        type: type,
        title: titleEl.value.trim(),
        totalAmount: totalAmt,
        remainingAmount: remainAmt,
        monthlyPayment: monthlyPay,
        nextPaymentDate: document.getElementById("debtNextDate").value || "",
        endDate: document.getElementById("debtEndDate").value || "",
        creditLimit: type === "card" ? parseNumber(document.getElementById("debtCreditLimit").value || "0") : 0,
        freeLimit: type === "card" ? parseNumber(document.getElementById("debtFreeLimit").value || "0") : 0,
        note: (document.getElementById("debtNote").value || "").trim(),
        isActive: true,
        paidInCurrentPeriod: 0,
        currentPeriodKey: "",
        // REALISTIC DEBT LOGIC - Russian banks
        loanAmount: totalAmt,
        interestRate: interestRate,
        termMonths: termMonths,
        startDate: "",
        gracePeriodDays: gracePeriodDays,
        minPaymentPercent: minPaymentPercent,
        lastFullPayDate: ""
      };

      var nextDateVal = document.getElementById("debtNextDate").value || "";
      if (nextDateVal) {
        var tmpD = new Date(nextDateVal);
        if (!isNaN(tmpD.getTime())) {
          entry.currentPeriodKey = tmpD.getFullYear() + "-" + String(tmpD.getMonth() + 1).padStart(2, "0");
        }
      }
      if (!entry.currentPeriodKey) {
        var nowD = new Date();
        entry.currentPeriodKey = nowD.getFullYear() + "-" + String(nowD.getMonth() + 1).padStart(2, "0");
      }

      var debts = getDebts();
      if (editingDebtId) {
        var existingDebtForEdit = debts.find(function(dd) { return dd.id === editingDebtId; });
        if (existingDebtForEdit) {
          entry.paidInCurrentPeriod = existingDebtForEdit.paidInCurrentPeriod || 0;
          entry.currentPeriodKey = existingDebtForEdit.currentPeriodKey || entry.currentPeriodKey;
          // REALISTIC DEBT LOGIC - Russian banks - сохраняем историю карты:
          // startDate (дата выдачи) и lastFullPayDate (последнее закрытие).
          entry.startDate = existingDebtForEdit.startDate || "";
          entry.lastFullPayDate = existingDebtForEdit.lastFullPayDate || "";
          // loanAmount берём исходный, если он был задан - иначе из формы.
          if (existingDebtForEdit.loanAmount > 0) {
            entry.loanAmount = existingDebtForEdit.loanAmount;
          }
        }
        for (var i = 0; i < debts.length; i++) {
          if (debts[i].id === editingDebtId) { debts[i] = entry; break; }
        }
      } else {
        // REALISTIC DEBT LOGIC - Russian banks - для нового долга фиксируем
        // дату создания как startDate (используется для карт как точка отсчёта
        // первого grace-периода, если lastFullPayDate ещё не задан).
        entry.startDate = new Date().toISOString().slice(0, 10);
        debts.push(entry);
      }
      persistDebts(debts);

      if (!editingDebtId) {
        setActiveDebtIndex(debts.length - 1);
      }

      closeAddDebtSheet();
      renderDebtList();
      renderDebtSummary();
      updateDebtModeUI();
      recalcWithDebts();
      showToast(editingDebtId ? t("debts.changesSaved") : t("debts.debtAdded"), "success");
    });
  }

  if (debtPlanningToggle) {
    debtPlanningToggle.addEventListener("change", function () {
      if (typeof haptic === "function") haptic("light");
      var enabled = debtPlanningToggle.checked;
      updateState({ debtPlanningMode: enabled });
      saveFullState();
      renderDebtSummary();
      updateDebtModeUI();
      recalcWithDebts();
      if (enabled) {
        showToast(t("debts.accountedToast"), "success");
      } else {
        showToast(t("debts.notAccountedToast"), "success");
      }
    });
  }

  function updateDebtModeUI() {
    var s = getState();
    var debts = getDebts();
    var toggleWrap = document.querySelector(".debt-planning-toggle-wrap");
    var manualBlock = document.getElementById("debtManualRepayBlock");
    var hintEl = document.getElementById("debtModeHint");

    if (debts.length === 0) {
      if (toggleWrap) toggleWrap.style.display = "none";
      if (manualBlock) manualBlock.style.display = "none";
      return;
    }

    if (toggleWrap) toggleWrap.style.display = "";

    if (manualBlock) {
      manualBlock.style.display = "";
      if (s.debtPlanningMode) {
        manualBlock.classList.add("collapsed");
      } else {
        manualBlock.classList.remove("collapsed");
      }
    }
    if (hintEl) {
      hintEl.textContent = s.debtPlanningMode
        ? t("debts.modeHintOn")
        : t("debts.modeHintOff");
    }
  }

  var manualRepayBtn = document.getElementById("debtManualRepayBtn");
  var manualRepayInput = document.getElementById("debtManualRepayInput");

  if (manualRepayBtn && manualRepayInput) {
    var manualRepayInputWrap = manualRepayInput.closest(".input-wrap");

    manualRepayInput.addEventListener("input", function () {
      manualRepayInput.value = formatNumber(manualRepayInput.value);
      if (manualRepayInputWrap) manualRepayInputWrap.classList.remove("error", "shake");
    });

    manualRepayBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("medium");
      var amount = parseNumber(manualRepayInput.value || "0");

      if (manualRepayInputWrap) manualRepayInputWrap.classList.remove("error", "shake");

      if (!amount || amount <= 0) {
        if (manualRepayInputWrap) {
          manualRepayInputWrap.classList.add("error");
          void manualRepayInputWrap.offsetWidth;
          manualRepayInputWrap.classList.add("shake");
        }
        haptic("error");
        return;
      }

      var activeDebts = (getState().debts || []).filter(function (d) {
        return d.isActive !== false && (Number(d.remainingAmount) || 0) > 0;
      });
      if (activeDebts.length === 0) {
        if (manualRepayInputWrap) {
          manualRepayInputWrap.classList.add("error");
          void manualRepayInputWrap.offsetWidth;
          manualRepayInputWrap.classList.add("shake");
        }
        haptic("error");
        return;
      }

      var result = applyDebtRepayment(amount);
      if (result.applied > 0) {
        result.details.forEach(function (d) {
          addDebtPaymentRecord({
            debtId: d.debtId,
            amount: d.amount,
            source: "manual"
          });
        });
        renderDebtList();
        renderDebtSummary();
        recalcWithDebts();
        manualRepayInput.value = "";
        showToast(t("debts.repaid"), "success");
      }
    });
  }

  // ── Debt Payment History Sheet ──
  var debtHistorySheet = document.getElementById("debtHistorySheet");
  var debtHistoryOverlay = document.getElementById("debtHistoryOverlay");

  function openDebtHistorySheet(debtId) {
    var debt = getDebts().find(function (d) { return d.id === debtId; });
    if (!debt) return;

    var nameEl = document.getElementById("debtHistoryName");
    var remainEl = document.getElementById("debtHistoryRemain");
    var listEl = document.getElementById("debtHistoryList");
    var emptyEl = document.getElementById("debtHistoryEmpty");

    if (nameEl) nameEl.textContent = debt.title || t("misc.noTitle");
    if (remainEl) remainEl.textContent = t("debts.remaining") + ": " + fmtConverted(Number(debt.remainingAmount) || 0) + " " + getCurrencySymbol();

    var history = (getState().debtPaymentHistory || [])
      .filter(function (h) { return h.debtId === debtId; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    if (listEl) {
      if (history.length === 0) {
        listEl.innerHTML = "";
        if (emptyEl) emptyEl.style.display = "";
      } else {
        if (emptyEl) emptyEl.style.display = "none";
        var html = "";
        history.forEach(function (h, i) {
          var _hd = new Date(h.date);
          var dateStr = _hd.getDate() + " " + getMonthNameShort(_hd.getMonth()) + " " + _hd.getFullYear();
          var descHtml = "";
          if (h.source === "auto" && h.totalInput) {
            descHtml = '<div class="dph-entry-desc">' + t("debts.historyAutoDesc", { total: fmtConverted(h.totalInput || 0) + ' ' + getCurrencySymbol(), amount: fmtConverted(h.amount || 0) + ' ' + getCurrencySymbol() }) + '</div>';
          } else {
            descHtml = '<div class="dph-entry-desc">' + t("debts.historyManualDesc") + '</div>';
          }

          html += '<div class="dph-entry" style="animation-delay:' + (i * 0.04) + 's">'
            + '<div class="dph-entry-dot"></div>'
            + '<div class="dph-entry-body">'
            + '<div class="dph-entry-amount">' + fmtConverted(h.amount || 0) + ' ' + getCurrencySymbol() + '</div>'
            + descHtml
            + '<div class="dph-entry-date">' + dateStr + '</div>'
            + '</div>'
            + '</div>';
        });
        listEl.innerHTML = html;
      }
    }

    ProtoSheet.open(debtHistorySheet, debtHistoryOverlay);
  }

  function closeDebtHistorySheet() {
    ProtoSheet.close(debtHistorySheet, debtHistoryOverlay);
  }

  if (debtHistoryOverlay) {
    debtHistoryOverlay.addEventListener("click", closeDebtHistorySheet);
  }
  ProtoSheet.initSwipe(debtHistorySheet, closeDebtHistorySheet);

  // Expose for external callers (fact submit handler)
  window.renderDebtSummaryGlobal = renderDebtSummary;
  window.renderDebtListGlobal = renderDebtList;
  window.updateDebtModeUI = updateDebtModeUI;

  // Initial mode UI sync on load
  updateDebtModeUI();

})();

(function initGoalSwipe() {
  var wrapper = document.getElementById("goalSwipeWrapper");
  if (!wrapper) return;

  var _gsStartX = 0;
  var _gsStartY = 0;
  var _gsDeltaX = 0;
  var _gsActive = false;
  var _gsLocked = false;
  var _gsRafId = null;
  var GS_THRESHOLD = 80;

  wrapper.addEventListener("pointerdown", function (e) {
    if (_goalSwipeAnimating) return;
    var content = document.getElementById("goalSwipeContent");
    if (!content) return;
    _gsStartX = e.clientX;
    _gsStartY = e.clientY;
    _gsDeltaX = 0;
    _gsActive = true;
    _gsLocked = false;
    content.style.transition = "none";
  });

  wrapper.addEventListener("pointermove", function (e) {
    if (!_gsActive) return;

    var rawDx = e.clientX - _gsStartX;
    var rawDy = e.clientY - _gsStartY;

    if (!_gsLocked) {
      if (Math.abs(rawDx) < 8 && Math.abs(rawDy) < 8) return;
      if (Math.abs(rawDy) > Math.abs(rawDx)) {
        _gsActive = false;
        var content = document.getElementById("goalSwipeContent");
        if (content) { content.style.transform = ""; content.style.opacity = ""; }
        return;
      }
      _gsLocked = true;
      wrapper.setPointerCapture(e.pointerId);
    }

    e.preventDefault();
    _gsDeltaX = rawDx;

    if (_gsRafId) cancelAnimationFrame(_gsRafId);
    _gsRafId = requestAnimationFrame(function () {
      _gsRafId = null;
      var content = document.getElementById("goalSwipeContent");
      if (!content) return;
      content.style.transform = "translateX(" + _gsDeltaX + "px)";
      var progress = Math.min(Math.abs(_gsDeltaX) / 250, 1);
      content.style.opacity = String(1 - progress * 0.4);
    });
  });

  function finishGoalSwipe(e) {
    if (!_gsActive && !_gsLocked) return;
    _gsActive = false;
    _gsLocked = false;
    if (e && e.pointerId !== undefined) {
      try { wrapper.releasePointerCapture(e.pointerId); } catch (ex) {}
    }

    if (_gsRafId) { cancelAnimationFrame(_gsRafId); _gsRafId = null; }

    var content = document.getElementById("goalSwipeContent");
    if (!content) return;

    var goals = getGoals();
    var count = Math.min(goals.length, 3);
    var dx = _gsDeltaX;

    if (Math.abs(dx) > GS_THRESHOLD && count > 1) {
      var goLeft = dx < 0;
      var next;
      if (goLeft) next = (activeGoalIndex + 1) % count;
      else        next = (activeGoalIndex - 1 + count) % count;

      if (typeof haptic === "function") haptic("light");
      goalSwipeToIndex(next, goLeft);
      return;
    }

    content.style.transition = "transform 0.35s cubic-bezier(.4,0,.2,1), opacity 0.2s ease";
    content.style.transform = "translateX(0)";
    content.style.opacity = "1";
    setTimeout(function () {
      content.style.transform = "";
      content.style.opacity = "";
      content.style.transition = "";
    }, 350);
  }

  wrapper.addEventListener("pointerup", finishGoalSwipe);
  wrapper.addEventListener("pointercancel", finishGoalSwipe);
})();

/* ============================================================
   EXPENSES TRACKER MODULE
   ============================================================ */

(function () {

  ProtoSheet.resetAll();

  var EXP_CATEGORIES = [
    { key: "food",       color: "#10b981" },
    { key: "transport",  color: "#3b82f6" },
    { key: "cafe",       color: "#f59e0b" },
    { key: "home",       color: "#8b5cf6" },
    { key: "subs",       color: "#ec4899" },
    { key: "fun",        color: "#06b6d4" },
    { key: "health",     color: "#14b8a6" },
    { key: "clothes",    color: "#f43f5e" },
    { key: "other",      color: "#6b7280" }
  ];

  var _expSelectedCat = null;

  function getCatByKey(key) {
    for (var i = 0; i < EXP_CATEGORIES.length; i++) {
      if (EXP_CATEGORIES[i].key === key) {
        var c = EXP_CATEGORIES[i];
        return { key: c.key, name: t("cat." + c.key), color: c.color };
      }
    }
    var last = EXP_CATEGORIES[EXP_CATEGORIES.length - 1];
    return { key: last.key, name: t("cat." + last.key), color: last.color };
  }

  function getMonthlyExpenseLimit() {
    var inp = document.getElementById("expenses");
    if (!inp || !inp.value) {
      var s = getState();
      if (s.expenses) return Number(String(s.expenses).replace(/\./g, "")) || 0;
      return 0;
    }
    return Number(inp.value.replace(/\./g, "")) || 0;
  }

  function getCurrentMonthKey() {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    return y + "-" + m;
  }

  function getMonthExpenses() {
    var s = getState();
    var log = s.expensesLog || [];
    var mk = getCurrentMonthKey();
    var result = [];
    for (var i = 0; i < log.length; i++) {
      var e = log[i];
      var d = new Date(e.date);
      if (d.getFullYear() + "-" + d.getMonth() === mk) {
        result.push(e);
      }
    }
    return result;
  }

  function calcCategoryTotals(entries) {
    var totals = {};
    var totalSpent = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var k = e.category || "other";
      if (!totals[k]) totals[k] = 0;
      totals[k] += e.amount;
      totalSpent += e.amount;
    }
    var sorted = [];
    for (var key in totals) {
      sorted.push({ key: key, amount: totals[key], pct: totalSpent > 0 ? Math.round((totals[key] / totalSpent) * 100) : 0 });
    }
    sorted.sort(function (a, b) { return b.amount - a.amount; });
    return { categories: sorted, totalSpent: totalSpent };
  }

  /* ── Donut Chart (Canvas) ── */

  function drawDonut(catData, totalSpent) {
    var canvas = document.getElementById("expDonutCanvas");
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var size = 220;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";

    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    var cx = size / 2;
    var cy = size / 2;
    var outerR = 100;
    var innerR = 68;

    if (!catData.length || totalSpent === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      return;
    }

    var startAngle = -Math.PI / 2;
    for (var i = 0; i < catData.length; i++) {
      var seg = catData[i];
      var cat = getCatByKey(seg.key);
      var sweep = (seg.amount / totalSpent) * Math.PI * 2;
      var gap = catData.length > 1 ? 0.03 : 0;

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle + gap / 2, startAngle + sweep - gap / 2);
      ctx.arc(cx, cy, innerR, startAngle + sweep - gap / 2, startAngle + gap / 2, true);
      ctx.closePath();
      ctx.fillStyle = cat.color;
      ctx.fill();

      startAngle += sweep;
    }
  }

  /* ── Render Category List ── */

  var _lastCatData = [];
  var _lastCatTotalSpent = 0;

  function renderCategoryList(catData, totalSpent) {
    var container = document.getElementById("expCategories");
    if (!container) return;
    _lastCatData = catData;
    _lastCatTotalSpent = totalSpent;
    if (!catData.length) {
      container.innerHTML = "";
      return;
    }
    var html = "";
    for (var i = 0; i < catData.length; i++) {
      var seg = catData[i];
      var cat = getCatByKey(seg.key);
      html += '<div class="exp-cat-row" data-cat="' + seg.key + '">' +
        '<div class="exp-cat-dot" style="background:' + cat.color + '"></div>' +
        '<div class="exp-cat-info">' +
          '<div class="exp-cat-name">' + cat.name + '</div>' +
          '<div class="exp-cat-amount">' + fmtConverted(seg.amount) + ' ' + getCurrencySymbol() + '</div>' +
        '</div>' +
        '<div class="exp-cat-pct">' + seg.pct + '%</div>' +
      '</div>';
    }
    container.innerHTML = html;

    container.querySelectorAll(".exp-cat-row").forEach(function (row) {
      row.addEventListener("click", function () {
        haptic("light");
        openCatDetailSheet(row.dataset.cat);
      });
    });
  }

  /* ── Render Full Screen ── */

  window.renderExpensesScreen = function () {
    var entries = getMonthExpenses();
    var data = calcCategoryTotals(entries);
    var limit = getMonthlyExpenseLimit();
    var spent = data.totalSpent;
    var remaining = limit - spent;

    var elSpent = document.getElementById("expSpent");
    var elLimit = document.getElementById("expLimit");
    var elRemaining = document.getElementById("expRemaining");
    var elProgress = document.getElementById("expProgressFill");
    var elStatus = document.getElementById("expStatus");
    var elDonutTotal = document.getElementById("expDonutTotal");
    var elEmpty = document.getElementById("expEmpty");
    var elSummary = document.getElementById("expSummaryCard");
    var elDonut = document.getElementById("expDonutWrap");
    var elCats = document.getElementById("expCategories");
    var elAddBtn = document.getElementById("expAddBtn");

    if (entries.length === 0) {
      if (elEmpty) elEmpty.style.display = "flex";
      if (elSummary) elSummary.style.display = "none";
      if (elDonut) elDonut.style.display = "none";
      if (elCats) elCats.style.display = "none";
      if (elAddBtn) elAddBtn.style.display = "none";
      drawDonut([], 0);
      return;
    }

    if (elEmpty) elEmpty.style.display = "none";
    if (elSummary) elSummary.style.display = "";
    if (elDonut) elDonut.style.display = "";
    if (elCats) elCats.style.display = "";
    if (elAddBtn) elAddBtn.style.display = "";

    if (elSpent) elSpent.textContent = fmtConverted(spent);
    if (elLimit) elLimit.textContent = limit > 0 ? fmtConverted(limit) : "-";

    if (remaining >= 0) {
      if (elRemaining) elRemaining.textContent = fmtConverted(remaining);
    } else {
      if (elRemaining) elRemaining.textContent = "−" + fmtConverted(Math.abs(remaining));
    }

    var pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
    if (elProgress) {
      elProgress.style.width = pct + "%";
      elProgress.classList.remove("warn", "over");
      if (limit > 0 && spent > limit) elProgress.classList.add("over");
      else if (limit > 0 && pct >= 80) elProgress.classList.add("warn");
    }

    if (elStatus) {
      elStatus.classList.remove("status-ok", "status-warn", "status-over");
      if (limit <= 0) {
        elStatus.textContent = t("expenses.noLimit");
        elStatus.classList.add("status-warn");
      } else if (spent > limit) {
        elStatus.textContent = t("expenses.limitExceeded", {amount: fmtConverted(Math.abs(remaining)) + " " + getCurrencySymbol()});
        elStatus.classList.add("status-over");
      } else if (pct >= 80) {
        elStatus.textContent = t("expenses.limitAlmost");
        elStatus.classList.add("status-warn");
      } else {
        elStatus.textContent = t("expenses.withinLimit");
        elStatus.classList.add("status-ok");
      }
    }

    if (elDonutTotal) elDonutTotal.textContent = fmtConverted(spent) + " " + getCurrencySymbol();

    drawDonut(data.categories, data.totalSpent);
    renderCategoryList(data.categories, data.totalSpent);
  };

  /* ── Category Grid in Sheet ── */

  function renderCatGrid() {
    var grid = document.getElementById("expCatGrid");
    if (!grid) return;
    var html = "";
    for (var i = 0; i < EXP_CATEGORIES.length; i++) {
      var c = EXP_CATEGORIES[i];
      html += '<div class="exp-cat-chip" data-cat="' + c.key + '">' +
        '<span class="exp-chip-dot" style="background:' + c.color + '"></span>' +
        t("cat." + c.key) +
      '</div>';
    }
    grid.innerHTML = html;

    grid.querySelectorAll(".exp-cat-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        grid.querySelectorAll(".exp-cat-chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        _expSelectedCat = chip.dataset.cat;
        hideExpValidation();
      });
    });
  }

  /* ── Sheet Open / Close ── */

  var sheetOverlay = document.getElementById("expenseSheetOverlay");
  var sheet = document.getElementById("expenseSheet");

  function openExpenseSheet() {
    _expSelectedCat = null;
    var amtInput = document.getElementById("expenseAmount");
    var dateInput = document.getElementById("expenseDate");
    var noteInput = document.getElementById("expenseNote");
    if (amtInput) amtInput.value = "";
    if (noteInput) noteInput.value = "";
    if (dateInput) {
      var now = new Date();
      dateInput.value = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    }
    renderCatGrid();
    hideExpValidation();
    ProtoSheet.open(sheet, sheetOverlay);
  }

  function closeExpenseSheet() {
    ProtoSheet.close(sheet, sheetOverlay);
  }

  if (sheetOverlay) {
    sheetOverlay.addEventListener("click", function () {
      haptic("light");
      closeExpenseSheet();
    });
  }

  /* ── Validation ── */

  function showExpValidation(msg) {
    var el = document.getElementById("expValidation");
    if (el) {
      el.textContent = msg;
      el.style.display = "block";
    }
  }

  function hideExpValidation() {
    var el = document.getElementById("expValidation");
    if (el) el.style.display = "none";
  }

  /* ── Save Expense ── */

  var saveBtn = document.getElementById("expenseSaveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      haptic("light");

      if (!_expSelectedCat) {
        showExpValidation(t("expenses.selectCategory"));
        return;
      }

      var amtInput = document.getElementById("expenseAmount");
      var rawAmt = amtInput ? amtInput.value : "";
      var amount = Number(rawAmt.replace(/\./g, "").replace(/\D/g, "")) || 0;
      if (amount <= 0) {
        showExpValidation(t("expenses.enterAmount"));
        return;
      }

      var dateInput = document.getElementById("expenseDate");
      var noteInput = document.getElementById("expenseNote");
      var dateVal = dateInput ? dateInput.value : "";
      var noteVal = noteInput ? noteInput.value.trim() : "";

      if (!dateVal) {
        var now = new Date();
        dateVal = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
      }

      var entry = {
        id: "exp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        category: _expSelectedCat,
        amount: amount,
        date: dateVal,
        note: noteVal
      };

      var s = getState();
      var log = Array.isArray(s.expensesLog) ? s.expensesLog.slice() : [];
      log.push(entry);
      updateState({ expensesLog: log });
      saveFullState();

      closeExpenseSheet();
      renderExpensesScreen();

      showToast(t("expenses.added"), "success");
    });
  }

  /* ── Format amount input ── */

  // OPTIMIZATION: getEl() вместо document.getElementById + переиспользование formatNumericInput.
  var expAmtInput = getEl("expenseAmount");
  if (expAmtInput) {
    expAmtInput.addEventListener("input", function (e) {
      formatNumericInput(e.target);
    });
  }

  /* ── Wire up buttons ── */

  var addBtn = document.getElementById("expAddBtn");
  var addBtnEmpty = document.getElementById("expAddBtnEmpty");

  if (addBtn) addBtn.addEventListener("click", function () { haptic("light"); openExpenseSheet(); });
  if (addBtnEmpty) addBtnEmpty.addEventListener("click", function () { haptic("light"); openExpenseSheet(); });

  /* ── Donut chart click → open category detail ── */

  var donutCanvas = document.getElementById("expDonutCanvas");
  if (donutCanvas) {
    donutCanvas.addEventListener("click", function (e) {
      if (!_lastCatData.length || !_lastCatTotalSpent) return;
      var rect = donutCanvas.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      var dist = Math.sqrt(x * x + y * y);
      var scale = 220 / rect.width;
      var distScaled = dist * scale;
      if (distScaled < 68 || distScaled > 100) return;

      var angle = Math.atan2(y, x);
      if (angle < -Math.PI / 2) angle += Math.PI * 2;
      var adjustedAngle = angle + Math.PI / 2;
      if (adjustedAngle >= Math.PI * 2) adjustedAngle -= Math.PI * 2;

      var cumAngle = 0;
      for (var i = 0; i < _lastCatData.length; i++) {
        var sweep = (_lastCatData[i].amount / _lastCatTotalSpent) * Math.PI * 2;
        cumAngle += sweep;
        if (adjustedAngle <= cumAngle) {
          haptic("light");
          openCatDetailSheet(_lastCatData[i].key);
          return;
        }
      }
    });
  }

  /* ── Category Detail Sheet ── */

  var catDetailOverlay = document.getElementById("expCatDetailOverlay");
  var catDetailSheet = document.getElementById("expCatDetailSheet");

  function formatExpDate(dateStr) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var now = new Date();
    var base = d.getDate() + " " + getMonthNameGenitive(d.getMonth());
    if (d.getFullYear() !== now.getFullYear()) base += " " + d.getFullYear();
    return base;
  }

  function openCatDetailSheet(catKey) {
    var cat = getCatByKey(catKey);
    var allMonth = getMonthExpenses();
    var entries = allMonth.filter(function (e) {
      return (e.category || "other") === catKey;
    });
    entries.sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    var dotEl = document.getElementById("expDetailDot");
    var nameEl = document.getElementById("expDetailCatName");
    var countEl = document.getElementById("expDetailCount");
    var totalEl = document.getElementById("expDetailTotal");
    var metaEl = document.getElementById("expDetailMeta");
    var progressWrap = document.getElementById("expDetailProgressWrap");
    var progressFill = document.getElementById("expDetailProgressFill");
    var listEl = document.getElementById("expDetailList");
    var emptyEl = document.getElementById("expDetailEmpty");

    if (dotEl) dotEl.style.background = cat.color;
    if (nameEl) nameEl.textContent = cat.name;

    var catTotal = 0;
    for (var i = 0; i < entries.length; i++) catTotal += entries[i].amount;

    if (countEl) {
      countEl.textContent = entries.length + " " + _pluralizeExpense(entries.length);
    }

    if (totalEl) totalEl.textContent = fmtConverted(catTotal) + " " + getCurrencySymbol();

    var totalAllSpent = 0;
    for (var k = 0; k < allMonth.length; k++) totalAllSpent += allMonth[k].amount;
    var pctOfTotal = totalAllSpent > 0 ? Math.round((catTotal / totalAllSpent) * 100) : 0;

    var limit = getMonthlyExpenseLimit();
    if (metaEl) {
      var metaParts = [];
      metaParts.push(t("expenses.pctOfAll", { pct: pctOfTotal }));
      if (limit > 0) metaParts.push(t("expenses.ofTotal", { amount: fmtConverted(catTotal), limit: fmtConverted(limit), sym: getCurrencySymbol() }));
      metaEl.textContent = metaParts.join("  ·  ");
    }

    if (progressWrap && progressFill) {
      if (limit > 0) {
        progressWrap.style.display = "";
        var pctBar = Math.min((catTotal / limit) * 100, 100);
        progressFill.style.width = "0%";
        progressFill.style.background = cat.color;
        requestAnimationFrame(function () {
          progressFill.style.width = pctBar + "%";
        });
      } else {
        progressWrap.style.display = "none";
      }
    }

    if (!entries.length) {
      if (listEl) listEl.innerHTML = "";
      if (emptyEl) emptyEl.style.display = "flex";
    } else {
      if (emptyEl) emptyEl.style.display = "none";
      var html = "";
      for (var j = 0; j < entries.length; j++) {
        var e = entries[j];
        var delay = Math.min(j * 40, 300);
        var noteHtml = e.note
          ? '<div class="exp-detail-entry-note">' + e.note.replace(/</g, "&lt;") + '</div>'
          : '<div class="exp-detail-entry-note muted">' + t("expenses.noNote") + '</div>';

        html += '<div class="exp-detail-entry" style="animation-delay:' + delay + 'ms">' +
          '<div class="exp-detail-entry-dot" style="background:' + cat.color + '"></div>' +
          '<div class="exp-detail-entry-body">' +
            '<div class="exp-detail-entry-amount">' + fmtConverted(e.amount) + ' ' + getCurrencySymbol() + '</div>' +
            noteHtml +
          '</div>' +
          '<div class="exp-detail-entry-date">' + formatExpDate(e.date) + '</div>' +
          '<svg class="exp-detail-entry-chevron" width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>';
      }
      if (listEl) listEl.innerHTML = html;
    }

    ProtoSheet.open(catDetailSheet, catDetailOverlay);
  }

  function _pluralizeExpense(n) {
    if (getCurrentLanguage() === "en") {
      return n === 1 ? t("expenses.opPlural1") : t("expenses.opPlural0");
    }
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return t("expenses.opPlural0");
    if (mod10 === 1) return t("expenses.opPlural1");
    if (mod10 >= 2 && mod10 <= 4) return t("expenses.opPlural2_4");
    return t("expenses.opPlural0");
  }

  function closeCatDetailSheet() {
    ProtoSheet.close(catDetailSheet, catDetailOverlay);
  }

  if (catDetailOverlay) {
    catDetailOverlay.addEventListener("click", function () {
      haptic("light");
      closeCatDetailSheet();
    });
  }

  /* ── Init swipe-to-dismiss on expense sheets ── */

  ProtoSheet.initSwipe(sheet, closeExpenseSheet);
  ProtoSheet.initSwipe(catDetailSheet, closeCatDetailSheet);

})();

/* ============================================================
   Flexible Model - "Текущая модель" live summary renderer
   ------------------------------------------------------------
   Pure rendering layer. Reads existing state via getState(),
   uses i18n via t(), and updates already-existing DOM nodes:
     • #cfFlowSummaryText        (premium income/expense blocks)
     • #incomeInlineSummary      (one-line summary on income card)
     • #expenseInlineSummary     (one-line summary on expense card)
     • #incomeCardStatus         (header chip on income card)
     • #expenseCardStatus        (header chip on expense card)
     • #cfCurrentModelHelper     (localized helper text)
   Reads independently for both sides:
     income  → incomeType, incomeFrequency, fixedIncomeAmount, incomeMonthDays
     expense → expenseType, expenseFrequency, fixedExpenseAmount, expenseMonthDays
   No business logic, no state mutation.
   ============================================================ */
function renderFlexModelSummary() {
  if (typeof getState !== "function" || typeof t !== "function") return;

  var s = getState() || {};

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Robust amount parser - handles every format the user can produce:
  //   "10 000"  (default spaces format from formatNumber)
  //   "10.000"  (dots format when settings.numberFormat === "dots")
  //   "10000"   (raw, unformatted)
  //   "10,5"    (decimal with comma) / "10.5" (decimal with dot)
  function parseAmount(v) {
    if (v == null) return 0;
    var raw = String(v).replace(/[\u00A0\s]/g, "");
    if (!raw) return 0;

    // Detect active thousands-separator preference.
    var nf = (typeof window !== "undefined" && window._protocolNumberFormat)
      || (s.settings && s.settings.numberFormat)
      || "spaces";

    if (nf === "dots") {
      // Dots are thousands separators → strip them all.
      // Comma (if any) is the decimal separator → keep it as a decimal point.
      raw = raw.replace(/\./g, "").replace(/,/g, ".");
    } else {
      // Spaces are thousands separators (already removed above).
      // If multiple dots remain → they are also thousands separators (defensive).
      var dots = (raw.match(/\./g) || []).length;
      if (dots >= 2) raw = raw.replace(/\./g, "");
      raw = raw.replace(/,/g, ".");
    }

    var n = parseFloat(raw);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function fmtMoney(n) {
    if (typeof protocolFormatAmount === "function") return protocolFormatAmount(n);
    var sym = (typeof getCurrencySymbol === "function") ? getCurrencySymbol() : "\u20BD";
    var formatted = (typeof fmtNum === "function") ? fmtNum(n) : Math.round(n).toString();
    return formatted + "\u00A0" + sym;
  }

  function freqLabel(freq) {
    if (freq === "weekly") return t("freq.weekly");
    if (freq === "biweekly") return t("freq.biweekly");
    if (freq === "custom") return t("freq.custom");
    return t("freq.monthly");
  }

  function datesCountText(n) {
    if (!n) return t("flex.dates.notSelected");
    return t("flex.dates.count", { n: n });
  }

  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Сумма ручных записей одной стороны за период (customScheduleEntries).
  // Используется как источник суммы для VARIABLE + freq="custom" вместо
  // удалённого поля fixedXxxAmount.
  function sumCustomEntries(side) {
    var entries = Array.isArray(s.customScheduleEntries) ? s.customScheduleEntries : [];
    var total = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e || e.side !== side) continue;
      total += Number(e.amount) || 0;
    }
    return total;
  }
  function countCustomEntries(side) {
    var entries = Array.isArray(s.customScheduleEntries) ? s.customScheduleEntries : [];
    var n = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].side === side) n++;
    }
    return n;
  }

  function sideConfig(side) {
    // NEW: логика fixed vs variable 11.05.2026 -
    //   • FIXED   → amount sourced from the SIMPLE-model field (s.income / s.expenses),
    //               frequency is implicitly monthly, no start-date meta.
    //   • VARIABLE → amount sourced from manual entries (customScheduleEntries):
    //               для freq="custom" - сумма всех ручных записей стороны;
    //               для остальных частот - последнее значение fixedXxxAmount,
    //               которое модалка «Записать поступление» пишет автоматически.
    if (side === "income") {
      var incType = s.incomeType || "fixed";
      var incFreq = incType === "fixed" ? "monthly" : (s.incomeFrequency || "monthly");
      var incAmount;
      if (incType === "fixed") incAmount = s.income;
      else if (incFreq === "custom") incAmount = sumCustomEntries("income");
      else incAmount = s.fixedIncomeAmount;
      return {
        type:      incType,
        freq:      incFreq,
        amount:    incAmount,
        days:      Array.isArray(s.incomeMonthDays) ? s.incomeMonthDays : [],
        entries:   incType === "variable" && incFreq === "custom" ? countCustomEntries("income") : 0,
        startDate: incType === "fixed" ? "" : (s.incomeStartDate || "")
      };
    }
    var expType = s.expenseType || "fixed";
    var expFreq = expType === "fixed" ? "monthly" : (s.expenseFrequency || "monthly");
    var expAmount;
    if (expType === "fixed") expAmount = s.expenses;
    else if (expFreq === "custom") expAmount = sumCustomEntries("expense");
    else expAmount = s.fixedExpenseAmount;
    return {
      type:      expType,
      freq:      expFreq,
      amount:    expAmount,
      days:      Array.isArray(s.expenseMonthDays) ? s.expenseMonthDays : [],
      entries:   expType === "variable" && expFreq === "custom" ? countCustomEntries("expense") : 0,
      startDate: expType === "fixed" ? "" : (s.expenseStartDate || "")
    };
  }

  // NEW: format a Date as "10 мая 2026" (RU genitive) or localized.
  function formatHumanDate(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    var day = d.getDate();
    var year = d.getFullYear();
    var monthName = (typeof getMonthNameGenitive === "function")
      ? getMonthNameGenitive(d.getMonth())
      : (typeof getMonthName === "function" ? getMonthName(d.getMonth()) : String(d.getMonth() + 1));
    return day + " " + monthName + " " + year;
  }

  function sideTypeText(c, isExpense) {
    if (c.type === "fixed") return isExpense ? t("freq.fixedPlural") : t("freq.fixed");
    return isExpense ? t("freq.variablePlural") : t("freq.variable");
  }

  // ── SVG icons ──
  function arrowSvg(isIncome) {
    // Up-right for income, down-right for expense.
    if (isIncome) {
      return (
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">' +
          '<path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>'
      );
    }
    return (
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">' +
        '<path d="M7 7L17 17M17 17H9M17 17V9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  function calendarSvg() {
    return (
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">' +
        '<rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" stroke-width="1.6"/>' +
        '<path d="M3.5 9.5H20.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
        '<path d="M8 3v3M16 3v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  // ── Main side block (premium income / expense card) ──
  function buildSideBlock(side) {
    var c          = sideConfig(side);
    var isIncome   = (side === "income");
    var isExpense  = !isIncome;
    var headerKey  = isIncome ? "flex.current.incomeUpper" : "flex.current.expensesUpper";
    var typeLabel  = sideTypeText(c, isExpense);
    var typeMod    = (c.type === "fixed") ? "fixed" : "variable";

    // Determine amount + frequency line independently for each side.
    var amountHtml, freqText, amountMissing = false, periodicMetaHtml = "";

    // NEW: логика fixed vs variable 11.05.2026 - both modes display amount+freq.
    // The frequency for FIXED is always "monthly" (simple-model assumption) and there
    // is NO Start/Next meta. VARIABLE shows the user-configured freq AND Start/Next.
    var amt = parseAmount(c.amount);
    if (amt > 0) {
      amountHtml = '<span class="cf-side-amount">' + escapeHtml(fmtMoney(amt)) + '</span>';
    } else {
      amountMissing = true;
      amountHtml =
        '<span class="cf-side-amount cf-side-amount--placeholder">' +
          escapeHtml(t("flex.amount.notSet")) +
        '</span>';
    }
    freqText = capitalize(freqLabel(c.freq));
    if (c.type === "variable" && c.freq === "custom") {
      freqText += " \u00B7 " + t("flex.current.byEvents");
    }

    // NEW: Start + Next occurrence meta - only for VARIABLE side (the schedule the
    // user explicitly configured). FIXED side is monthly+read-only with no anchor.
    if (c.type === "variable" && amt > 0) {
      var startStr, nextStr;
      if (c.startDate) {
        var startD = new Date(c.startDate);
        if (!isNaN(startD.getTime())) startStr = formatHumanDate(startD);
        var nextD = (typeof calculateNextOccurrence === "function")
          ? calculateNextOccurrence(c.startDate, c.freq, c.days)
          : null;
        // FIX: «Следующее» - это occurrence ПОСЛЕ даты старта. Когда старт сегодня
        // или в будущем, calculateNextOccurrence возвращает САМ старт (первое
        // событие), из-за чего «Начало» и «Следующее» совпадали. Сдвигаем на один
        // период вперёд по выбранной частоте.
        if (nextD && startD && !isNaN(startD.getTime())) {
          var _s0 = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
          var _n0 = new Date(nextD.getFullYear(), nextD.getMonth(), nextD.getDate());
          if (_n0.getTime() <= _s0.getTime()) {
            var _adv = new Date(_s0);
            if (c.freq === "weekly") {
              _adv.setDate(_adv.getDate() + 7);
              nextD = _adv;
            } else if (c.freq === "biweekly") {
              _adv.setDate(_adv.getDate() + 14);
              nextD = _adv;
            } else if (c.freq === "custom") {
              // «Свой график» - событийный режим без фиксированного шага: оставляем как есть.
            } else {
              // monthly и дефолт: +1 месяц с зажатием дня под длину месяца.
              var _dd = _adv.getDate();
              _adv.setDate(1);
              _adv.setMonth(_adv.getMonth() + 1);
              var _dim = new Date(_adv.getFullYear(), _adv.getMonth() + 1, 0).getDate();
              _adv.setDate(Math.min(_dd, _dim));
              nextD = _adv;
            }
          }
        }
        if (nextD) nextStr = formatHumanDate(nextD);
      }

      var startInner = startStr
        ? escapeHtml(startStr)
        : '<span class="cf-side-meta-placeholder">' + escapeHtml(t("flex.current.startNotSet")) + '</span>';
      var nextInner = nextStr
        ? escapeHtml(nextStr)
        : '<span class="cf-side-meta-placeholder">-</span>';

      periodicMetaHtml =
        '<div class="cf-side-meta">' +
          '<div class="cf-side-meta-row">' +
            '<span class="cf-side-meta-label">' + escapeHtml(t("flex.current.start")) + '</span>' +
            '<span class="cf-side-meta-value">' + startInner + '</span>' +
          '</div>' +
          '<div class="cf-side-meta-row">' +
            '<span class="cf-side-meta-label">' + escapeHtml(t("flex.current.next")) + '</span>' +
            '<span class="cf-side-meta-value cf-side-meta-value--accent">' + nextInner + '</span>' +
          '</div>' +
        '</div>';
    }

    var blockClasses = "cf-side cf-side--" + side;
    if (amountMissing) blockClasses += " cf-side--missing";

    return (
      '<div class="' + blockClasses + '">' +
        '<div class="cf-side-head">' +
          '<div class="cf-side-head-left">' +
            '<span class="cf-side-icon">' + arrowSvg(isIncome) + '</span>' +
            '<span class="cf-side-label">' + escapeHtml(t(headerKey)) + '</span>' +
          '</div>' +
          '<span class="cf-side-badge cf-side-badge--' + typeMod + '">' +
            escapeHtml(capitalize(typeLabel)) +
          '</span>' +
        '</div>' +
        '<div class="cf-side-amount-row">' + amountHtml + '</div>' +
        '<div class="cf-side-freq">' +
          '<span class="cf-side-freq-icon">' + calendarSvg() + '</span>' +
          '<span class="cf-side-freq-text">' + escapeHtml(freqText) + '</span>' +
        '</div>' +
        periodicMetaHtml +
      '</div>'
    );
  }

  // ── Compact one-line summary used on the inline card slots ──
  // NEW: логика fixed vs variable 11.05.2026 -
  //   • FIXED:   "Доход: Фиксированный · данные из начального состояния"
  //              (no amount placeholder, no frequency - it's read-only initial data).
  //   • VARIABLE: "Доход: Нефиксированный · 125 000 ₽ · Раз в неделю · Начало: 17 мая 2026"
  function buildInlineLine(side) {
    var c         = sideConfig(side);
    var isIncome  = (side === "income");
    var isExpense = !isIncome;
    var label     = isIncome ? t("flex.current.income") : t("flex.current.expenses");
    var typeStr   = capitalize(sideTypeText(c, isExpense));

    if (c.type === "fixed") {
      return label + ": " + typeStr + " \u00B7 " + t("flex.fixedSummary.initial");
    }

    var parts = [typeStr];

    var amt = parseAmount(c.amount);
    parts.push(amt > 0 ? fmtMoney(amt) : t("flex.amount.notSet"));

    var freqText = capitalize(freqLabel(c.freq));
    if (c.freq === "custom") {
      freqText += " \u00B7 " + t("flex.current.byEvents");
    }
    parts.push(freqText);

    if (c.startDate) {
      var sd = new Date(c.startDate);
      if (!isNaN(sd.getTime())) {
        parts.push(t("flex.current.start") + ": " + formatHumanDate(sd));
      }
    }

    return label + ": " + parts.join(" \u00B7 ");
  }

  // ── 1) "Текущая модель" main card - premium two-block layout ──
  // OPTIMIZATION: DOM cache в renderFlexModelSummary (вызывается из syncFlexibleUI).
  var summaryText = getEl("cfFlowSummaryText");
  if (summaryText) {
    summaryText.innerHTML =
      buildSideBlock("income") +
      buildSideBlock("expense");
  }

  // ── 2) Inline summaries on income/expense cards ──
  var incInline = getEl("incomeInlineSummary");
  if (incInline) {
    incInline.textContent = buildInlineLine("income");
    incInline.classList.add("visible");
  }
  var expInline = getEl("expenseInlineSummary");
  if (expInline) {
    expInline.textContent = buildInlineLine("expense");
    expInline.classList.add("visible");
  }

  // ── 3) Header chips (independent per side) ──
  // NEW: логика fixed vs variable 11.05.2026 -
  //   • FIXED → chip says "Фиксированный" (uses simple-model amount); muted if 0.
  //   • VARIABLE → chip says the freq label (e.g. "Раз в неделю"); muted only when
  //     custom freq has no selected days OR amount is 0.
  function chipFor(side) {
    var c = sideConfig(side);
    var amt = parseAmount(c.amount);
    if (c.type === "fixed") {
      if (amt <= 0) return { text: t("flex.current.chip.notSet"), muted: true };
      return { text: capitalize(t("freq.fixed")), muted: false };
    }
    // VARIABLE + «Свой график» → сумма формируется из ручных записей. Показываем
    // «По событиям», когда записи есть (amt > 0); иначе «не настроено».
    if (c.freq === "custom") {
      if (amt <= 0) return { text: t("flex.current.chip.notSet"), muted: true };
      return { text: t("flex.current.byEvents"), muted: false };
    }
    if (amt <= 0) return { text: t("flex.current.chip.notSet"), muted: true };
    return { text: capitalize(freqLabel(c.freq)), muted: false };
  }

  function applyChip(elId, chip) {
    // OPTIMIZATION: DOM cache.
    var el = getEl(elId);
    if (!el) return;
    var labelEl = el.querySelector(".cf-card-status-label");
    if (labelEl) {
      labelEl.textContent = chip.text;
    } else {
      el.textContent = chip.text;
    }
    el.classList.toggle("cf-card-status--muted", !!chip.muted);
    el.classList.add("visible");
  }

  applyChip("incomeCardStatus", chipFor("income"));
  applyChip("expenseCardStatus", chipFor("expense"));

  // ── 4) In-card "Фиксированный · сумма · Ежемесячно" hint lines (FIXED mode only) ──
  // NEW: логика fixed vs variable 11.05.2026 - these blocks live above the read-only
  // mode and explain WHAT data is being reused (simple-model income/expenses).
  function buildFixedHintLine(side) {
    var c   = sideConfig(side);
    var amt = parseAmount(c.amount);
    var key = side === "income" ? "flex.fixedSummary.line.income" : "flex.fixedSummary.line.expense";
    var amountText = amt > 0
      ? fmtMoney(amt)
      : (side === "income" ? t("flex.fixedSummary.empty.income") : t("flex.fixedSummary.empty.expense"));
    return t(key, {
      amount: amountText,
      freq:   capitalize(freqLabel(c.freq))
    });
  }
  // OPTIMIZATION: DOM cache.
  var incHintLine = getEl("incomeFixedHintLine");
  if (incHintLine) incHintLine.textContent = buildFixedHintLine("income");
  var expHintLine = getEl("expenseFixedHintLine");
  if (expHintLine) expHintLine.textContent = buildFixedHintLine("expense");

  // ── 5) Helper text (refresh on language change) ──
  var helper = getEl("cfCurrentModelHelper");
  if (helper) {
    // NEW: switch helper to the "edit" hint when ANY variable side is active.
    var anyVariable = (s.incomeType || "fixed") === "variable"
                   || (s.expenseType || "fixed") === "variable";
    helper.textContent = anyVariable ? t("flex.current.editHint") : t("flex.current.helper");
  }

  // ── 6) +Add Event button state ──
  // FINANCIAL EVENTS - INCOME ONLY - кнопка «+ Добавить доход» теперь добавляет
  // ТОЛЬКО разовый непредсказуемый доход (премия, подарок, возврат долга,
  // продажа). Это полезно при любой конфигурации сторон: даже если регулярный
  // доход настроен в fixed-режиме, разовый непредсказуемый доход ему не
  // противоречит - это отдельная категория. Поэтому previousнее блокирование
  // по принципу «обе стороны fixed» больше не нужно: снимаем блок всегда.
  var addEventBtn = getEl("addFinancialEvent");
  if (addEventBtn) {
    addEventBtn.classList.remove("add-event-btn--blocked");
    addEventBtn.setAttribute("aria-disabled", "false");
    addEventBtn.removeAttribute("title");
  }

  // ── 7) Keep the open event editor in sync (e.g. user toggled type while sheet open). ──
  if (typeof syncEventEditorTypeAvailability === "function") {
    syncEventEditorTypeAvailability();
  }
}

/* ============================================================================
 * Email link handler (profile → Gmail icon)
 * ----------------------------------------------------------------------------
 * Telegram WebView (особенно на iOS) блокирует `mailto:` в обычных <a href>.
 * Также Telegram.WebApp.openLink() поддерживает только http/https, не mailto.
 *
 * Стратегия: ловим клик по любому <a href="mailto:..."> в DOM, пытаемся
 *   1) открыть почту через window.location.href (работает на Android и Web)
 *   2) если что-то не получилось - копируем email в буфер обмена
 *      и показываем toast «Email скопирован: <email>» - юзер вставит
 *      адрес в свой почтовый клиент сам.
 * Это безопасный fallback: даже если первый шаг отработал, копия в буфере
 * не мешает. На iOS-Telegram второй шаг - единственный способ передать email.
 * ============================================================================ */
(function initMailtoHandler() {
  document.addEventListener("click", function (e) {
    var link = e.target && e.target.closest ? e.target.closest('a[href^="mailto:"]') : null;
    if (!link) return;

    e.preventDefault();

    var href  = link.getAttribute("href") || "";
    var email = href.replace(/^mailto:/i, "").split("?")[0].trim();
    if (!email) return;

    if (typeof haptic === "function") {
      try { haptic("light"); } catch (_e) {}
    }

    // ── 1) Попытка открыть почтовый клиент ────────────────────────────────
    var openedNative = false;
    try {
      window.location.href = href;
      openedNative = true;
    } catch (_e) { /* iOS WebView может бросить - это норм, есть fallback */ }

    // ── 2) Копируем email в буфер обмена (всегда - на случай если шаг 1 не сработал) ─
    function showCopiedToast() {
      if (typeof showToast === "function") {
        showToast("Email скопирован: " + email, "success");
      }
    }
    function showFailToast() {
      if (typeof showToast === "function") {
        showToast("Email: " + email, "info");
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(showCopiedToast, function () {
          // clipboard API мог быть отклонён (permissions / non-secure context)
          if (!openedNative) showFailToast();
        });
      } else {
        // Legacy fallback: textarea + execCommand("copy")
        var ta = document.createElement("textarea");
        ta.value = email;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (_e) {}
        document.body.removeChild(ta);
        if (ok) showCopiedToast(); else if (!openedNative) showFailToast();
      }
    } catch (_e) {
      if (!openedNative) showFailToast();
    }
  }, false);
})();

/* ============================================================================
 * NEW: Report problem feature
 * ----------------------------------------------------------------------------
 * Кнопка "Сообщить о проблеме" во вкладке Профиль + bottom-sheet модалка
 * с textarea. Отправка идёт через supabase.saveReport(message) (см. supabase.js).
 *
 * Зависимости:
 *   • ProtoSheet.open/close - единая система модалок (см. начало app.js)
 *   • showToast(message, type) - единая система уведомлений
 *   • haptic() - Telegram WebApp вибро-отклик
 *   • t() - i18n
 *   • getEl() - DOM cache
 *   • window.saveReport - async helper из supabase.js
 *   • window.getTelegramIdentity - для проверки наличия Telegram-пользователя
 *
 * Поведение:
 *   1) Нажатие на #reportProblemBtn → openReportSheet()
 *   2) В модалке - textarea + счётчик + Отмена / Отправить + крестик ✕
 *   3) Отправка:
 *        a) Валидация - текст не пустой;
 *        b) Блокировка кнопки + текст "Отправляем…";
 *        c) await window.saveReport(text);
 *        d) Успех → toast "Спасибо…", закрыть и очистить;
 *        e) Ошибка → toast "Не удалось…", разблокировать кнопку (поле НЕ чистим);
 *   4) Pending: sendResolutionPush(telegram_id) - заглушка (см. ниже).
 * ============================================================================ */
(function initReportProblem() {
  // NEW: Report problem feature - точка входа из вкладки Профиль.

  // ── DOM refs через DOM cache ──
  var btnOpen     = getEl("reportProblemBtn");
  var sheet       = getEl("reportProblemSheet");
  var overlay     = getEl("reportProblemOverlay");
  var btnClose    = getEl("reportProblemClose");
  var btnCancel   = getEl("reportProblemCancel");
  var btnSend     = getEl("reportProblemSend");
  var textArea    = getEl("reportProblemText");
  var counterEl   = getEl("reportProblemCounter");
  // NEW: Media attachment in reports
  var fileInput   = getEl("reportMediaInput");
  var attachBtn   = getEl("reportAttachBtn");
  var previewEl   = getEl("reportMediaPreview");

  if (!btnOpen || !sheet || !overlay) return;

  // NEW: Report problem feature - флаг защиты от двойной отправки.
  var _isSending = false;
  // FIX: cancel button during upload - флаг "пользователь нажал Отмена".
  // Используется в submitReport, чтобы НЕ показывать toast "не удалось отправить"
  // при штатной отмене (reject от xhr.abort() в saveReport).
  var _isCancelling = false;

  // NEW: Media attachment in reports - лимиты и state выбранных файлов.
  var MAX_FILES = 5;
  var MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
  var selectedFiles = [];
  // URL.createObjectURL → нужно отзывать через revokeObjectURL, чтобы не текла память.
  var _previewUrls = [];

  function revokePreviewUrls() {
    for (var i = 0; i < _previewUrls.length; i++) {
      try { URL.revokeObjectURL(_previewUrls[i]); } catch (e) { /* noop */ }
    }
    _previewUrls = [];
  }

  function clearSelectedFiles() {
    selectedFiles = [];
    revokePreviewUrls();
    renderMediaPreview();
    if (fileInput) fileInput.value = ""; // позволит выбрать тот же файл повторно
  }

  function formatBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return Math.round(b / 1024) + " KB";
    return (b / (1024 * 1024)).toFixed(1) + " MB";
  }

  function renderMediaPreview() {
    if (!previewEl) return;
    revokePreviewUrls();
    previewEl.innerHTML = "";

    for (var i = 0; i < selectedFiles.length; i++) {
      var file = selectedFiles[i];
      var item = document.createElement("div");
      item.className = "report-media-item";
      item.setAttribute("data-idx", String(i));

      var url = URL.createObjectURL(file);
      _previewUrls.push(url);

      var thumb;
      if (file.type && file.type.indexOf("video/") === 0) {
        thumb = document.createElement("video");
        thumb.src = url;
        thumb.muted = true;
        thumb.playsInline = true;
        thumb.preload = "metadata";
        // Чтобы появился первый кадр в превью на iOS - добавляем #t=0.1
        thumb.src = url + "#t=0.1";
      } else {
        thumb = document.createElement("img");
        thumb.src = url;
        thumb.alt = "";
      }
      item.appendChild(thumb);

      var badge = document.createElement("div");
      badge.className = "report-media-item__badge";
      badge.textContent = (file.type && file.type.indexOf("video/") === 0 ? "VID" : "IMG")
        + " · " + formatBytes(file.size);
      item.appendChild(badge);

      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "report-media-item__remove";
      rm.setAttribute("aria-label", "Remove");
      rm.textContent = "×";
      rm.disabled = _isSending;
      // bind index через closure
      (function (idx) {
        rm.addEventListener("click", function (e) {
          e.stopPropagation();
          if (_isSending) return;
          selectedFiles.splice(idx, 1);
          renderMediaPreview();
          syncAttachBtnState();
          if (typeof haptic === "function") haptic("light");
        });
      })(i);
      item.appendChild(rm);

      previewEl.appendChild(item);
    }
  }

  function syncAttachBtnState() {
    if (!attachBtn) return;
    var full = selectedFiles.length >= MAX_FILES;
    attachBtn.classList.toggle("report-attach-btn--full", full);
    attachBtn.disabled = full || _isSending;
  }

  function onFilesPicked(fileList) {
    if (!fileList || !fileList.length) return;
    var added = 0;
    var arr = Array.prototype.slice.call(fileList);

    for (var i = 0; i < arr.length; i++) {
      var f = arr[i];
      if (selectedFiles.length >= MAX_FILES) {
        showToast(t("report.toast.mediaTooMany"), "error");
        if (typeof haptic === "function") haptic("error");
        break;
      }
      var isImage = f.type && f.type.indexOf("image/") === 0;
      var isVideo = f.type && f.type.indexOf("video/") === 0;
      if (!isImage && !isVideo) {
        showToast(t("report.toast.mediaBadType"), "error");
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        showToast(t("report.toast.mediaTooBig", { name: f.name }), "error");
        continue;
      }
      selectedFiles.push(f);
      added++;
    }

    if (added > 0) {
      renderMediaPreview();
      syncAttachBtnState();
      if (typeof haptic === "function") haptic("light");
    }
    // Сброс value, чтобы повторный выбор того же файла триггерил change.
    if (fileInput) fileInput.value = "";
  }

  function openReportSheet() {
    if (typeof haptic === "function") haptic("light");
    if (textArea) {
      textArea.value = "";
      updateCounter();
    }
    // NEW: Media attachment in reports - каждое открытие модалки начинает с пустого state.
    clearSelectedFiles();
    setSendingState(false);
    syncAttachBtnState();
    // PREMIUM PROGRESS BAR - гарантированно сбрасываем прогресс при открытии
    hideProgressBar();
    ProtoSheet.open(sheet, overlay);
    // Фокус ставим после анимации, чтобы клавиатура не дёргала sheet вверх раньше времени.
    setTimeout(function () {
      if (textArea && sheet.classList.contains("open")) textArea.focus();
    }, 320);
  }

  function closeReportSheet() {
    if (_isSending) return; // не закрываем во время отправки (overlay/X должны блокировать)
    ProtoSheet.close(sheet, overlay, {
      onClosed: function () {
        if (textArea) {
          textArea.value = "";
          updateCounter();
        }
        clearSelectedFiles();
        // PREMIUM PROGRESS BAR - на всякий случай сбрасываем прогресс после закрытия
        hideProgressBar();
      }
    });
  }

  // FIX: cancel button during upload - обработчик кнопки "Отмена".
  // Вне отправки - обычное закрытие. Во время отправки - abort всех активных
  // XHR-аплоадов, force-close модалки, без toast "ошибка".
  function cancelDuringUpload() {
    if (!_isSending) {
      closeReportSheet();
      return;
    }
    if (typeof haptic === "function") haptic("light");
    _isCancelling = true;
    if (typeof window.cancelReportUpload === "function") {
      window.cancelReportUpload();
    }
    // Сразу гасим прогресс-бар (без error-вспышки - это штатная отмена, не сбой).
    hideProgressBar();
    // Снимаем sending state, чтобы ProtoSheet.close сработал без early-return.
    _isSending = false;
    ProtoSheet.close(sheet, overlay, {
      onClosed: function () {
        if (textArea) {
          textArea.value = "";
          updateCounter();
        }
        clearSelectedFiles();
        hideProgressBar();
        // Reset флага через тик, чтобы submitReport's catch успел его увидеть.
        setTimeout(function () { _isCancelling = false; }, 100);
      }
    });
  }

  function setSendingState(isSending) {
    _isSending = !!isSending;
    if (btnSend) {
      btnSend.disabled = _isSending;
      btnSend.textContent = _isSending
        ? (selectedFiles.length > 0 ? t("report.modal.uploading") : t("report.modal.sending"))
        : t("report.modal.send");
    }
    // FIX: cancel button during upload - НЕ блокируем btnCancel во время отправки.
    // Теперь нажатие во время _isSending вызывает cancelDuringUpload() (см. wiring ниже).
    if (btnCancel) btnCancel.disabled = false;
    if (btnClose)  btnClose.disabled  = _isSending;
    if (textArea)  textArea.disabled  = _isSending;
    // NEW: Media attachment in reports - блокируем attach и remove-кнопки во время отправки
    if (attachBtn) attachBtn.disabled = _isSending || selectedFiles.length >= MAX_FILES;
    if (previewEl) {
      var rms = previewEl.querySelectorAll(".report-media-item__remove");
      for (var i = 0; i < rms.length; i++) rms[i].disabled = _isSending;
    }
    // PREMIUM PROGRESS ANIMATION - запуск/сброс анимации.
    // Mode выбирается на основе наличия файлов: с файлами получаем REAL прогресс
    // от XHR, без файлов запускается RAF fake-progress (text-only request).
    if (_isSending) {
      var hasMedia = selectedFiles.length > 0;
      startProgressBar({ real: hasMedia });
    } else if (
      !sheet.classList.contains("report-uploading--done") &&
      !sheet.classList.contains("report-uploading--error")
    ) {
      // Не сбрасываем, если только что показали галочку/error - их скроет
      // completeProgressBar()/errorProgressBar() сами в нужный момент.
      hideProgressBar();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PREMIUM PROGRESS ANIMATION (v2) - JS-driven через CSS-переменные.
  //
  // Модель: единый progress (0..1) хранится в _progressValue.
  // setProgress(p) - клампит, считает --p-vert / --p-horz, пушит на sheet.
  // startProgressBar({real}) - initialize:
  //   real=true   → ждём reportProgress() от внешнего источника (XHR)
  //   real=false  → RAF-loop: ease-out до 0.85 за ~1.4s (для text-only reports)
  // reportProgress(p) - внешний пуш (вызывается из onProgress в saveReport).
  // completeProgressBar(cb) - стопает RAF, p=1, --done класс, burst, callback ~1.1s.
  // errorProgressBar(cb) - стопает RAF, --error класс (красная вспышка + fade), ~0.65s.
  // hideProgressBar() - мгновенный сброс всех классов и transforms.
  // ──────────────────────────────────────────────────────────────────────────
  var _progressValue = 0;
  var _progressRafId = null;
  var _progressStartTs = 0;

  function _applyProgressVars(p) {
    if (!sheet) return;
    var pClamped = Math.max(0, Math.min(1, p));
    var pVert = Math.min(1, pClamped * 2);
    var pHorz = Math.max(0, pClamped * 2 - 1);
    sheet.style.setProperty("--p-vert", pVert.toFixed(4));
    sheet.style.setProperty("--p-horz", pHorz.toFixed(4));
  }

  function setProgress(p) {
    _progressValue = Math.max(_progressValue, Math.max(0, Math.min(1, p)));
    _applyProgressVars(_progressValue);
  }

  function _cancelFakeProgress() {
    if (_progressRafId != null) {
      try { cancelAnimationFrame(_progressRafId); } catch (e) { /* noop */ }
      _progressRafId = null;
    }
  }

  // RAF-loop с ease-out cubic-bezier (0.16, 1, 0.3, 1) аппроксимирован через
  // 1 - (1-t)^3 - достаточно близко на глаз. 1.4s до 0.85.
  function _startFakeProgress() {
    _cancelFakeProgress();
    _progressStartTs = (window.performance && performance.now) ? performance.now() : Date.now();
    var startVal = _progressValue;
    var targetVal = 0.85;
    var duration = 1400;

    function tick(nowArg) {
      var now = (typeof nowArg === "number")
        ? nowArg
        : ((window.performance && performance.now) ? performance.now() : Date.now());
      var t = Math.max(0, Math.min(1, (now - _progressStartTs) / duration));
      var eased = 1 - Math.pow(1 - t, 3);
      var v = startVal + (targetVal - startVal) * eased;
      // setProgress() гарантирует монотонность - никогда не откатывает прогресс назад.
      setProgress(v);
      if (t < 1 && _progressRafId != null) {
        _progressRafId = requestAnimationFrame(tick);
      }
    }
    _progressRafId = requestAnimationFrame(tick);
  }

  function startProgressBar(opts) {
    if (!sheet) return;
    opts = opts || {};
    // Полный сброс предыдущего цикла без анимации, затем normalize.
    _cancelFakeProgress();
    _progressValue = 0;
    sheet.classList.add("report-progress--reset");
    sheet.classList.remove("report-uploading", "report-uploading--done", "report-uploading--error");
    _applyProgressVars(0);
    void sheet.offsetWidth; // reflow с reset (без transition)
    sheet.classList.remove("report-progress--reset");
    void sheet.offsetWidth; // reflow без reset (теперь transitions активны)
    sheet.classList.add("report-uploading");

    if (!opts.real) {
      _startFakeProgress();
    }
    // В real-mode инициатор сам будет звать reportProgress(p).
  }

  // Внешний пуш реального прогресса (из onProgress в saveReport).
  // Маппим p ∈ [0..1] → [0..0.95], оставляя финальные 5% на финиш-анимацию.
  function reportProgress(p) {
    _cancelFakeProgress(); // если был fake - переключаемся на real
    setProgress(Math.max(0, Math.min(1, p)) * 0.95);
  }

  function completeProgressBar(onAfter) {
    if (!sheet) { if (onAfter) onAfter(); return; }
    _cancelFakeProgress();
    setProgress(1);
    sheet.classList.remove("report-uploading--error");
    sheet.classList.add("report-uploading--done");
    // Total finish time: 0.32s burst delay + 0.95s burst animation = 1.27s.
    // Закрываем чуть раньше пика fade-out частиц, на 1100ms - galочка успевает
    // нарисоваться (~0.18 delay + 0.45 draw = 0.63s), burst успевает на peak (0.32+0.18=0.5s).
    setTimeout(function () {
      if (onAfter) onAfter();
    }, 1100);
  }

  function errorProgressBar(onAfter) {
    if (!sheet) { if (onAfter) onAfter(); return; }
    _cancelFakeProgress();
    sheet.classList.remove("report-uploading--done");
    sheet.classList.add("report-uploading--error");
    // reportErrorFade длится 0.65s. Даём ещё +50ms на догорание.
    setTimeout(function () {
      hideProgressBar();
      if (onAfter) onAfter();
    }, 700);
  }

  function hideProgressBar() {
    if (!sheet) return;
    _cancelFakeProgress();
    _progressValue = 0;
    sheet.classList.add("report-progress--reset");
    sheet.classList.remove("report-uploading", "report-uploading--done", "report-uploading--error");
    _applyProgressVars(0);
    void sheet.offsetWidth;
    setTimeout(function () {
      if (sheet) sheet.classList.remove("report-progress--reset");
    }, 50);
  }

  function updateCounter() {
    if (!counterEl || !textArea) return;
    var len = (textArea.value || "").length;
    var max = textArea.maxLength > 0 ? textArea.maxLength : 2000;
    counterEl.textContent = len + " / " + max;
  }

  // NEW: Report problem feature - debounce на счётчик, чтобы не дёргать DOM
  // на каждое нажатие при длинных сообщениях. Сам textarea обновляется браузером
  // мгновенно, дебаунс лишь снижает частоту обновления визуального счётчика.
  var debouncedCounter = (typeof debounce === "function")
    ? debounce(updateCounter, 50)
    : updateCounter;

  if (textArea) {
    textArea.addEventListener("input", debouncedCounter);
  }

  /**
   * NEW: Report problem feature - основная функция отправки.
   * Никогда не throw - всегда возвращает { ok, error? } чтобы UI мог
   * мягко обработать обе ветки и не упасть.
   */
  async function submitReport() {
    if (_isSending) return;

    var text = (textArea && textArea.value ? textArea.value.trim() : "");

    if (!text) {
      if (textArea) {
        textArea.classList.remove("error");
        // force reflow для перезапуска shake-анимации (паттерн уже используется в проекте)
        void textArea.offsetWidth;
        textArea.classList.add("error");
        textArea.focus();
      }
      showToast(t("report.modal.empty"), "error");
      if (typeof haptic === "function") haptic("medium");
      return;
    }

    // Проверка наличия Telegram-пользователя ДО показа "Отправляем…",
    // чтобы юзер сразу понял, что без Telegram-контекста отправка невозможна.
    if (typeof window.getTelegramIdentity === "function") {
      var who = window.getTelegramIdentity();
      if (!who) {
        showToast(t("report.toast.noUser"), "error");
        if (typeof haptic === "function") haptic("error");
        return;
      }
    }

    setSendingState(true);
    if (typeof haptic === "function") haptic("light");

    // NEW: Report problem feature - simple telegramId extraction (`tg` is defined at top of app.js)
    const telegramId = window.tgUserId || tg?.initDataUnsafe?.user?.id;

    var result = { ok: false };
    try {
      if (typeof window.saveReport === "function") {
        // NEW: Media attachment in reports - передаём массив выбранных файлов
        // PREMIUM PROGRESS ANIMATION (real) - onProgress(p) пушит реальный прогресс
        // от XHR.upload.onprogress в общий progress bar (через reportProgress).
        result = await window.saveReport(
          telegramId,
          text,
          selectedFiles,
          function (p) { reportProgress(p); }
        );
      } else {
        result = { ok: false, error: "saveReport_missing" };
      }
    } catch (e) {
      console.error("[Report] submitReport exception:", e);
      result = { ok: false, error: e && e.message ? e.message : "exception" };
    }

    if (result && result.ok) {
      // PREMIUM PROGRESS BAR - финиш-анимация: добиваем до 1.0, рисуем галочку,
      // и только потом закрываем модалку, чтобы пользователь увидел финал.
      if (typeof haptic === "function") haptic("medium");

      // NEW: Report problem feature - заглушка для будущего push-уведомления
      // о факте решения проблемы. Когда backend помечает report.resolved=true
      // и отправляет push, эта функция станет реальной отправкой.
      sendResolutionPush(telegramId);

      completeProgressBar(function () {
        showToast(t("report.toast.success"), "success", { duration: 3500 });
        // Снимаем sending state ПОСЛЕ финиш-анимации, чтобы кнопки не "прыгали".
        _isSending = false;
        if (btnSend)   btnSend.disabled   = false;
        if (btnCancel) btnCancel.disabled = false;
        if (btnClose)  btnClose.disabled  = false;
        if (textArea) {
          textArea.disabled = false;
          textArea.value = "";
        }
        if (attachBtn) attachBtn.disabled = false;
        updateCounter();
        clearSelectedFiles();
        if (btnSend) btnSend.textContent = t("report.modal.send");
        ProtoSheet.close(sheet, overlay);
      });
    } else {
      // PREMIUM PROGRESS ANIMATION (error) - красная вспышка линий + fade-out
      // вместо мгновенного скрытия. Toast и haptic срабатывают сразу,
      // разблокировку кнопок делаем после анимации, чтобы не "прыгало".
      console.error("[Report] Ошибка:", result && result.error);

      // FIX: cancel button during upload - если пользователь нажал "Отмена",
      // saveReport возвращает ошибку "upload aborted" из-за xhr.abort().
      // Полагаемся на флаг _isCancelling (выставляется синхронно в момент клика).
      // Дополнительно ловим текст "aborted" - на случай браузеров, где abort()
      // мог сработать без участия нашего обработчика.
      var wasAborted = _isCancelling ||
        (result && result.error && /\babort(ed)?\b/i.test(String(result.error)));
      if (wasAborted) {
        // Модалка уже закрывается через cancelDuringUpload → выходим тихо.
        return;
      }
      // NEW: Media attachment in reports - если сбой произошёл на конкретном файле,
      // используем переведённый ключ с именем файла.
      var errMsg;
      if (result && result.failedFile) {
        errMsg = t("report.toast.mediaUploadError", { name: result.failedFile });
      } else if (result && result.error) {
        errMsg = String(result.error);
      } else {
        errMsg = t("report.toast.failed");
      }
      showToast(errMsg, "error", { duration: 4500 });
      if (typeof haptic === "function") haptic("error");

      errorProgressBar(function () {
        setSendingState(false);
      });
      // Поле и файлы НЕ чистим - пользователь может исправить и нажать снова.
    }
  }

  /**
   * NEW: Report problem feature - placeholder.
   * Реальная отправка push будет привязана к событию `reports.resolved=true`
   * на backend (Edge Function / cron) - это правильная точка отправки,
   * потому что клиент не знает, когда отчёт фактически решён.
   *
   * TODO: отправить push когда проблема решена
   *   • Backend: подписаться на UPDATE `reports` SET resolved=true
   *   • Использовать Telegram Bot API sendMessage(chat_id=telegram_id, …)
   *   • Помечать report.notification_sent=true после успешной доставки
   *   • Локализация push-текста по последнему известному settings.language
   */
  function sendResolutionPush(telegramId) {
    console.log(
      "[Report] sendResolutionPush placeholder - telegram_id=" + telegramId,
      "(будет отправлен с backend, когда отчёт получит resolved=true)"
    );
  }

  // ── Event wiring ──
  btnOpen.addEventListener("click", openReportSheet);
  if (btnClose)   btnClose.addEventListener("click", closeReportSheet);
  // FIX: cancel button during upload - Cancel теперь умеет прерывать аплоад
  if (btnCancel)  btnCancel.addEventListener("click", cancelDuringUpload);
  if (overlay)    overlay.addEventListener("click", closeReportSheet);
  if (btnSend)    btnSend.addEventListener("click", submitReport);

  // NEW: Media attachment in reports - wiring attach-кнопки и file-input.
  if (attachBtn && fileInput) {
    attachBtn.addEventListener("click", function () {
      if (_isSending || selectedFiles.length >= MAX_FILES) return;
      fileInput.click();
    });
    fileInput.addEventListener("change", function (e) {
      onFilesPicked(e.target.files);
    });
  }

  // Свайп вниз для закрытия (как у остальных bottom-sheet модалок).
  if (typeof ProtoSheet !== "undefined" && ProtoSheet.initSwipe) {
    ProtoSheet.initSwipe(sheet, closeReportSheet);
  }

  // Снимаем подсветку ошибки при первом вводе.
  if (textArea) {
    textArea.addEventListener("focus", function () {
      textArea.classList.remove("error");
    });
  }
})();

/* ============================================================================
 * OPTIMIZATION SUMMARY - Protocol Finance Mini App (app.js)
 * ============================================================================
 *
 * Цель: ускорить hot-paths и убрать дублирование, НЕ меняя поведение.
 * Backup проекта сделан пользователем ДО оптимизации.
 *
 * ── ЧТО СДЕЛАНО ──────────────────────────────────────────────────────────────
 *
 * 1. DOM CACHE (`domCache` + `getEl(id)`)
 *    Добавлен лёгкий кэш для `document.getElementById` в hot-path функциях,
 *    которые вызываются на каждое изменение состояния / каждый рендер:
 *      • recalcPlan()              - 2 замены
 *      • saveFullState()           - 2 замены
 *      • syncFlexibleUI()          - 14 замен (самый горячий путь UI)
 *      • applyFlexibleSideVisibility() - 6 замен
 *      • renderGoals()             - 11 замен (titleEl, totalEl, savedEl, ...)
 *      • renderAccountsUI()        - 3 замены
 *      • updatePlanHeader()        - 4 замены
 *      • renderFlexModelSummary()  - 7 замен
 *      • initCashflowSettings()    - 20 замен
 *      • Event editor (открывается часто) - 6 замен
 *    Узлы кешируются только когда они `isConnected` - это безопасно при ре-
 *    рендере фрагментов DOM.
 *    Топ-level `const`-объявления (incomeInput, goalInput, calculateBtn, ...)
 *    оставлены без изменений - они выполняются один раз при загрузке.
 *
 * 2. DEBOUNCE (250 ms) для тяжёлых input-каскадов
 *    `fixedIncomeInput` и `fixedExpenseInput` ранее вызывали
 *    `updateState() + recalcPlan()` на КАЖДОЕ нажатие клавиши, что запускало
 *    весь движок CashflowEngine + renderGoals + renderAccountsUI + syncFlexibleUI
 *    + saveFullState. Теперь форматирование числа и подстройка курсора
 *    срабатывают мгновенно (UX без задержки), а тяжёлый каскад откладывается
 *    на 250 мс после последнего ввода.
 *
 * 3. HELPER `formatNumericInput(el)`
 *    Извлечён повторяющийся блок (4 копии) сохранения позиции курсора при
 *    форматировании числового input в hot-path обработчиках:
 *      • fixedIncomeInput
 *      • fixedExpenseInput
 *      • expAmtInput
 *    Поведение полностью идентично исходному.
 *
 * 4. `applyFlexibleSideVisibility` уже разделена с helper `applySideVisibility`
 *    в исходном коде - дополнительный рефакторинг не требовался. Это уже
 *    единый источник правды для visibility логики (используется и из
 *    `initCashflowSettings`, и из `syncFlexibleUI`).
 *
 * ── ЧТО НАМЕРЕННО НЕ ТРОГАЛОСЬ (риск регрессий) ──────────────────────────────
 *
 *  • Event delegation для `forEach(addEventListener)` в render-функциях
 *    (renderAdvancedGoals, renderDebtList, renderCategoryList и др.).
 *    Замена потребует унификации data-атрибутов и проверки всех ветвей кликов.
 *  • Batch-рендер textContent/innerHTML - большинство кейсов уже использует
 *    единичные innerHTML с шаблонной строкой; точечные textContent в
 *    syncFlexibleUI/renderGoals безопасно оставить как есть.
 *  • Разделение на отдельные файлы (goals-advanced.js, debts.js):
 *    все большие IIFE (initGoalsSystem, initDebtsScreen, initPaceChangeScreen,
 *    initFlipSwipe, initAccountStats) разделяют десятки модуль-локальных
 *    переменных (`accounts`, `factHistory`, `plannedMonthly`, `chosenPlan`,
 *    `lastCalc`, `factRatio`, `goalCompleted`, `isInitialized`, ...).
 *    Вынос потребует либо перевешивания их в `window.*` (загрязнение глобала),
 *    либо большого рефакторинга всех ссылок - оба варианта нарушают принцип
 *    "минимально-инвазивно". Это потенциальная будущая задача (требует
 *    полноценного модульного дизайна, например через бандлер).
 *
 * ── ОЖИДАЕМЫЙ ЭФФЕКТ ─────────────────────────────────────────────────────────
 *
 *  • Снижение нагрузки при наборе в `fixedIncome/Expense` - пересчёт плана
 *    идёт не 5-10 раз в секунду, а максимум 4 раза/сек.
 *  • Сокращение времени каждого `syncFlexibleUI()` за счёт устранения
 *    14 `getElementById` запросов (заменены на хеш-лукапы).
 *  • Одинаковые поведение и UX - все сценарии гибкой модели
 *    (fixed/variable, custom monthDays, событий, дат старта) работают
 *    идентично исходной реализации.
 *
 * ── ВАЛИДАЦИЯ ────────────────────────────────────────────────────────────────
 *
 *  • `node --check app.js` - passes (синтаксис).
 *  • Поведение `syncFlexibleUI`, `applyFlexibleSideVisibility`,
 *    `recalcPlan`, `renderFlexModelSummary` - сохранено 1-в-1.
 *
 * ============================================================================ */

/* ============================================================================
 * GOAL COMPLETION FEATURE
 * ----------------------------------------------------------------------------
 * Полный flow завершения цели:
 *   1) recalcPlan/applyFact обнаруживает accounts.main >= goalTotal →
 *      goalCompleted=true, fireCelebration() (конфетти), затем через 600ms -
 *      showGoalCompletionModal(snapshot).
 *   2) checkGoalCompletion() пропускает i=0 (primary), чтобы не было гонки.
 *   3) Пользователь нажимает "Я молодец!" → confirmGoalCompletion():
 *      - архивирует primary в state.completedGoals (с durationMonths и датой)
 *      - очищает goalInput.value, goalMeta.title, goalCompleted
 *      - ресетит goals[0] до placeholder (amount=0, saved=0)
 *      - recalcPlan() → renderGoals() → empty-state карточка
 *   4) renderGoals() переключает #activeGoalCard <-> #emptyGoalCard по
 *      primaryAmount === 0 (см. правки выше).
 *   5) #createNewGoalBtn открывает существующий goalEditorSheet.
 *   6) History card click → showGoalHistoryDetail(goalData) - детальная модалка.
 *
 * ВАЖНО: accounts.main, factHistory, initialBalance НЕ сбрасываются -
 * это финансовые данные пользователя. Очищается только goal metadata.
 * ============================================================================ */

(function initGoalCompletionFeature() {

  // ── DOM refs (резолвим лениво в showGoalCompletionModal, чтобы вписаться
  //    в порядок инициализации остального кода). ──
  function _q(id) { return document.getElementById(id); }

  // ── Helpers ──
  function _completionDurationMonths() {
    if (typeof factHistory === "undefined" || !factHistory || !factHistory.length) {
      return 0;
    }
    var sorted = factHistory.slice().sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });
    var startDate = new Date(sorted[0].date);
    var now = new Date();
    var months = (now.getFullYear() - startDate.getFullYear()) * 12 +
                 (now.getMonth() - startDate.getMonth());
    return months < 1 ? 1 : months;
  }

  function _factHistoryStartDate() {
    if (typeof factHistory === "undefined" || !factHistory || !factHistory.length) {
      return null;
    }
    var sorted = factHistory.slice().sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });
    return sorted[0].date || null;
  }

  // ── Public: показ модалки поздравления ──
  // snapshot: { name, amount, saved } захватывается в apply-fact ДО мутаций.
  // PREMIUM GOAL COMPLETION - синхронно с открытием запускает асимметричные конфетти
  // (left emerald + right blue) и эмоциональный текст в стиле premium-UX.
  window.showGoalCompletionModal = function (snapshot) {
    var overlay = _q("goalCompleteOverlay");
    var sheet   = _q("goalCompleteSheet");
    if (!overlay || !sheet) return;

    var sym = (typeof getCurrencySymbol === "function") ? getCurrencySymbol() : "₽";
    var amountStr = (typeof fmtConverted === "function")
      ? fmtConverted(snapshot.amount || snapshot.saved || 0)
      : String(snapshot.amount || 0);
    var nameStr = snapshot.name || t("misc.defaultGoalTitle");

    // PREMIUM GOAL COMPLETION - subtitle с суммой и названием цели (emerald accent).
    var subtitleEl = _q("goalCompleteSubtitle");
    if (subtitleEl) {
      var subtitleTpl = t("goalComplete.modal.subtitle");
      var amountHtml = "<b>" + escapeHtmlSafe(amountStr + " " + sym) + "</b>";
      var nameHtml   = escapeHtmlSafe(nameStr);
      subtitleEl.innerHTML = subtitleTpl
        .replace("{amount}", amountHtml)
        .replace("{name}", nameHtml);
    }

    // Сохраняем snapshot для confirmGoalCompletion.
    sheet.dataset.goalSnapshot = JSON.stringify(snapshot || {});

    ProtoSheet.open(sheet, overlay);

    // PREMIUM GOAL COMPLETION - fire конфетти сразу при открытии модалки.
    // requestAnimationFrame синхронизирует с CSS-анимацией открытия (translateY).
    requestAnimationFrame(function () {
      if (typeof firePremiumCelebration === "function") firePremiumCelebration();
    });
  };

  // ── Confirm: пользователь нажал "Я молодец!" ──
  function confirmGoalCompletion() {
    if (typeof haptic === "function") haptic("medium");

    var sheet   = _q("goalCompleteSheet");
    var overlay = _q("goalCompleteOverlay");
    if (!sheet || !overlay) return;

    var snapshot = {};
    try { snapshot = JSON.parse(sheet.dataset.goalSnapshot || "{}"); } catch (e) {}

    // ── 1) Архивируем в completedGoals ──
    var completed = (typeof getState === "function" ? (getState().completedGoals || []) : []);
    var durationMonths = _completionDurationMonths();
    var startDateIso = _factHistoryStartDate();
    var goalsArr = (typeof getGoals === "function") ? getGoals() : [];
    var primaryGoal = goalsArr[0] || null;
    completed.push({
      id: (primaryGoal && primaryGoal.id) || ("goal_" + Date.now()),
      title: snapshot.name || (primaryGoal && primaryGoal.title) || t("misc.defaultGoalTitle"),
      amount: Number(snapshot.amount) || (primaryGoal && primaryGoal.amount) || 0,
      saved: Number(snapshot.saved) || (primaryGoal && primaryGoal.saved) || 0,
      completedDate: new Date().toISOString(),
      startDate: startDateIso,
      durationMonths: durationMonths
    });
    if (typeof updateState === "function") {
      updateState({ completedGoals: completed });
    }

    // ── 2) Очищаем primary goal в UI и state ──
    if (typeof goalInput !== "undefined" && goalInput) {
      goalInput.value = "";
    }
    if (typeof goalMeta !== "undefined" && goalMeta) {
      goalMeta.title = "";
    }
    // Глобальный goalCompleted - сбросить, чтобы следующая цель могла триггерить модалку.
    if (typeof goalCompleted !== "undefined") {
      // eslint-disable-next-line no-global-assign
      try { goalCompleted = false; } catch (e) { window.goalCompleted = false; }
    }

    // Ресетим goals[0] до placeholder (как в checkGoalCompletion).
    if (goalsArr.length > 0) {
      goalsArr[0] = {
        id: "goal_1",
        title: t("advGoals.mainGoal") || t("misc.defaultGoalTitle"),
        amount: 0,
        saved: 0,
        priority: 1,
        monthlyShare: 0,
        monthsLeft: 0,
        paused: false
      };
      if (typeof persistGoals === "function") persistGoals(goalsArr);
    }

    // ── 3) Сбрасываем lastCalc, чтобы графики/верктикаты не использовали стэйл-данные ──
    if (typeof lastCalc !== "undefined" && lastCalc) {
      lastCalc.ok = false;
      lastCalc.effectiveGoal = 0;
      lastCalc.months = 0;
      lastCalc.monthlySave = 0;
    }

    // ── 3b) Сброс накоплений прошлой цели (иначе factHistory «протекает» в новую) ──
    factHistory = [];
    accounts.main = 0;
    accounts.reserve = 0;
    initialBalance = 0;
    planStartValue = 0;
    factRatio = null;
    plannedMonthly = 0;
    if (typeof updateState === "function") {
      updateState({
        factHistory: [],
        accounts: { main: 0, reserve: 0 },
        initialBalance: 0,
        planStartValue: 0,
        factRatio: null,
        plannedMonthly: 0,
        chosenPlan: null,
        isInitialized: false
      });
    }

    // ── 4) Закрываем модалку с анимацией + полный refresh UI ──
    ProtoSheet.close(sheet, overlay, {
      onClosed: function () {
        if (typeof recalcPlan === "function") recalcPlan();
        if (typeof renderProtocolAdviceGraph === "function") renderProtocolAdviceGraph();
        if (typeof updateGraphGoalIndicator === "function") updateGraphGoalIndicator();
        if (typeof saveFullState === "function") saveFullState();
        // FIX: goal completion UI - включаем app-lock после закрытия поздравительной модалки.
        //      Goal только что был обнулён, активный screen остаётся текущим (обычно advice).
        if (typeof window._updateAppLock === "function") window._updateAppLock();
      }
    });
  }

  // ── History detail modal ──
  window.showGoalHistoryDetail = function (goalData) {
    var overlay = _q("goalHistoryDetailOverlay");
    var sheet   = _q("goalHistoryDetailSheet");
    if (!overlay || !sheet || !goalData) return;

    if (typeof haptic === "function") haptic("light");

    var titleEl    = _q("goalHistoryDetailTitle");
    var amountEl   = _q("goalHistoryDetailAmount");
    var periodEl   = _q("goalHistoryDetailPeriod");
    var durationEl = _q("goalHistoryDetailDuration");
    var sym = (typeof getCurrencySymbol === "function") ? getCurrencySymbol() : "₽";

    if (titleEl) {
      titleEl.textContent = goalData.title || t("misc.defaultGoalTitle");
    }
    if (amountEl) {
      var amt = (typeof fmtConverted === "function")
        ? fmtConverted(goalData.saved || goalData.amount || 0)
        : String(goalData.saved || goalData.amount || 0);
      amountEl.textContent = amt + " " + sym;
    }
    if (periodEl) {
      var unknown = t("goalHistory.detail.dateUnknown");
      var fromStr = unknown, toStr = unknown;
      if (goalData.startDate) {
        var d1 = new Date(goalData.startDate);
        fromStr = getMonthName(d1.getMonth()) + " " + d1.getFullYear();
      }
      if (goalData.completedDate) {
        var d2 = new Date(goalData.completedDate);
        toStr = getMonthName(d2.getMonth()) + " " + d2.getFullYear();
      }
      periodEl.textContent = fromStr + " - " + toStr;
    }
    if (durationEl) {
      var months = Number(goalData.durationMonths) || 0;
      durationEl.textContent = months < 1
        ? t("goalHistory.detail.durationLessMonth")
        : t("goalHistory.detail.durationMonths", { n: months });
    }

    ProtoSheet.open(sheet, overlay);
  };

  function closeGoalHistoryDetail() {
    var overlay = _q("goalHistoryDetailOverlay");
    var sheet   = _q("goalHistoryDetailSheet");
    if (!overlay || !sheet) return;
    ProtoSheet.close(sheet, overlay);
  }

  // ── Wiring (DOMContentLoaded не нужен - этот файл подключается в конце <body>). ──

  // 1) Кнопка "Я молодец!" в congrats модалке.
  var completeBtn = _q("goalCompleteBtn");
  if (completeBtn) {
    completeBtn.addEventListener("click", confirmGoalCompletion);
  }

  // 2) Кнопка "Создать новую цель" в empty-state карточке.
  //    Открывает существующий goalEditorSheet (тот же flow, что и кнопка редактирования).
  // NEW: Full goal creation flow in Protocol tab - оба #createNewGoalBtn (на Goals tab)
  //      и #protocolCreateNewGoalBtn (на Protocol tab) теперь ведут на полноценный
  //      экран #screen-new-goal через window.openNewGoalScreen().
  // FIX: new goal creation flow - wire #protocolCreateNewGoalBtn (раньше был только Goals tab).
  ["createNewGoalBtn", "protocolCreateNewGoalBtn"].forEach(function (btnId) {
    var btn = _q(btnId);
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      if (typeof window.openNewGoalScreen === "function") window.openNewGoalScreen();
    });
  });

  // 3) History detail close handlers.
  var hdClose    = _q("goalHistoryDetailClose");
  var hdCloseBtn = _q("goalHistoryDetailCloseBtn");
  var hdOverlay  = _q("goalHistoryDetailOverlay");
  if (hdClose)    hdClose.addEventListener("click", closeGoalHistoryDetail);
  if (hdCloseBtn) hdCloseBtn.addEventListener("click", closeGoalHistoryDetail);
  if (hdOverlay)  hdOverlay.addEventListener("click", closeGoalHistoryDetail);

  // 4) Делегирование клика по карточкам в #goalHistoryList.
  //    Это работает с DOM-узлами, которые renderGoalHistory() создаёт динамически -
  //    нам не нужно перерезать обработчики при каждом рендере.
  var historyList = _q("goalHistoryList");
  if (historyList) {
    historyList.addEventListener("click", function (e) {
      var card = e.target.closest(".goal-history-card");
      if (!card) return;
      var idx = parseInt(card.getAttribute("data-history-idx") || "-1", 10);
      if (isNaN(idx) || idx < 0) return;
      var completed = (typeof getState === "function" ? (getState().completedGoals || []) : []);
      var goalData = completed[idx];
      if (goalData) window.showGoalHistoryDetail(goalData);
    });
  }
})();

/* ============================================================================
 * NEW: Full goal creation flow in Protocol tab
 * ----------------------------------------------------------------------------
 * 1) _syncProtocolEmptyState() - синхронизирует видимость
 *    #protocolEmptyGoalCard и #adviceCard на Protocol tab.
 *    Если у пользователя нет активной цели (primary goal amount === 0) - показываем
 *    empty-card и скрываем график; иначе - обратное.
 *
 * 2) window.openNewGoalScreen() - открывает экран #screen-new-goal с предзаполнением
 *    значениями из текущих accountStats, чтобы пользователь не вводил всё заново.
 *
 * 3) Submit (#newGoalSubmit) - валидирует все поля, заполняет
 *    goalInput/incomeInput/expensesInput/savedInput, обновляет goalMeta.title,
 *    accounts.main, initialBalance, planStartValue, saveMode/selectedMode,
 *    сбрасывает goalCompleted и factHistory. Затем вызывает recalcPlan() +
 *    renderProtocolAdviceGraph(). При chosenPlan===null устанавливает 'goal'.
 *
 * 4) Tempo segment: "По скорости" (mode buttons) vs "По сроку" (months input).
 *    В режиме "По сроку" mode выводится из target monthly vs free cashflow:
 *      ratio = required / (income - expenses)
 *      ratio <= 0.50 → calm; 0.50 < ratio <= 0.80 → normal; иначе aggressive.
 * ============================================================================ */

/* ────────────────────────────────────────────────────────────────────────────
 * ONBOARDING - пошаговый тур при первом запуске.
 * ────────────────────────────────────────────────────────────────────────────
 * Mechanic:
 *   1. Box-shadow trick для cutout: highlight-box получает огромный
 *      shadow (0 0 0 9999px rgba(0,0,0,0.74)), который накрывает экран
 *      ВОКРУГ box'а - в нём же остаётся «дырка» с emerald-обводкой.
 *      Совместимо везде, без clip-path.
 *   2. Tooltip позиционируется над/под target'ом по координатам
 *      getBoundingClientRect; стрелка указывает на центр target'а через
 *      CSS-переменную --onb-arrow-x.
 *   3. При смене шага меняем координаты - transition в CSS делает
 *      плавное «перетекание» подсветки с одного элемента на другой.
 *
 * Запуск: проверка appState.onboardingCompleted в _initialSync с задержкой
 *         1500ms (даём Supabase-sync догнать remote state).
 * Завершение: appState.onboardingCompleted=true → saveFullState() →
 *             fade-out + DOM cleanup.
 * ──────────────────────────────────────────────────────────────────────────── */

var _onboardingActive = false;
var _onboardingStepIdx = 0;
var _onboardingViewportHandler = null;
var _activeTour = null; // ссылка на текущий tour-объект из _TOURS
var _ONBOARDING_PADDING = 10; // px ореол вокруг target

// Predicate: возвращает true когда у пользователя есть ЛЮБЫЕ реальные
// данные в аккаунте - доходы, расходы, цели, события, накопления и т.д.
// Используется как defensive-фильтр: даже если onboardingCompleted в state
// ещё false (из-за миграционного пропуска или race-condition с cloud sync),
// мы НЕ показываем тур существующим пользователям и тихо отмечаем флаг.
function _userHasMeaningfulData() {
  try {
    var s = (typeof getState === "function") ? getState() : (window.appState || {});
    if (!s) return false;
    if (s.isInitialized === true) return true;
    if (Number(s.income)   > 0) return true;
    if (Number(s.expenses) > 0) return true;
    if (Number(s.goal)     > 0) return true;
    if (Number(s.saved)    > 0) return true;
    if (s.accounts) {
      if (Number(s.accounts.main)    > 0) return true;
      if (Number(s.accounts.reserve) > 0) return true;
    }
    if (Array.isArray(s.goals)           && s.goals.length           > 0) return true;
    if (Array.isArray(s.financialEvents) && s.financialEvents.length > 0) return true;
    if (Array.isArray(s.factHistory)     && s.factHistory.length     > 0) return true;
    if (Array.isArray(s.debts)           && s.debts.length           > 0) return true;
    return false;
  } catch (_e) { return false; }
}

// Predicate: возвращает true когда у пользователя нет резерва - тогда
// шаг "Резерв" в onboarding'е беззвучно пропускается. Используется
// через step.skipIf в _TOURS.firstLaunch.steps.
function _onbHasNoReserve() {
  try {
    var s = (typeof getState === "function") ? getState() : (window.appState || {});
    if (!s) return true;
    if (s.uiState && s.uiState.hasReserve === true) return false;
    if (s.accounts && Number(s.accounts.reserve) > 0) return false;
    return true;
  } catch (_e) { return true; }
}

// ─── Tour Registry ──────────────────────────────────────────────────────────
// Все туры приложения - один источник правды.
//
//   id              - ключ для startTour(id).
//   completionType  - "primary" (тур первого запуска: пишет в onboardingCompleted)
//                     или "premium" (per-feature: пишет в
//                     premiumOnboardingCompleted[featureKey]).
//   featureKey      - для premium-туров: ключ в premiumOnboardingCompleted.
//   requirePremium  - для premium-туров: true → пропустить если нет активной
//                     подписки (isPremiumActive()).
//   steps           - массив step-объектов:
//     { id, target?, screen?, expand?, titleKey, textKey }
//     • screen - если задан, перед показом шага вызовется openScreen(screen).
//     • target - CSS-селектор; null → centered modal без подсветки.
//     • expand - селектор-«расширитель» (берём closest(expand) для target'а).
//
// Premium-туры используют "Понял" вместо "Далее" если шаг один.
var _TOURS = {
  firstLaunch: {
    id: "firstLaunch",
    completionType: "primary",
    requirePremium: false,
    steps: [
      { id: "welcome",     screen: "calc",     target: null,                       titleKey: "onb.welcome.title",     textKey: "onb.welcome.text" },
      // Без expand: ".input-wrap" - wrapper включает margin-bottom инпута,
      // поэтому ореол получался ассиметричным снизу. Таргетим сам <input>.
      { id: "income",      screen: "calc",     target: "#income",                  titleKey: "onb.income.title",      textKey: "onb.income.text" },
      { id: "expenses",    screen: "calc",     target: "#expenses",                titleKey: "onb.expenses.title",    textKey: "onb.expenses.text" },
      { id: "goal",        screen: "calc",     target: "#goal",                    titleKey: "onb.goal.title",        textKey: "onb.goal.text" },
      // noHighlight: dim вырезает "окно" вокруг кнопки (она остаётся
      // подсвеченной сквозь затемнение), но emerald-обводка не рисуется -
      // достаточно tooltip'а со стрелкой указывающего на кнопку.
      { id: "continue",    screen: "calc",     target: "#calculate",               titleKey: "onb.continue.title",    textKey: "onb.continue.text",    noHighlight: true },
      { id: "mainAccount", screen: "accounts", target: '[data-account="main"]',    titleKey: "onb.mainAccount.title", textKey: "onb.mainAccount.text" },
      // Reserve-шаг показывается ВСЕГДА - сразу после mainAccount.
      // Если у юзера выбран сценарий «С резервом» → блок [data-account="reserve"]
      // видим, tooltip подсвечивает его как обычно. Если резерв не выбран →
      // блок скрыт (display:none), _resolveStepTarget вернёт null и
      // _positionOnboardingStep автоматически отрендерит centered modal с тем же
      // текстом про резерв - юзер всё равно узнает, что такое резерв.
      { id: "reserve",     screen: "accounts", target: '[data-account="reserve"]', titleKey: "onb.reserve.title",     textKey: "onb.reserve.text" },
      { id: "profile",     /* fixed-pos, любой экран */ target: "#profileBtn",     titleKey: "onb.profile.title",     textKey: "onb.profile.text" },
      { id: "final",       screen: "calc",     target: null,                       titleKey: "onb.final.title",       textKey: "onb.final.text" }
    ]
  },
  // ── Premium feature tours ───────────────────────────────────────────────
  // Один шаг на фичу: коротко и ёмко. Срабатывают при первом открытии каждой
  // премиум-функции пользователем С АКТИВНОЙ ПОДПИСКОЙ. Не двигают экран -
  // фича уже открыта пользовательским действием, мы только объясняем её.
  premiumFlexible: {
    id: "premiumFlexible",
    completionType: "premium",
    featureKey: "flexible",
    requirePremium: true,
    steps: [
      { id: "info", target: "#flexibleContent", titleKey: "onb.prem.flexible.title", textKey: "onb.prem.flexible.text" }
    ]
  },
  premiumPace: {
    id: "premiumPace",
    completionType: "premium",
    featureKey: "pace",
    requirePremium: true,
    steps: [
      { id: "info", target: "#screen-pace", titleKey: "onb.prem.pace.title", textKey: "onb.prem.pace.text" }
    ]
  },
  premiumDebts: {
    id: "premiumDebts",
    completionType: "premium",
    featureKey: "debts",
    requirePremium: true,
    steps: [
      { id: "info", target: "#screen-debts", titleKey: "onb.prem.debts.title", textKey: "onb.prem.debts.text" }
    ]
  },
  premiumAdvanced: {
    id: "premiumAdvanced",
    completionType: "premium",
    featureKey: "advanced",
    requirePremium: true,
    steps: [
      { id: "info", target: "#screen-advanced", titleKey: "onb.prem.advanced.title", textKey: "onb.prem.advanced.text" }
    ]
  },
  premiumStats: {
    id: "premiumStats",
    completionType: "premium",
    featureKey: "stats",
    requirePremium: true,
    steps: [
      { id: "info", target: '[data-account="main"]', titleKey: "onb.prem.stats.title", textKey: "onb.prem.stats.text" }
    ]
  }
};

// ─── Premium tour state helpers ─────────────────────────────────────────────
function _isPremiumTourDone(featureKey) {
  var s = (typeof getState === "function") ? getState() : (window.appState || {});
  return !!(s.premiumOnboardingCompleted && s.premiumOnboardingCompleted[featureKey] === true);
}
function _markPremiumTourDone(featureKey) {
  var s = (typeof getState === "function") ? getState() : (window.appState || {});
  var existing = (s.premiumOnboardingCompleted && typeof s.premiumOnboardingCompleted === "object")
    ? s.premiumOnboardingCompleted : {};
  var updated = Object.assign({}, existing);
  updated[featureKey] = true;
  try {
    if (typeof updateState === "function") {
      updateState({ premiumOnboardingCompleted: updated });
    } else if (window.appState) {
      window.appState.premiumOnboardingCompleted = updated;
    }
    if (typeof saveFullState === "function") saveFullState();
  } catch (_e) { /* noop */ }
}

// Проверка активной подписки для гейта премиум-туров. Дублирует логику
// isPremiumActive() из премиум-системы (см. app.js premium section), но
// безопасно работает даже до её инициализации.
function _isPremiumActiveForOnboarding() {
  if (typeof isPremiumActive === "function") {
    try { return !!isPremiumActive(); } catch (_e) { /* fall through */ }
  }
  var s = (typeof getState === "function") ? getState() : (window.appState || {});
  if (!s || s.isPremium !== true) return false;
  if (!s.premiumUntil) return false;
  var until = new Date(s.premiumUntil).getTime();
  return isFinite(until) && until > Date.now();
}

// ─── Public API ─────────────────────────────────────────────────────────────
// Главный entry-point. Использовать для всех туров.
function startTour(tourId, opts) {
  if (_onboardingActive) return; // не перебиваем активный тур
  var tour = _TOURS[tourId];
  if (!tour) {
    console.warn("[Onboarding] Unknown tour:", tourId);
    return;
  }
  var isForce = !!(opts && opts.force);

  // Premium-туры: гейт по активной подписке.
  if (tour.requirePremium && !_isPremiumActiveForOnboarding()) return;

  // Проверка флага «уже проходили» (если не force).
  var s = (typeof getState === "function") ? getState() : (window.appState || {});
  var alreadyDone = false;
  if (tour.completionType === "primary") {
    alreadyDone = (s.onboardingCompleted === true);
  } else if (tour.completionType === "premium" && tour.featureKey) {
    alreadyDone = _isPremiumTourDone(tour.featureKey);
  }
  if (alreadyDone && !isForce) return;

  // DEFENSIVE: для основного тура (firstLaunch) - если у пользователя
  // уже есть РЕАЛЬНЫЕ данные (доход/расход/цели/события/...), значит
  // он не новенький, даже если флаг onboardingCompleted в state ещё false
  // (миграция могла пропустить, либо cloud sync ещё не успел перетереть).
  // Тихо отмечаем тур как пройденный, персистим и не показываем тур.
  // Force-режим (из настроек «Перезапустить подсказки») обходит этот гейт.
  if (!isForce && tour.completionType === "primary" && _userHasMeaningfulData()) {
    try {
      if (typeof updateState === "function") {
        updateState({ onboardingCompleted: true });
      } else if (window.appState) {
        window.appState.onboardingCompleted = true;
      }
      if (typeof saveFullState === "function") saveFullState();
    } catch (_e) { /* noop */ }
    return;
  }

  _activeTour = tour;
  _onboardingStepIdx = 0;
  _onboardingActive = true;

  _renderOnboardingShell();

  _onboardingViewportHandler = function () {
    if (_onboardingActive && _activeTour) {
      _positionOnboardingStep(_activeTour.steps[_onboardingStepIdx]);
    }
  };
  window.addEventListener("resize", _onboardingViewportHandler);
  window.addEventListener("scroll", _onboardingViewportHandler, true);

  setTimeout(function () { _renderOnboardingStep(0); }, 80);
}

// Алиас для обратной совместимости - startOnboarding() → firstLaunch tour.
function startOnboarding() {
  startTour("firstLaunch");
}

// Удобный хелпер для запуска premium-тура по короткому id.
// featureKey: "flexible" | "pace" | "debts" | "advanced" | "stats"
function startPremiumFeatureTour(featureKey) {
  var map = {
    flexible: "premiumFlexible",
    pace:     "premiumPace",
    debts:    "premiumDebts",
    advanced: "premiumAdvanced",
    stats:    "premiumStats"
  };
  var tourId = map[featureKey];
  if (!tourId) return;
  startTour(tourId);
}

function _renderOnboardingShell() {
  var existing = document.getElementById("onboardingRoot");
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  // PERF архитектура: dimmer состоит из 4 независимых прямоугольников
  // (top/right/bottom/left), окружающих "дырку" вокруг target'а. У каждого
  // плоская solid-color заливка - анимация transform/scale GPU-cheap.
  // Highlight-border - отдельный пустой элемент с emerald-обводкой и
  // pulse-glow в ::after. Никакого 9999px box-shadow на движущемся
  // элементе → нет full-viewport repaint при transition.
  //
  // .is-priming - на момент ПЕРВОГО рендера выключает все transitions и
  // прячет элементы (visibility: hidden), чтобы избежать flash в углу.
  // Снимается через double-rAF после установки финальной позиции.
  var root = document.createElement("div");
  root.id = "onboardingRoot";
  root.className = "onboarding-root is-priming";
  root.innerHTML = [
    '<div class="onb-dim onb-dim--top"    id="onbDimTop"></div>',
    '<div class="onb-dim onb-dim--right"  id="onbDimRight"></div>',
    '<div class="onb-dim onb-dim--bottom" id="onbDimBottom"></div>',
    '<div class="onb-dim onb-dim--left"   id="onbDimLeft"></div>',
    '<div class="onboarding-highlight" id="onboardingHighlight"></div>',
    '<div class="onboarding-tooltip" id="onboardingTooltip" role="dialog" aria-live="polite">',
    '  <div class="onboarding-step-counter" id="onboardingStepCounter"></div>',
    '  <div class="onboarding-title" id="onboardingTitle"></div>',
    '  <div class="onboarding-text" id="onboardingText"></div>',
    '  <div class="onboarding-progress" id="onboardingProgress"></div>',
    '  <div class="onboarding-buttons">',
    '    <button type="button" class="onboarding-btn onboarding-btn--next" id="onboardingNextBtn"></button>',
    '    <button type="button" class="onboarding-btn onboarding-btn--skip" id="onboardingSkipBtn"></button>',
    '  </div>',
    '</div>'
  ].join("");
  document.body.appendChild(root);

  var skipBtn = document.getElementById("onboardingSkipBtn");
  var nextBtn = document.getElementById("onboardingNextBtn");
  if (skipBtn) skipBtn.addEventListener("click", _onOnboardingSkip);
  if (nextBtn) nextBtn.addEventListener("click", _onOnboardingNext);
}

// PERF helper: позиционирует 4 dim-прямоугольника вокруг "дырки" (x,y,w,h).
// При null - рисует полноэкранный dim (centered mode для welcome/final/huge-target).
// Каждый rect получает translate3d + width/height. Solid-color без shadow →
// repaint area минимальна, GPU compositing работает идеально.
function _setDimmerHole(x, y, w, h) {
  var vw = window.innerWidth  || document.documentElement.clientWidth;
  var vh = window.innerHeight || document.documentElement.clientHeight;
  var tEl = document.getElementById("onbDimTop");
  var rEl = document.getElementById("onbDimRight");
  var bEl = document.getElementById("onbDimBottom");
  var lEl = document.getElementById("onbDimLeft");
  if (!tEl || !rEl || !bEl || !lEl) return;

  function setRect(el, ex, ey, ew, eh) {
    ew = Math.max(0, ew);
    eh = Math.max(0, eh);
    // Element - base 1×1px, scale(w,h) растягивает до требуемого размера.
    // translate3d позиционирует. Чисто composite - GPU без layout reflow.
    el.style.transform = "translate3d(" + ex + "px, " + ey + "px, 0) scale(" + ew + ", " + eh + ")";
  }

  if (x === null) {
    // Centered mode - top покрывает весь viewport, остальные нулевые.
    setRect(tEl, 0, 0, vw, vh);
    setRect(rEl, 0, 0, 0, 0);
    setRect(bEl, 0, 0, 0, 0);
    setRect(lEl, 0, 0, 0, 0);
    return;
  }

  // Clamp значений к viewport-bounds - отрицательные размеры обнуляются.
  var x2 = x + w;
  var y2 = y + h;
  setRect(tEl, 0,    0,    vw,         y);            // над дыркой
  setRect(rEl, x2,   y,    vw - x2,    h);            // справа
  setRect(bEl, 0,    y2,   vw,         vh - y2);      // под дыркой
  setRect(lEl, 0,    y,    x,          h);            // слева
}

function _renderOnboardingStep(idx) {
  if (!_onboardingActive || !_activeTour) return;
  var step = _activeTour.steps[idx];
  if (!step) return;

  // Условный skip: если у шага есть predicate skipIf() который вернул true -
  // прыгаем к следующему шагу беззвучно (без UI-перехода). Поддерживает
  // несколько skip'ов подряд через рекурсивный вызов.
  if (typeof step.skipIf === "function") {
    var shouldSkip = false;
    try { shouldSkip = !!step.skipIf(); } catch (_e) { shouldSkip = false; }
    if (shouldSkip) {
      var nextIdx = idx + 1;
      if (nextIdx >= _activeTour.steps.length) {
        return _completeOnboarding();
      }
      _onboardingStepIdx = nextIdx;
      return _renderOnboardingStep(nextIdx);
    }
  }

  // Screen-switch: если шаг привязан к конкретному экрану и активный экран
  // не тот же - программно вызываем openScreen(). Затем небольшая задержка
  // под layout transition, и только потом рендерим контент шага.
  if (step.screen) {
    var currentActive = document.querySelector(".screen.active");
    var currentId = currentActive ? currentActive.id : null;
    var targetId = "screen-" + step.screen;
    if (currentId !== targetId) {
      try {
        if (typeof openScreen === "function") {
          var navBtn = document.querySelector('.bottom-nav .nav-btn[data-screen="' + step.screen + '"]');
          openScreen(step.screen, navBtn || null);
        }
      } catch (_e) { /* noop */ }
      setTimeout(function () { _renderOnboardingContent(idx); }, 320);
      return;
    }
  }
  _renderOnboardingContent(idx);
}

// Вынесено из _renderOnboardingStep, чтобы можно было вызвать ПОСЛЕ
// screen-switch'а (когда нужный экран уже активен).
function _renderOnboardingContent(idx) {
  if (!_onboardingActive || !_activeTour) return;
  var step = _activeTour.steps[idx];
  if (!step) return;

  var counter = document.getElementById("onboardingStepCounter");
  var titleEl = document.getElementById("onboardingTitle");
  var textEl  = document.getElementById("onboardingText");
  var prog    = document.getElementById("onboardingProgress");
  var skipBtn = document.getElementById("onboardingSkipBtn");
  var nextBtn = document.getElementById("onboardingNextBtn");
  if (!titleEl || !textEl) return;

  var total = _activeTour.steps.length;
  if (counter) {
    // Premium-туры из 1 шага: счётчик «1 / 1» выглядит лишним - скрываем.
    if (_activeTour.completionType === "premium" && total === 1) {
      counter.style.display = "none";
    } else {
      counter.style.display = "";
      counter.textContent = (idx + 1) + " / " + total;
    }
  }

  var _t = (typeof t === "function") ? t : function (k) { return k; };
  titleEl.textContent = _t(step.titleKey);
  textEl.textContent  = _t(step.textKey);

  // Прогресс-полосы: один шаг = скрыть прогресс полностью.
  if (prog) {
    if (total <= 1) {
      prog.style.display = "none";
    } else {
      prog.style.display = "";
      prog.innerHTML = "";
      for (var i = 0; i < total; i++) {
        var dot = document.createElement("span");
        var cls = "onboarding-progress-dot";
        if (i === idx) cls += " is-active";
        else if (i < idx) cls += " is-done";
        dot.className = cls;
        prog.appendChild(dot);
      }
    }
  }

  // Кнопки: текст зависит от типа тура и позиции шага.
  //   • Premium-тур из 1 шага → «Понял».
  //   • Последний шаг любого тура → «Готово» (без «Пропустить»).
  //   • Иначе → «Далее» + «Пропустить».
  if (nextBtn) {
    var isLast = (idx === total - 1);
    var nextKey;
    if (_activeTour.completionType === "premium" && total === 1) {
      nextKey = "onb.prem.btn.gotIt";
    } else if (isLast) {
      nextKey = "onb.btn.done";
    } else {
      nextKey = "onb.btn.next";
    }
    nextBtn.textContent = _t(nextKey);
  }
  if (skipBtn) {
    var isLastSkip = (idx === total - 1);
    if (isLastSkip || (_activeTour.completionType === "premium" && total === 1)) {
      skipBtn.style.display = "none";
    } else {
      skipBtn.style.display = "";
      skipBtn.textContent = _t("onb.btn.skip");
    }
  }
  // NOTE: вертикальный стек кнопок (см. CSS .onboarding-buttons) сам обрабатывает
  // случай «только Next» - никаких дополнительных классов не нужно.

  _positionOnboardingStep(step);
}

// Снимает .is-priming с root через double-rAF - гарантирует что инлайн-стили
// уже применены без анимации (initial snap), и только после этого включаются
// transitions для последующих шагов. Идемпотентна - если класса нет, выходит.
function _finalizeOnboardingFirstRender() {
  var root = document.getElementById("onboardingRoot");
  if (!root || !root.classList.contains("is-priming")) return;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var r = document.getElementById("onboardingRoot");
      if (r) r.classList.remove("is-priming");
    });
  });
}

// Возвращает true если элемент круглый/почти круглый по computed border-radius.
// Используется для подбора radius'а у highlight'а - чтобы обводка совпадала
// с формой круглых элементов (аватар profileBtn, badges).
function _isCircularLike(el) {
  if (!el) return false;
  try {
    var cs = window.getComputedStyle(el);
    var first = parseFloat(cs.borderRadius) || 0;
    var rect = el.getBoundingClientRect();
    var minDim = Math.min(rect.width, rect.height);
    return minDim > 0 && first >= minDim * 0.4;
  } catch (_e) { return false; }
}

// Подбирает оптимальный border-radius для highlight'а. Если target круглый -
// возвращает 50%; иначе computed border-radius target'а; иначе 14px.
// Также проверяет первого визуального ребёнка - если у кнопки нет своего
// радиуса, но внутри круглый аватар, highlight тоже становится круглым.
function _computeHighlightRadius(target) {
  if (!target) return "14px";
  if (_isCircularLike(target)) return "50%";
  var firstChild = target.firstElementChild;
  if (firstChild && _isCircularLike(firstChild)) return "50%";
  try {
    var cs = window.getComputedStyle(target);
    var br = cs.borderRadius;
    if (br && br !== "0px" && br !== "0px 0px 0px 0px") return br;
  } catch (_e) { /* noop */ }
  return "14px";
}

// Резолвит реальный DOM-target шага с учётом expand-селектора (закрывающего
// родителя для inputs). Возвращает null если шаг без target'а ИЛИ если target
// не найден / невидим - тогда tooltip покажется по центру (graceful fallback).
function _resolveStepTarget(step) {
  if (!step || !step.target) return null;
  var el = document.querySelector(step.target);
  if (!el) return null;
  // Невидимый элемент (display:none или вне layout) - пропускаем как «нет target».
  if (el.offsetParent === null && el !== document.body) {
    // ПРИМЕЧАНИЕ: position:fixed не имеет offsetParent, но виден. Проверим rect.
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
  }
  if (step.expand) {
    var parent = el.closest(step.expand);
    if (parent) return parent;
  }
  return el;
}

function _positionOnboardingStep(step) {
  var hl = document.getElementById("onboardingHighlight");
  var tt = document.getElementById("onboardingTooltip");
  if (!hl || !tt) return;

  var target = _resolveStepTarget(step);

  // Helper: устанавливает tooltip в позицию через translate3d (GPU smooth).
  // Внутри также управляет --onb-arrow-x для стрелки.
  function setTooltipTransform(x, y) {
    tt.style.transform = "translate3d(" + Math.round(x) + "px, " + Math.round(y) + "px, 0)";
  }

  // Helper: переключает в centered-mode (welcome/final/huge-target).
  function applyCentered() {
    hl.classList.remove("has-target");
    var vwC = window.innerWidth  || document.documentElement.clientWidth;
    var vhC = window.innerHeight || document.documentElement.clientHeight;
    hl.style.transform = "translate3d(" + (vwC / 2) + "px, " + (vhC / 2) + "px, 0)";
    hl.style.width  = "0px";
    hl.style.height = "0px";
    if (typeof _setDimmerHole === "function") _setDimmerHole(null, null, null, null);

    tt.classList.add("is-centered");
    tt.classList.remove("above", "below", "arrow-up", "arrow-down");
    // Центрируем по фактическим размерам tooltip'а.
    var ttW = tt.offsetWidth  || 280;
    var ttH = tt.offsetHeight || 200;
    setTooltipTransform((vwC - ttW) / 2, (vhC - ttH) / 2);

    _finalizeOnboardingFirstRender();
  }

  if (!target) {
    applyCentered();
    return;
  }

  // Прокручиваем target в видимую область. INSTANT - smooth в WebView часто
  // лагает и удлиняет TTFP. С instant хватает 60ms wait для layout settle.
  try {
    target.scrollIntoView({ block: "center", behavior: "instant" });
  } catch (_e) {
    try { target.scrollIntoView(); } catch (_e2) { /* noop */ }
  }

  // Минимальная задержка под layout-settle. С instant scroll этого хватает.
  setTimeout(function () {
    if (!_onboardingActive) return;
    var rect = target.getBoundingClientRect();
    var pad = _ONBOARDING_PADDING;
    var vw = window.innerWidth  || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;

    // FIX (bug 3): tooBig по AREA RATIO. Раньше width>85% триггерилось
    // на обычных full-width inputs (Доход/Расход/Цель) - обводка пропадала
    // и tooltip падал в centered mode. Теперь target считается "огромным"
    // только если он покрывает >55% площади viewport'а.
    var areaRatio = (rect.width * rect.height) / (vw * vh);
    var tooBig = areaRatio > 0.55 || rect.height > vh * 0.85;
    if (tooBig) {
      applyCentered();
      return;
    }

    // step.noHighlight: dim-cutout всё равно делается (чтобы пользователь
    // видел кнопку сквозь затемнение), но emerald-обводка и pulse-glow
    // не отображаются - управляется через класс has-target на highlight'е.
    if (step && step.noHighlight) {
      hl.classList.remove("has-target");
    } else {
      hl.classList.add("has-target");
    }
    tt.classList.remove("is-centered");

    // FIX (bug 2 - profile): для круглых элементов (и кнопок с круглыми
    // детьми типа #profileBtn>.avatar) применяем 50% radius - обводка
    // становится кругом, выровненным по центру target'а.
    hl.style.borderRadius = _computeHighlightRadius(target);

    var hlX = rect.left - pad;
    var hlY = rect.top  - pad;
    var hlW = rect.width  + pad * 2;
    var hlH = rect.height + pad * 2;

    hl.classList.add("is-moving");
    hl.style.transform = "translate3d(" + hlX + "px, " + hlY + "px, 0)";
    hl.style.width  = hlW + "px";
    hl.style.height = hlH + "px";

    if (typeof _setDimmerHole === "function") _setDimmerHole(hlX, hlY, hlW, hlH);

    if (window._onbMoveTimer) clearTimeout(window._onbMoveTimer);
    window._onbMoveTimer = setTimeout(function () {
      if (hl) hl.classList.remove("is-moving");
    }, 440);

    // Tooltip: ABOVE или BELOW target'а. Если центр target в верхней
    // половине → tooltip снизу (больше места), иначе сверху.
    var targetCenterY = rect.top + rect.height / 2;
    var placeBelow = targetCenterY < vh / 2;

    if (placeBelow) {
      tt.classList.add("below", "arrow-up");
      tt.classList.remove("above", "arrow-down");
    } else {
      tt.classList.add("above", "arrow-down");
      tt.classList.remove("below", "arrow-up");
    }

    // 2-й проход - после layout'а имеем реальную ширину/высоту tooltip'а.
    // Вычисляем итоговое translate3d, обновляем стрелку, ставим финальный
    // transform. Это даёт стабильный transition: tooltip двигается из
    // прошлой позиции в новую за 0.42s GPU-smooth.
    requestAnimationFrame(function () {
      if (!_onboardingActive) return;
      var ttRect = tt.getBoundingClientRect();
      // ttRect возвращает реальные размеры элемента (учитывает текущий transform).
      // Для размеров нам нужен offsetWidth/Height - они не зависят от transform.
      var ttWidth  = tt.offsetWidth  || ttRect.width;
      var ttHeight = tt.offsetHeight || ttRect.height;

      var targetCenterX = rect.left + rect.width / 2;
      var leftPos = targetCenterX - ttWidth / 2;
      var minLeft = 12;
      var maxLeft = vw - ttWidth - 12;
      if (leftPos < minLeft) leftPos = minLeft;
      if (leftPos > maxLeft) leftPos = maxLeft;

      var topPos;
      if (placeBelow) {
        topPos = rect.bottom + pad + 14;
      } else {
        topPos = rect.top - pad - 14 - ttHeight;
      }
      // Clamp по вертикали - на всякий случай (если высокий tooltip).
      if (topPos < 12) topPos = 12;
      if (topPos > vh - ttHeight - 12) topPos = vh - ttHeight - 12;

      setTooltipTransform(leftPos, topPos);

      // Стрелка указывает на центр target'а, даже если tooltip clamped.
      var arrowX = targetCenterX - leftPos;
      if (arrowX < 20) arrowX = 20;
      if (arrowX > ttWidth - 20) arrowX = ttWidth - 20;
      tt.style.setProperty("--onb-arrow-x", arrowX + "px");

      _finalizeOnboardingFirstRender();
    });
  }, 80);
}

function _onOnboardingNext() {
  if (!_onboardingActive || !_activeTour) return;
  if (typeof haptic === "function") { try { haptic("light"); } catch (_e) {} }
  if (_onboardingStepIdx >= _activeTour.steps.length - 1) {
    _completeOnboarding();
    return;
  }
  _onboardingStepIdx++;
  _renderOnboardingStep(_onboardingStepIdx);
}

function _onOnboardingSkip() {
  if (!_onboardingActive) return;
  if (typeof haptic === "function") { try { haptic("light"); } catch (_e) {} }
  _completeOnboarding();
}

function _completeOnboarding() {
  if (!_activeTour) return;
  var finishedTour = _activeTour;
  _onboardingActive = false;
  _activeTour = null;

  // Persist - пишем в правильный флаг в зависимости от типа тура.
  try {
    if (finishedTour.completionType === "primary") {
      if (typeof updateState === "function") {
        updateState({ onboardingCompleted: true });
      } else if (window.appState) {
        window.appState.onboardingCompleted = true;
      }
      if (typeof saveFullState === "function") saveFullState();
    } else if (finishedTour.completionType === "premium" && finishedTour.featureKey) {
      _markPremiumTourDone(finishedTour.featureKey);
    }
  } catch (_e) { /* noop */ }

  // Снимаем listeners.
  if (_onboardingViewportHandler) {
    window.removeEventListener("resize", _onboardingViewportHandler);
    window.removeEventListener("scroll", _onboardingViewportHandler, true);
    _onboardingViewportHandler = null;
  }

  // Fade-out + DOM cleanup.
  var root = document.getElementById("onboardingRoot");
  if (root) {
    root.classList.add("is-closing");
    setTimeout(function () {
      if (root.parentNode) root.parentNode.removeChild(root);
    }, 320);
  }
}

window.startOnboarding = startOnboarding;
window.startTour = startTour;
window.startPremiumFeatureTour = startPremiumFeatureTour;

(function initNewGoalFlow() {
  function _q(id) { return (typeof getEl === "function") ? getEl(id) : document.getElementById(id); }

  // ---- Helper: текущее состояние "цель пустая?" ----
  function _isGoalEmptyNow() {
    try {
      var gi = (typeof goalInput !== "undefined") ? goalInput : _q("goal");
      var v = (typeof parseNumber === "function")
        ? parseNumber(gi?.value || "0")
        : parseFloat((gi?.value || "0").replace(/\s/g, "")) || 0;
      return v === 0;
    } catch (e) { return false; }
  }

  // ---- Helper: текущее активное screen-имя ("calc", "advice", ..., "new-goal") ----
  function _currentScreenName() {
    var el = document.querySelector(".screen.active");
    if (!el || !el.id) return null;
    return el.id.replace(/^screen-/, "");
  }

  // ---- 1. Toggle protocol empty-state vs graph ----
  window._syncProtocolEmptyState = function () {
    var emptyCard = _q("protocolEmptyGoalCard");
    var advice    = _q("adviceCard");
    var flipWrap  = _q("flipWrapper");
    if (!emptyCard || !advice) return false;

    var isEmpty = _isGoalEmptyNow();

    if (isEmpty) {
      emptyCard.style.display = "";
      advice.style.display = "none";
      // Hide actions container (Unexpected Expense btn) - оно не релевантно без цели.
      var actions = _q("protocolActionsContainer");
      if (actions) actions.style.display = "none";
      // Hide swipe indicator dots
      var indicator = _q("graphGoalIndicator");
      if (indicator) indicator.classList.remove("visible");
      // Hide loader if visible
      var loaderEl = _q("loader");
      if (loaderEl) loaderEl.classList.add("hidden");
    } else {
      emptyCard.style.display = "none";
      advice.style.display = "";
    }
    if (flipWrap) flipWrap.style.minHeight = "";
    return isEmpty;
  };

  // ---- 1b. App-lock toggle (FIX: goal completion UI) ----
  // body.app-locked включается, когда:
  //   • primary goal === 0 (пользователь только что завершил цель), И
  //   • активный screen НЕ #screen-new-goal (на нём пользователь и создаёт новую цель)
  // Снимается, как только цель создана (goalInput.value > 0).
  window._updateAppLock = function (currentScreenNameArg) {
    var screen = currentScreenNameArg || _currentScreenName();
    var lock = _isGoalEmptyNow() && screen !== "new-goal";
    document.body.classList.toggle("app-locked", lock);
  };

  // ---- 2. Numeric input formatting (live) ----
  function _bindNumericFormatting(input) {
    if (!input) return;
    input.addEventListener("input", function () {
      try {
        if (typeof formatNumber === "function") {
          var caret = input.selectionStart;
          var before = input.value;
          input.value = formatNumber(input.value);
          // Best-effort caret preservation (skip on length change to avoid jumps).
          if (typeof caret === "number" && input.value.length === before.length) {
            try { input.setSelectionRange(caret, caret); } catch (_) {}
          }
        }
      } catch (e) { /* noop */ }
    });
  }

  _bindNumericFormatting(_q("newGoalAmount"));
  _bindNumericFormatting(_q("newGoalSaved"));
  _bindNumericFormatting(_q("newGoalIncome"));
  _bindNumericFormatting(_q("newGoalExpenses"));

  // ---- 3. Pace selection (calm/normal/aggressive) ----
  // FIX: new goal creation flow - убран tempo-segment (rate/duration), оставлен только pace.
  var paceButtons  = _q("newGoalPaceButtons");
  var _selectedPace = "calm";
  if (paceButtons) {
    paceButtons.querySelectorAll(".mode-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var m = b.dataset.mode;
        if (!m) return;
        _selectedPace = m;
        paceButtons.querySelectorAll(".mode-btn").forEach(function (x) {
          x.classList.toggle("active", x === b);
        });
        if (typeof haptic === "function") haptic("selection");
      });
    });
  }

  // ---- 4. Open screen helper ----
  window.openNewGoalScreen = function () {
    // FIX: new goal creation flow - title-field удалён; ничего не очищаем для него.
    var amountEl   = _q("newGoalAmount");
    var savedEl    = _q("newGoalSaved");
    var incomeEl   = _q("newGoalIncome");
    var expensesEl = _q("newGoalExpenses");

    if (amountEl) amountEl.value = "";
    if (savedEl)  savedEl.value  = "";
    // Предзаполняем доход/расход из текущих данных пользователя (если есть).
    try {
      var inc = (typeof incomeInput   !== "undefined") ? incomeInput   : null;
      var exp = (typeof expensesInput !== "undefined") ? expensesInput : null;
      if (incomeEl)   incomeEl.value   = inc?.value || "";
      if (expensesEl) expensesEl.value = exp?.value || "";
    } catch (e) { /* noop */ }

    // Pace → calm по умолчанию.
    _selectedPace = "calm";
    if (paceButtons) {
      paceButtons.querySelectorAll(".mode-btn").forEach(function (x) {
        x.classList.toggle("active", x.dataset.mode === "calm");
      });
    }

    // FIX: new goal creation flow - calculateBtn.onclick прячет ВСЕ .mode-buttons и .input-wrap
    //      селектором без префикса (видимая мутация затрагивает наш экран). Восстанавливаем
    //      видимость явно при каждом открытии #screen-new-goal.
    document.querySelectorAll(
      '#screen-new-goal label, #screen-new-goal .input-wrap, #screen-new-goal .mode-buttons, #screen-new-goal .new-goal-submit-btn'
    ).forEach(function (el) { el.style.display = ""; });

    if (typeof openScreen === "function") openScreen("new-goal", null);
    // FIX: goal completion UI - снимаем app-lock при входе в screen-new-goal.
    //      openScreen уже вызывает _updateAppLock, но дублируем явно - это hot-path.
    if (typeof window._updateAppLock === "function") window._updateAppLock("new-goal");
    setTimeout(function () { try { amountEl && amountEl.focus(); } catch (_) {} }, 250);
  };

  // ---- 5. Back button ----
  var backBtn = _q("newGoalBack");
  if (backBtn) {
    backBtn.addEventListener("click", function () {
      if (typeof haptic === "function") haptic("light");
      if (typeof openScreen === "function") {
        var protocolNavBtn = document.querySelector('.bottom-nav .nav-btn[data-screen="advice"]');
        openScreen("advice", protocolNavBtn || null);
      }
    });
  }

  // ---- 6. Submit ----
  // FIX: new goal creation flow - submit заполняет инпуты #screen-calc и триггерит
  //      существующий calculateBtn.click(), который запускает фабричный flow:
  //      validate → CashflowEngine → renderProtocolResult (выбор "Все в цель / С резервом") →
  //      protocolFlow(scenario) → graph. Это переиспользует ПОЛНОСТЬЮ существующую логику
  //      первичной настройки приложения, как и просил пользователь.
  var submitBtn = _q("newGoalSubmit");
  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      var amountVal   = (typeof parseNumber === "function") ? parseNumber(_q("newGoalAmount")?.value || "0") : parseFloat((_q("newGoalAmount")?.value || "0").replace(/\D/g, ""));
      var savedVal    = (typeof parseNumber === "function") ? parseNumber(_q("newGoalSaved")?.value || "0") : parseFloat((_q("newGoalSaved")?.value || "0").replace(/\D/g, ""));
      var incomeVal   = (typeof parseNumber === "function") ? parseNumber(_q("newGoalIncome")?.value || "0") : parseFloat((_q("newGoalIncome")?.value || "0").replace(/\D/g, ""));
      var expensesVal = (typeof parseNumber === "function") ? parseNumber(_q("newGoalExpenses")?.value || "0") : parseFloat((_q("newGoalExpenses")?.value || "0").replace(/\D/g, ""));

      // Валидация: обязательные поля (title больше не нужен).
      if (!(amountVal > 0) || !(incomeVal > 0) || !(expensesVal >= 0)) {
        if (typeof showToast === "function") showToast(t("newGoal.toast.invalid"));
        if (typeof haptic === "function") haptic("error");
        return;
      }
      if (!isFinite(savedVal) || savedVal < 0) savedVal = 0;
      if (savedVal >= amountVal) savedVal = Math.max(0, amountVal - 1);
      if (expensesVal > incomeVal) {
        if (typeof showToast === "function") showToast(t("newGoal.toast.expGtIncome"));
        if (typeof haptic === "function") haptic("error");
        return;
      }

      // ---- Заполняем существующие глобальные инпуты #screen-calc ----
      try {
        if (typeof goalInput     !== "undefined" && goalInput)     goalInput.value     = (typeof formatNumber === "function") ? formatNumber(String(amountVal))   : String(amountVal);
        if (typeof savedInput    !== "undefined" && savedInput)    savedInput.value    = (typeof formatNumber === "function") ? formatNumber(String(savedVal))    : String(savedVal);
        if (typeof incomeInput   !== "undefined" && incomeInput)   incomeInput.value   = (typeof formatNumber === "function") ? formatNumber(String(incomeVal))   : String(incomeVal);
        if (typeof expensesInput !== "undefined" && expensesInput) expensesInput.value = (typeof formatNumber === "function") ? formatNumber(String(expensesVal)) : String(expensesVal);

        // accounts + balance: новая цель - новый отсчёт.
        if (typeof accounts !== "undefined" && accounts) {
          accounts.main    = savedVal;
          accounts.reserve = 0;
        }
        try { initialBalance = savedVal; }       catch (e) { window.initialBalance = savedVal; }
        try { planStartValue = savedVal; }       catch (e) { window.planStartValue = savedVal; }
        try { factHistory = []; }                catch (e) { window.factHistory = []; }
        try { goalCompleted = false; }           catch (e) { window.goalCompleted = false; }
        try { saveMode = _selectedPace; }        catch (e) { window.saveMode = _selectedPace; }
        try { selectedMode = _selectedPace; }    catch (e) { window.selectedMode = _selectedPace; }
        // ВАЖНО: НЕ задаём chosenPlan и НЕ ставим isInitialized=true -
        // эти значения проставит calculateBtn.onclick после успешного расчёта.
        try { chosenPlan = null; }               catch (e) { window.chosenPlan = null; }
        try { isInitialized = false; }           catch (e) { window.isInitialized = false; }

        // goalMeta.title - дефолтное название цели (поле "Название" убрано из UI).
        var defaultTitle = (typeof t === "function" && (t("advGoals.mainGoal") || t("misc.defaultGoalTitle"))) || "Основная цель";
        if (typeof goalMeta !== "undefined" && goalMeta) goalMeta.title = defaultTitle;

        // Sync UI .mode-btn на calc-экране (для согласованности - calculateBtn читает saveMode).
        document.querySelectorAll('#screen-calc .mode-buttons .mode-btn').forEach(function (b) {
          b.classList.toggle("active", b.dataset.mode === _selectedPace);
        });

        // goals[0] - primary через хелперы.
        if (typeof getGoals === "function") {
          var goalsArr = getGoals();
          if (!goalsArr[0]) {
            goalsArr[0] = { id: "goal_1", title: defaultTitle, amount: amountVal, saved: savedVal, isPrimary: true };
          } else {
            goalsArr[0].title  = defaultTitle;
            goalsArr[0].amount = amountVal;
            goalsArr[0].saved  = savedVal;
          }
          if (typeof persistGoals === "function") persistGoals(goalsArr);
        }
      } catch (e) {
        console.error("[NewGoal] state setup error:", e);
        if (typeof showToast === "function") showToast("Ошибка создания цели");
        return;
      }

      // ---- Триггерим существующий flow: scenario picker → protocolFlow ----
      // calculateBtn.onclick: валидирует → CashflowEngine → renderProtocolResult (две карточки
      // "Все в цель / С резервом") → openScreen("advice") → planSummary.style.display="block".
      // Пользователь увидит выбор сценария, как при первой настройке приложения.
      if (typeof haptic === "function") haptic("success");
      try {
        var calcBtn = document.getElementById("calculate");
        if (calcBtn && typeof calcBtn.click === "function") {
          calcBtn.click();
        } else {
          // Fallback: открываем calc-экран и пусть юзер сам нажмёт.
          if (typeof openScreen === "function") {
            var navBtn = document.querySelector('.bottom-nav .nav-btn[data-screen="calc"]');
            openScreen("calc", navBtn || null);
          }
        }
      } catch (e) {
        console.error("[NewGoal] calc trigger error:", e);
      }

      // App-lock снимется автоматически: openScreen("advice", ...) внутри calculateBtn вызовет
      // _updateAppLock, а goalInput.value уже > 0 → lock removed.
    });
  }

  // ---- 9. Первичная синхронизация empty-state + app-lock (если приложение запущено без цели) ----
  function _initialSync() {
    try { window._syncProtocolEmptyState && window._syncProtocolEmptyState(); }
    catch (e) { /* noop */ }
    try { window._updateAppLock && window._updateAppLock(); }
    catch (e) { /* noop */ }

    // ONBOARDING - запускаем пошаговый тур (если ещё не проходили).
    // Задержка 1500ms даёт время:
    //   • Supabase loadAppState() догнать remote state - если юзер уже
    //     проходил тур на другом устройстве, флаг onboardingCompleted=true
    //     в remote'е перекроет локальный false и тур НЕ запустится повторно.
    //   • splash-video fade-out'у завершиться (он ~450ms).
    //   • DOM-у calc-экрана точно завершить layout.
    // Сама startOnboarding ещё раз проверяет флаг внутри - двойная защита
    // от ложного срабатывания.
    setTimeout(function () {
      try {
        if (typeof startOnboarding === "function") startOnboarding();
      } catch (_e) { /* noop */ }
    }, 1500);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _initialSync);
  } else {
    setTimeout(_initialSync, 0);
  }
})();
