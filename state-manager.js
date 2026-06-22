/**
 * Protocol Finance — State Management & Storage Layer
 *
 * Единый слой управления состоянием.
 * Сейчас использует localStorage, но спроектирован так,
 * чтобы заменить адаптер на backend / Telegram Cloud Storage
 * без переписывания логики приложения.
 *
 * Загружается ДО app.js.
 */

const STATE_VERSION = 16;
const STORAGE_KEY = "protocol_app_state";

// ─── Default State ────────────────────────────────────────────

function getDefaultState() {
  return {
    stateVersion: STATE_VERSION,
    lastActiveScreen: "calc",
    lastActiveNavIndex: 0,

    income: "",
    expenses: "",
    goal: "",
    saved: "",

    saveMode: "calm",

    lastCalc: {},
    chosenPlan: null,
    plannedMonthly: 0,
    planStartValue: 0,
    initialBalance: 0,
    factRatio: null,
    goalCompleted: false,
    selectedScenario: null,
    isInitialized: false,

    accounts: { main: 0, reserve: 0 },

    factHistory: [],
    financialEvents: [],

    goalMeta: { title: "Основная цель" },

    // ── Multi-goal (v6) ──
    goals: [],
    activeGoalIndex: 0,
    completedGoals: [],

    // ── Engine (v3) ──
    financialModel: "simple",
    cashflowEvents: [],
    derivedState: {},

    // ── Cashflow settings (v3) ──
    incomeType: "fixed",
    expenseType: "fixed",
    frequency: "monthly",
    // Частота периодичности изначально НЕ выбрана (""), чтобы при переключении
    // на «Нефиксированный» ни одна кнопка не была подсвечена - пользователь
    // выбирает сам. Расчётные пути используют запасной "monthly" (|| "monthly"),
    // поэтому пустое значение безопасно. Существующие пользователи сохраняют
    // свою сохранённую частоту (deep-merge в applyState).
    incomeFrequency: "",
    expenseFrequency: "",
    fixedIncomeAmount: "",
    fixedExpenseAmount: "",
    // NEW (v11): start date for periodic ("fixed") mode — YYYY-MM-DD or "".
    // Anchors the recurring schedule (weekly/biweekly/monthly).
    incomeStartDate: "",
    expenseStartDate: "",

    // NEW (v16): дата (ISO) первой активации гибкой (cashflow) модели. Нужна,
    // чтобы понять, начал ли пользователь копить в середине месяца (день ≥ 2)
    // и показать ему один раз плашку «расход уже потрачен?». Ставится один раз.
    cashflowStartedAt: "",
    // NEW (v16): ответ пользователя на плашку про расход в неполном (стартовом)
    // месяце. { monthKey:number, status:"yes"|"no"|"partial", paidAmount:number }.
    // monthKey = year*12+month ответа; если месяц сменился — ответ считается
    // неактуальным (новый месяц полный, плашка не нужна).
    partialExpense: null,

    // ── Premium (v4 → v14: subscription model) ──
    isPremium: false,

    // SUBSCRIPTION MODEL (v14): Telegram Stars subscription metadata.
    //   premiumUntil — ISO-строка, дата окончания подписки (now + 30 days).
    //                  null = lifetime / нет подписки.
    //   autoRenew    — НЕ используется в текущей сборке. Telegram Stars
    //                  технически поддерживают recurring через subscription_period
    //                  в createInvoiceLink, но у нас одноразовые invoice'ы —
    //                  поэтому чекбокс убран из UI. Поле оставлено в стейте
    //                  для совместимости с БД (колонка users.auto_renew),
    //                  но всегда === false до апгрейда на subscription invoices.
    // Все три поля синхронизируются с users-таблицей в Supabase через
    // fetchUserAccessFlags(). Effective premium считается как
    // isPremium && (premiumUntil === null || premiumUntil > now()).
    premiumUntil: null,
    autoRenew: false,

    // ADMIN ONLY: community stats block — флаг видимости блока
    // «Статистика сообщества» в профиле. Управляется только владельцем
    // приложения через колонку users.show_community_stats в Supabase
    // (по умолчанию false у всех). Не связан с isPremium.
    showCommunityStats: false,

    // ── First-launch onboarding (v15) ──
    // Пошаговый тур по основным элементам приложения. Показывается ровно
    // один раз — при первом запуске. После прохождения / пропуска ставится
    // в true. Существующие пользователи (мигрирующие с v14) получают true
    // автоматически если у них уже есть какие-либо данные (см. миграцию).
    onboardingCompleted: false,

    // ── Premium-feature onboardings (v16) ──
    // Per-feature мини-туры, которые срабатывают при первом открытии
    // премиум-функции пользователем С АКТИВНОЙ ПОДПИСКОЙ. Ключи:
    //   flexible — Гибкая финансовая модель
    //   pace     — Изменить темп накоплений
    //   debts    — Добавить кредиты и долги
    //   advanced — Расширенные настройки
    //   stats    — Статистика счёта (обратная сторона карточки)
    // Каждый флаг ставится в true после прохождения / пропуска тура для
    // этой фичи. Объект изначально пустой — отсутствующий ключ трактуется
    // как false (тур ещё не показывали).
    premiumOnboardingCompleted: {},

    // ── Flexible onboarding (v5) — legacy, always true after redesign ──
    hasSeenFlexibleOnboarding: true,
    incomeMonthDays: [],
    expenseMonthDays: [],

    // ── Account Stats (v5) ──
    accountStats: {
      main: null,
      reserve: null
    },

    // ── Debts (v7) ──
    debts: [],
    debtPlanningMode: false,
    debtOverlaySeen: false,
    debtPaymentHistory: [],
    activeDebtIndex: 0,

    // ── Expenses Tracker (v8) ──
    expensesLog: [],

    // CUSTOM SCHEDULE LOGIC (v12) ──
    // Полная история ручных вводов «Свой график» для income / expense сторон.
    // Запись: { id, side: "income"|"expense", amount, date: "YYYY-MM-DD",
    //          deposited: number, depositedAt: ISO|null, note?: string, createdAt: ISO }
    // `deposited` хранит сумму, реально отложенную в основной счёт по этой записи
    // (только для income; для expense всегда 0). Это позволяет показывать
    // в истории, какие поступления уже превращены в накопления.
    customScheduleEntries: [],
    // CUSTOM SCHEDULE LOGIC — sticky-флаг «попросить ввести расходы за период»
    // выставляется true после успешного отложения дохода, сбрасывается после
    // добавления expense-записи или ручного закрытия пользователем.
    customScheduleExpensePrompt: false,
    // CUSTOM SCHEDULE v2 - fix main plan display — зеркальный флаг для обратного
    // направления: после ввода/отложения расхода предлагаем зафиксировать доход.
    customScheduleIncomePrompt: false,

    // ── Settings (v9) ──
    settings: {
      baseCurrency: "RUB",
      displayCurrencyEnabled: false,
      displayCurrency: "USD",
      exchangeRates: { USD: null, EUR: null, lastUpdated: 0 },
      carryOverEnabled: true,
      allocationMode: "goal",
      allowOverpay: true,
      // REMINDERS — по умолчанию включены, чтобы новые пользователи сразу
      // получали полезные пинги (раз в период / о платежах по долгам).
      // Существующие пользователи сохраняют свои настройки благодаря deep merge
      // в applyState (defaults фоллбэк только для отсутствующих ключей).
      notificationsEnabled: true,
      depositReminderEnabled: true,
      debtReminderEnabled: true,
      reminderTime: "12:00",
      // tzOffsetMinutes — смещение локального времени относительно UTC, в минутах.
      // Заполняется автоматически в app.js на старте через
      // -new Date().getTimezoneOffset(). Edge Function send-reminder использует
      // это поле чтобы понять, когда у пользователя наступило время напоминаний.
      tzOffsetMinutes: 180,
      animationsEnabled: true,
      numberFormat: "spaces",
      language: "ru",
      // LOADING VIDEO TOGGLE — настройка «Отключить видео при загрузке»
      // (Настройки → Интерфейс). По умолчанию false — видео показывается.
      // true означает «отключено» (только чёрный фон). Читается в
      // showSplashVideo() из app.js.
      disableLoadingVideo: false
    },

    uiState: {
      goalTotal: 0,
      goalSaved: 0,
      reserveAmount: 0,
      monthlyContribution: 0,
      monthsLeft: 0,
      mode: null,
      hasReserve: false
    }
  };
}

// ─── Storage Adapters ─────────────────────────────────────────

const localStorageAdapter = {
  save(data) {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, serialized);
      return true;
    } catch (e) {
      console.warn("[Storage] save failed:", e);
      return false;
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("[Storage] load failed:", e);
      return null;
    }
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      // Совместимость: удаляем старые ключи
      localStorage.removeItem("protocol_persist");
      localStorage.removeItem("protocol_state");
      return true;
    } catch (e) {
      console.warn("[Storage] clear failed:", e);
      return false;
    }
  }
};

// ─── Abstract Storage (swappable) ─────────────────────────────

const storage = {
  _adapter: localStorageAdapter,

  setAdapter(adapter) {
    this._adapter = adapter;
  },

  save(data) {
    return this._adapter.save(data);
  },

  load() {
    return this._adapter.load();
  },

  clear() {
    return this._adapter.clear();
  }
};

// ─── App State (единственный источник истины) ─────────────────

let appState = getDefaultState();

// ─── Migration ────────────────────────────────────────────────

function migrateState(saved) {
  if (!saved || typeof saved !== "object") return getDefaultState();

  const version = saved.stateVersion || 0;

  // v0 → v1: старый формат (protocol_persist) — конвертируем
  if (version < 1) {
    saved.stateVersion = STATE_VERSION;
    if (!saved.lastActiveScreen) saved.lastActiveScreen = "calc";
    if (!saved.lastActiveNavIndex) saved.lastActiveNavIndex = 0;
    if (!saved.uiState && saved.state) {
      saved.uiState = { ...saved.state };
      delete saved.state;
    }
    if (!saved.uiState) {
      saved.uiState = getDefaultState().uiState;
    }
  }

  // v1 → v2: добавлен financialEvents
  if (version < 2) {
    saved.stateVersion = 2;
    if (!Array.isArray(saved.financialEvents)) {
      saved.financialEvents = [];
    }
  }

  // v2 → v3: CashflowEngine fields
  if (version < 3) {
    saved.stateVersion = 3;
    if (!saved.financialModel) saved.financialModel = "simple";
    if (!Array.isArray(saved.cashflowEvents)) saved.cashflowEvents = [];
    if (!saved.derivedState || typeof saved.derivedState !== "object") saved.derivedState = {};
    if (!saved.incomeType) saved.incomeType = "fixed";
    if (!saved.expenseType) saved.expenseType = "fixed";
    if (!saved.frequency) saved.frequency = "monthly";
    if (!saved.incomeFrequency) saved.incomeFrequency = "monthly";
    if (!saved.expenseFrequency) saved.expenseFrequency = "monthly";
  }

  // v3 → v4: isPremium
  if (version < 4) {
    saved.stateVersion = 4;
    if (typeof saved.isPremium !== "boolean") saved.isPremium = false;
  }

  // v4 → v5: flexible onboarding + monthDays
  if (version < 5) {
    saved.stateVersion = 5;
    if (typeof saved.hasSeenFlexibleOnboarding !== "boolean") saved.hasSeenFlexibleOnboarding = true;
    if (!Array.isArray(saved.incomeMonthDays)) saved.incomeMonthDays = [];
    if (!Array.isArray(saved.expenseMonthDays)) saved.expenseMonthDays = [];
  }

  // v5 → v6: multi-goal support
  if (version < 6) {
    saved.stateVersion = 6;
    if (!Array.isArray(saved.goals) || saved.goals.length === 0) {
      var goalAmount = 0;
      if (saved.goal) {
        goalAmount = Number(String(saved.goal).replace(/\./g, "")) || 0;
      }
      var goalSaved = 0;
      if (saved.accounts && saved.accounts.main) {
        goalSaved = Number(saved.accounts.main) || 0;
      }
      var goalMonths = 0;
      if (saved.lastCalc && saved.lastCalc.months) {
        goalMonths = saved.lastCalc.months;
      }
      var goalTitle = "Основная цель";
      if (saved.goalMeta && saved.goalMeta.title) {
        goalTitle = saved.goalMeta.title;
      }
      saved.goals = [{
        id: "goal_1",
        title: goalTitle,
        amount: goalAmount,
        saved: goalSaved,
        priority: 1,
        monthlyShare: 0,
        monthsLeft: goalMonths
      }];
    }
    if (typeof saved.activeGoalIndex !== "number") saved.activeGoalIndex = 0;

    saved.goals.forEach(function (g) {
      if (typeof g.monthlyShare !== "number") g.monthlyShare = 0;
      if (typeof g.monthsLeft !== "number") {
        g.monthsLeft = g.monthsTarget || 0;
      }
      delete g.monthsTarget;
    });
  }

  // v6 → v7: debts support
  if (version < 7) {
    saved.stateVersion = 7;
    if (!Array.isArray(saved.debts)) saved.debts = [];
    if (typeof saved.debtPlanningMode !== "boolean") saved.debtPlanningMode = false;
    if (typeof saved.debtOverlaySeen !== "boolean") saved.debtOverlaySeen = false;
  }

  // v7 → v8: expenses tracker
  if (version < 8) {
    saved.stateVersion = 8;
    if (!Array.isArray(saved.expensesLog)) saved.expensesLog = [];
  }

  // v8 → v9: settings
  if (version < 9) {
    saved.stateVersion = 9;
    if (!saved.settings || typeof saved.settings !== "object") {
      saved.settings = getDefaultState().settings;
    }
  }

  // v9 → v10: multi-currency (baseCurrency + displayCurrency)
  if (version < 10) {
    saved.stateVersion = 10;
    if (saved.settings) {
      if (!saved.settings.baseCurrency) {
        saved.settings.baseCurrency = saved.settings.currency || "RUB";
      }
      if (typeof saved.settings.displayCurrencyEnabled !== "boolean") {
        saved.settings.displayCurrencyEnabled = false;
      }
      if (!saved.settings.displayCurrency) {
        saved.settings.displayCurrency = "USD";
      }
      if (!saved.settings.exchangeRates || typeof saved.settings.exchangeRates !== "object") {
        saved.settings.exchangeRates = { USD: null, EUR: null, lastUpdated: 0 };
      }
      delete saved.settings.currency;
    }
  }

  // v10 → v11: periodic mode start dates (incomeStartDate / expenseStartDate)
  // NEW: anchors recurring schedule for "fixed" type. Defaults to "".
  if (version < 11) {
    saved.stateVersion = 11;
    if (typeof saved.incomeStartDate !== "string") saved.incomeStartDate = "";
    if (typeof saved.expenseStartDate !== "string") saved.expenseStartDate = "";
  }

  // CUSTOM SCHEDULE LOGIC — v11 → v12: manual-entry log for custom-frequency
  // mode. Bootstrap the array + reminder flag so all read-sites can assume the
  // canonical shape without optional-chaining everywhere.
  if (version < 12) {
    saved.stateVersion = 12;
    if (!Array.isArray(saved.customScheduleEntries)) saved.customScheduleEntries = [];
    if (typeof saved.customScheduleExpensePrompt !== "boolean") {
      saved.customScheduleExpensePrompt = false;
    }
  }

  // REALISTIC DEBT LOGIC - Russian banks — v12 → v13: расширение схемы долгов.
  // Добавлены поля для реалистичной банковской логики:
  //   • loanAmount       — первоначальная сумма кредита (используется в формуле
  //                        аннуитета и для расчёта общей переплаты).
  //   • interestRate     — годовая ставка % (например, 18.5).
  //   • termMonths       — срок кредита в месяцах.
  //   • startDate        — дата выдачи кредита (YYYY-MM-DD).
  //   • gracePeriodDays  — длина льготного периода карты в днях (50-120 у РФ-банков).
  //   • minPaymentPercent — минимальный платёж по карте, % от долга (5-10).
  //   • lastFullPayDate  — дата последнего полного погашения карты (для расчёта
  //                        окончания текущего grace-периода).
  // Все поля опциональные с разумными default'ами, чтобы существующие долги
  // продолжали работать без изменения поведения.
  if (version < 13) {
    saved.stateVersion = 13;
    if (Array.isArray(saved.debts)) {
      saved.debts.forEach(function (d) {
        // Общие поля кредитной логики (для credit / installment).
        if (typeof d.loanAmount !== "number") d.loanAmount = Number(d.totalAmount) || 0;
        if (typeof d.interestRate !== "number") d.interestRate = 0;
        if (typeof d.termMonths !== "number") d.termMonths = 0;
        if (typeof d.startDate !== "string") d.startDate = "";

        // Поля кредитной карты: applied только если type=card.
        if (d.type === "card") {
          if (typeof d.gracePeriodDays !== "number") d.gracePeriodDays = 55;
          if (typeof d.minPaymentPercent !== "number") d.minPaymentPercent = 5;
          if (typeof d.lastFullPayDate !== "string") d.lastFullPayDate = "";
        } else {
          // Для не-card записей нормализуем эти поля к 0/"" — это упростит
          // расчётные функции (не нужно делать optional-chaining).
          if (typeof d.gracePeriodDays !== "number") d.gracePeriodDays = 0;
          if (typeof d.minPaymentPercent !== "number") d.minPaymentPercent = 0;
          if (typeof d.lastFullPayDate !== "string") d.lastFullPayDate = "";
        }
      });
    }
  }

  // v13 → v14: SUBSCRIPTION MODEL — premiumUntil + autoRenew. Pre-v14 юзеры
  // имели только boolean isPremium без срока. После апгрейда оставляем флаг
  // как есть (legacy lifetime), но добавляем подписочные поля по умолчанию.
  if (version < 14) {
    saved.stateVersion = 14;
    if (typeof saved.premiumUntil === "undefined") saved.premiumUntil = null;
    if (typeof saved.autoRenew !== "boolean") saved.autoRenew = false;
  }

  // v15 → v16: PREMIUM ONBOARDINGS — per-feature мини-туры. Существующим
  // премиум-пользователям туры показывать НЕ нужно (они уже знают функции),
  // поэтому если у юзера активная подписка (isPremium=true) — помечаем все
  // туры как пройденные. Новые премиум-юзеры пройдут их по мере открытия
  // соответствующих функций.
  if (version < 16) {
    saved.stateVersion = 16;
    if (!saved.premiumOnboardingCompleted || typeof saved.premiumOnboardingCompleted !== "object") {
      saved.premiumOnboardingCompleted = {};
    }
    if (saved.isPremium === true) {
      saved.premiumOnboardingCompleted = {
        flexible: true,
        pace: true,
        debts: true,
        advanced: true,
        stats: true
      };
    }
  }

  // v14 → v15: ONBOARDING — пошаговый тур при первом запуске.
  // Эвристика для существующих пользователей: если в state уже есть
  // какие-либо данные (income/expenses/goal/accounts/goals/events) —
  // юзер НЕ новый, онбординг ему не нужен (completed=true).
  // Брэнд-нью юзеры с пустым state получат completed=false → тур запустится.
  if (version < 15) {
    saved.stateVersion = 15;
    if (typeof saved.onboardingCompleted !== "boolean") {
      var hasAnyData = !!(
        saved.isInitialized ||
        saved.income || saved.expenses || saved.goal || saved.saved ||
        (saved.accounts && (saved.accounts.main || saved.accounts.reserve)) ||
        (Array.isArray(saved.goals) && saved.goals.length > 0) ||
        (Array.isArray(saved.financialEvents) && saved.financialEvents.length > 0) ||
        (Array.isArray(saved.factHistory) && saved.factHistory.length > 0)
      );
      saved.onboardingCompleted = hasAnyData;
    }
  }

  // Ensure settings has all expected keys
  if (saved.settings && typeof saved.settings === "object") {
    var ds = getDefaultState().settings;
    Object.keys(ds).forEach(function (k) {
      if (saved.settings[k] === undefined) saved.settings[k] = ds[k];
    });
  } else {
    saved.settings = getDefaultState().settings;
  }

  // Ensure debtPaymentHistory exists (added post-v7)
  if (!Array.isArray(saved.debtPaymentHistory)) saved.debtPaymentHistory = [];

  // Ensure all goals have the paused field and timeline override
  if (Array.isArray(saved.goals)) {
    saved.goals.forEach(function (g) {
      if (typeof g.paused !== "boolean") g.paused = false;
      if (g.timelineOverrideMonths !== undefined && g.timelineOverrideMonths !== null) {
        g.timelineOverrideMonths = Number(g.timelineOverrideMonths) || null;
      }
    });
  }

  // Ensure all debts have period-tracking fields
  if (Array.isArray(saved.debts)) {
    saved.debts.forEach(function (d) {
      if (typeof d.paidInCurrentPeriod !== "number") d.paidInCurrentPeriod = 0;
      if (typeof d.currentPeriodKey !== "string") d.currentPeriodKey = "";
    });
  }

  return saved;
}

// ─── Serialization Helpers ────────────────────────────────────

function serializeFactHistory(history) {
  return history.map(({ value, date, to, timestamp }) => ({
    value: Number(value) || 0,
    date: date instanceof Date
      ? date.toISOString()
      : (typeof date === "string" ? date : new Date().toISOString()),
    to: to || "main",
    timestamp: timestamp || null
  }));
}

function deserializeFactHistory(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(({ value, date, to, timestamp }) => {
    let parsedDate;
    if (date) {
      parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date();
      }
      parsedDate.setDate(1);
      parsedDate.setHours(0, 0, 0, 0);
    } else {
      parsedDate = new Date();
      parsedDate.setDate(1);
      parsedDate.setHours(0, 0, 0, 0);
    }

    var ts = timestamp || null;
    if (!ts && date) {
      var fallback = new Date(date);
      if (!isNaN(fallback.getTime())) ts = fallback.toISOString();
    }

    return {
      value: Number(value) || 0,
      date: parsedDate,
      to: to || "main",
      timestamp: ts
    };
  });
}

// ─── Public API ───────────────────────────────────────────────

function initState() {
  let saved = storage.load();

  // Совместимость со старым форматом (protocol_persist)
  if (!saved) {
    try {
      const legacyRaw = localStorage.getItem("protocol_persist");
      if (legacyRaw) {
        saved = JSON.parse(legacyRaw);
        saved.stateVersion = 0; // помечаем как старый формат
      }
    } catch (e) { /* ignore */ }
  }

  if (saved) {
    saved = migrateState(saved);
    applyState(saved);
  } else {
    appState = getDefaultState();
  }

  return appState;
}

function updateState(partial) {
  if (!partial || typeof partial !== "object") return;
  Object.keys(partial).forEach(key => {
    if (key === "accounts" || key === "goalMeta" || key === "uiState" || key === "accountStats" || key === "settings") {
      appState[key] = { ...appState[key], ...partial[key] };
    } else if (
      key === "goals" || key === "completedGoals" || key === "debts" ||
      key === "expensesLog" || key === "debtPaymentHistory" ||
      // CUSTOM SCHEDULE LOGIC — manual income/expense entries are stored as an
      // array of plain objects; treat them like the other domain arrays so the
      // shallow-clone preserves immutability semantics expected by consumers.
      key === "customScheduleEntries"
    ) {
      appState[key] = Array.isArray(partial[key]) ? partial[key].map(g => ({ ...g })) : appState[key];
    } else {
      appState[key] = partial[key];
    }
  });
}

function saveState() {
  const toSave = {
    ...appState,
    factHistory: serializeFactHistory(appState.factHistory),
    financialEvents: typeof FinancialEvents !== "undefined"
      ? FinancialEvents.serialize()
      : (appState.financialEvents || []),
    cashflowEvents: serializeCashflowEvents(appState.cashflowEvents),
    derivedState: appState.derivedState || {},
    lastSavedAt: new Date().toISOString()
  };
  storage.save(toSave);
  return toSave;
}

function loadState() {
  const saved = storage.load();
  if (!saved) return null;
  return migrateState(saved);
}

function applyState(saved) {
  const defaults = getDefaultState();

  appState.stateVersion = saved.stateVersion || defaults.stateVersion;
  appState.lastActiveScreen = saved.lastActiveScreen || defaults.lastActiveScreen;
  appState.lastActiveNavIndex = saved.lastActiveNavIndex != null
    ? saved.lastActiveNavIndex
    : defaults.lastActiveNavIndex;

  appState.income = saved.income ?? defaults.income;
  appState.expenses = saved.expenses ?? defaults.expenses;
  appState.goal = saved.goal ?? defaults.goal;
  appState.saved = saved.saved ?? defaults.saved;

  appState.saveMode = saved.saveMode || defaults.saveMode;

  appState.lastCalc = (saved.lastCalc && saved.lastCalc.ok)
    ? saved.lastCalc
    : defaults.lastCalc;
  appState.chosenPlan = saved.chosenPlan ?? defaults.chosenPlan;
  appState.plannedMonthly = saved.plannedMonthly ?? defaults.plannedMonthly;
  appState.planStartValue = saved.planStartValue ?? defaults.planStartValue;
  appState.initialBalance = Number(saved.initialBalance) || defaults.initialBalance;
  appState.factRatio = saved.factRatio != null
    ? (Number(saved.factRatio) || null)
    : defaults.factRatio;
  appState.goalCompleted = typeof saved.goalCompleted === "boolean"
    ? saved.goalCompleted
    : defaults.goalCompleted;
  appState.selectedScenario = saved.selectedScenario ?? defaults.selectedScenario;
  appState.isInitialized = typeof saved.isInitialized === "boolean"
    ? saved.isInitialized
    : defaults.isInitialized;

  appState.accounts = {
    main: Number(saved.accounts?.main) || 0,
    reserve: Number(saved.accounts?.reserve) || 0
  };

  appState.factHistory = deserializeFactHistory(saved.factHistory);

  // Восстанавливаем финансовые события в движок
  appState.financialEvents = Array.isArray(saved.financialEvents) ? saved.financialEvents : [];
  if (typeof FinancialEvents !== "undefined") {
    FinancialEvents.setEvents(FinancialEvents.deserialize(appState.financialEvents));
  }

  appState.goalMeta = saved.goalMeta && typeof saved.goalMeta === "object"
    ? { ...defaults.goalMeta, ...saved.goalMeta }
    : { ...defaults.goalMeta };

  // ── Multi-goal (v6) ──
  appState.goals = Array.isArray(saved.goals) && saved.goals.length > 0
    ? saved.goals.map(function (g) { return { ...g }; })
    : defaults.goals;
  appState.activeGoalIndex = typeof saved.activeGoalIndex === "number"
    ? saved.activeGoalIndex : 0;
  appState.completedGoals = Array.isArray(saved.completedGoals) ? saved.completedGoals : [];

  // ── Engine (v3) ──
  appState.financialModel = saved.financialModel || defaults.financialModel;
  appState.cashflowEvents = Array.isArray(saved.cashflowEvents) ? saved.cashflowEvents : [];
  appState.derivedState = (saved.derivedState && typeof saved.derivedState === "object")
    ? saved.derivedState
    : {};

  // ── Cashflow settings ──
  appState.incomeType = saved.incomeType || defaults.incomeType;
  appState.expenseType = saved.expenseType || defaults.expenseType;
  appState.frequency = saved.frequency || defaults.frequency;
  appState.incomeFrequency = saved.incomeFrequency || defaults.incomeFrequency;
  appState.expenseFrequency = saved.expenseFrequency || defaults.expenseFrequency;
  appState.fixedIncomeAmount = saved.fixedIncomeAmount ?? defaults.fixedIncomeAmount;
  appState.fixedExpenseAmount = saved.fixedExpenseAmount ?? defaults.fixedExpenseAmount;

  // NEW (v11): periodic mode start dates
  appState.incomeStartDate = typeof saved.incomeStartDate === "string"
    ? saved.incomeStartDate : defaults.incomeStartDate;
  appState.expenseStartDate = typeof saved.expenseStartDate === "string"
    ? saved.expenseStartDate : defaults.expenseStartDate;

  // ── Premium (v4 / SUBSCRIPTION v14) ──
  appState.isPremium = typeof saved.isPremium === "boolean" ? saved.isPremium : defaults.isPremium;

  // SUBSCRIPTION MODEL: восстанавливаем premiumUntil + autoRenew.
  // На старте app.js пересчитывает effective premium через isPremiumActive()
  // (см. syncUserAccessFlagsFromDB) — если premiumUntil просрочен, isPremium
  // автоматически сбрасывается в false локально и обновляется в БД.
  appState.premiumUntil = (typeof saved.premiumUntil === "string" && saved.premiumUntil)
    ? saved.premiumUntil
    : defaults.premiumUntil;
  appState.autoRenew = typeof saved.autoRenew === "boolean"
    ? saved.autoRenew
    : defaults.autoRenew;

  // ADMIN ONLY: community stats block — восстанавливаем из сохранённого
  // состояния; на старте приложения синхронизируется с users.show_community_stats.
  appState.showCommunityStats = typeof saved.showCommunityStats === "boolean"
    ? saved.showCommunityStats
    : defaults.showCommunityStats;

  // ── Flexible onboarding (v5) ──
  appState.hasSeenFlexibleOnboarding = typeof saved.hasSeenFlexibleOnboarding === "boolean"
    ? saved.hasSeenFlexibleOnboarding : defaults.hasSeenFlexibleOnboarding;
  appState.incomeMonthDays = Array.isArray(saved.incomeMonthDays) ? saved.incomeMonthDays : [];
  appState.expenseMonthDays = Array.isArray(saved.expenseMonthDays) ? saved.expenseMonthDays : [];

  // ── Debts (v7) ──
  appState.debts = Array.isArray(saved.debts) ? saved.debts.map(function (d) { return { ...d }; }) : [];
  appState.debtPlanningMode = typeof saved.debtPlanningMode === "boolean" ? saved.debtPlanningMode : false;
  appState.debtOverlaySeen = typeof saved.debtOverlaySeen === "boolean" ? saved.debtOverlaySeen : false;
  appState.debtPaymentHistory = Array.isArray(saved.debtPaymentHistory) ? saved.debtPaymentHistory.map(function (e) { return { ...e }; }) : [];
  appState.activeDebtIndex = typeof saved.activeDebtIndex === "number" ? saved.activeDebtIndex : 0;

  // ── Expenses Tracker (v8) ──
  appState.expensesLog = Array.isArray(saved.expensesLog) ? saved.expensesLog.map(function (e) { return { ...e }; }) : [];

  // CUSTOM SCHEDULE LOGIC (v12) — restore manual entries log + reminder flag.
  appState.customScheduleEntries = Array.isArray(saved.customScheduleEntries)
    ? saved.customScheduleEntries.map(function (e) { return { ...e }; })
    : [];
  appState.customScheduleExpensePrompt = typeof saved.customScheduleExpensePrompt === "boolean"
    ? saved.customScheduleExpensePrompt
    : false;
  // CUSTOM SCHEDULE v2 - fix main plan display — зеркальный флаг для expense → income.
  appState.customScheduleIncomePrompt = typeof saved.customScheduleIncomePrompt === "boolean"
    ? saved.customScheduleIncomePrompt
    : false;

  // ── Settings (v9) ──
  appState.settings = saved.settings && typeof saved.settings === "object"
    ? { ...defaults.settings, ...saved.settings }
    : { ...defaults.settings };

  if (saved.accountStats && typeof saved.accountStats === "object") {
    if (saved.accountStats.main !== undefined || saved.accountStats.reserve !== undefined) {
      appState.accountStats = {
        main: saved.accountStats.main || null,
        reserve: saved.accountStats.reserve || null
      };
    } else if (saved.accountStats.type) {
      appState.accountStats = { main: saved.accountStats, reserve: null };
    } else {
      appState.accountStats = { main: null, reserve: null };
    }

    // PORTFOLIO ALLOCATION LOGIC — migrate legacy single-type stats into a
    // 100% one-item portfolio so the new UI/calc treats every record the same.
    // The legacy fields stay intact for backward compat (renderAccountBackCards
    // fallback, bootstrapInflation refresh, etc.) until next user submit.
    ["main", "reserve"].forEach(function (key) {
      var st = appState.accountStats[key];
      if (!st || typeof st !== "object") return;

      // FUTURE DEPOSITS PER ITEM — drop the deprecated global toggle; the
      // decision is now per-allocation via details.acceptsFutureDeposits.
      if (st.futureSavingsMode != null) delete st.futureSavingsMode;

      // Migrate legacy single-type config into a 100% one-item portfolio.
      var migrated = false;
      if ((!Array.isArray(st.storageAllocation) || !st.storageAllocation.length) && st.type) {
        var details = {};
        if (st.type === "cash") {
          details = { country: st.country || null, currency: st.currency || null, inflation: (st.inflation != null ? st.inflation : null) };
        } else if (st.params && typeof st.params === "object") {
          details = Object.assign({}, st.params);
        }
        st.storageAllocation = [{
          id: "alloc_" + Math.random().toString(36).slice(2, 9),
          type: st.type,
          percentage: 100,
          details: details
        }];
        migrated = true;
      }

      // FUTURE DEPOSITS PER ITEM — back-compat: lift legacy `replenishable`
      // (deposit-only) onto the new `acceptsFutureDeposits` flag and keep the
      // existing field intact for older code paths that may still read it.
      if (Array.isArray(st.storageAllocation)) {
        st.storageAllocation.forEach(function (a) {
          if (!a || !a.details) return;
          if (a.details.acceptsFutureDeposits == null) {
            if (a.type === "deposit" && a.details.replenishable === true) {
              a.details.acceptsFutureDeposits = true;
            } else {
              a.details.acceptsFutureDeposits = false;
            }
          }
        });
      }
      void migrated;
    });
  } else {
    appState.accountStats = { main: null, reserve: null };
  }

  if (saved.uiState && typeof saved.uiState === "object") {
    appState.uiState = { ...defaults.uiState, ...saved.uiState };
  } else {
    appState.uiState = { ...defaults.uiState };
  }

  // ── ONBOARDING FLAGS (v15 + v16) — критично восстановить из persistence! ──
  // Без этого блока флаги онбординга сбрасывались на дефолты при каждом
  // applyState (на старте приложения и после cloud-sync). Для основного тура
  // (firstLaunch) это маскируется защитой _userHasMeaningfulData() — флаг
  // тихо проставляется обратно в true. А для премиум-туров такой защиты нет,
  // и подсказки «Гибкая модель / Pace / Долги / ...» показывались КАЖДЫЙ раз
  // при открытии фичи, вместо одного раза при первом открытии.
  appState.onboardingCompleted = typeof saved.onboardingCompleted === "boolean"
    ? saved.onboardingCompleted
    : defaults.onboardingCompleted;

  appState.premiumOnboardingCompleted = (saved.premiumOnboardingCompleted &&
                                         typeof saved.premiumOnboardingCompleted === "object" &&
                                         !Array.isArray(saved.premiumOnboardingCompleted))
    ? { ...saved.premiumOnboardingCompleted }
    : { ...defaults.premiumOnboardingCompleted };

  if (appState.planStartValue === 0 && appState.initialBalance > 0) {
    appState.planStartValue = appState.initialBalance;
  }

  appState.lastSavedAt = saved.lastSavedAt || null;
}

function clearState() {
  storage.clear();
  appState = getDefaultState();
  if (typeof FinancialEvents !== "undefined") {
    FinancialEvents.clearEvents();
  }
}

function serializeCashflowEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.map(function (e) {
    var copy = {};
    for (var k in e) {
      if (e.hasOwnProperty(k)) copy[k] = e[k];
    }
    if (copy.startDate instanceof Date) copy.startDate = copy.startDate.toISOString();
    if (copy.endDate instanceof Date) copy.endDate = copy.endDate.toISOString();
    return copy;
  });
}

function getState() {
  return appState;
}
