/**
 * Protocol Finance — CashflowEngine (Domain Layer)
 *
 * Единственное вычислительное ядро приложения.
 * Два режима: "simple" (фиксированный взнос) и "cashflow" (event-based с frequency).
 *
 * Загружается ПОСЛЕ financial-events.js и ДО app.js.
 */
(function (global) {
  "use strict";

  // ─── Constants ────────────────────────────────────────────

  var EVENT_TYPE = {
    INCOME: "income",
    EXPENSE: "expense",
    CONTRIBUTION: "contribution",
    UNEXPECTED_EXPENSE: "unexpected_expense"
  };

  var FREQUENCY = {
    ONCE: "once",
    MONTHLY: "monthly",
    WEEKLY: "weekly",
    BIWEEKLY: "biweekly",
    CUSTOM: "custom"
  };

  var PACE_MAP = { calm: 0.4, normal: 0.6, aggressive: 0.8 };

  var WEEKLY_PER_MONTH = 4.33;
  var BIWEEKLY_PER_MONTH = 2.16;

  // ─── Helpers ──────────────────────────────────────────────

  function generateId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function startOfMonth(d) {
    var r = new Date(d || Date.now());
    r.setDate(1);
    r.setHours(0, 0, 0, 0);
    return r;
  }

  /**
   * Converts event amount to a monthly equivalent based on frequency.
   */
  function frequencyToMonthly(amount, frequency, meta) {
    switch (frequency) {
      case FREQUENCY.WEEKLY:
        return amount * WEEKLY_PER_MONTH;
      case FREQUENCY.BIWEEKLY:
        return amount * BIWEEKLY_PER_MONTH;
      case FREQUENCY.CUSTOM:
        var md = (meta && Array.isArray(meta.monthDays)) ? meta.monthDays.length : 1;
        return amount * md;
      case FREQUENCY.MONTHLY:
        return amount;
      case FREQUENCY.ONCE:
      default:
        return 0;
    }
  }

  // ─── Event Normalization ──────────────────────────────────

  function normalizeEvent(raw) {
    if (!raw || typeof raw !== "object") return null;
    var sd = raw.startDate || raw.date;
    if (!(sd instanceof Date)) sd = sd ? new Date(sd) : new Date();
    if (isNaN(sd.getTime())) sd = new Date();
    return {
      id: raw.id || generateId(),
      type: raw.type || EVENT_TYPE.CONTRIBUTION,
      amount: Math.abs(Number(raw.amount)) || 0,
      frequency: raw.frequency || FREQUENCY.ONCE,
      startDate: startOfMonth(sd),
      endDate: raw.endDate ? new Date(raw.endDate) : undefined,
      meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {}
    };
  }

  // ─── Legacy Adapters ──────────────────────────────────────

  function factHistoryToEvents(factHistory) {
    if (!Array.isArray(factHistory)) return [];
    return factHistory
      .map(function (f) {
        var d = f.date instanceof Date ? new Date(f.date) : new Date(f.date || Date.now());
        var isExpense = f.value < 0;
        return normalizeEvent({
          type: isExpense ? EVENT_TYPE.UNEXPECTED_EXPENSE : EVENT_TYPE.CONTRIBUTION,
          amount: Math.abs(f.value),
          startDate: d,
          meta: {
            to: f.to || "main",
            source: isExpense ? (f.to === "reserve" ? "reserve" : "goal") : undefined
          }
        });
      })
      .filter(Boolean);
  }

  function legacySkipEventsOnly(legacyEvents) {
    if (!Array.isArray(legacyEvents)) return [];
    return legacyEvents
      .filter(function (e) {
        return e.type === "unexpected_expense" && e.source === "skip";
      })
      .map(function (e) {
        return normalizeEvent({
          id: e.id,
          type: EVENT_TYPE.UNEXPECTED_EXPENSE,
          amount: 0,
          startDate: e.date,
          meta: { source: "skip" }
        });
      })
      .filter(Boolean);
  }

  // ─── CashflowEngine ──────────────────────────────────────

  function CashflowEngine(opts) {
    opts = opts || {};
    this.modelType = opts.modelType === "cashflow" ? "cashflow" : "simple";

    var bc = opts.baseConfig || {};
    this.baseConfig = {
      goal: Number(bc.goal) || 0,
      income: Number(bc.income) || 0,
      expenses: Number(bc.expenses) || 0,
      saved: Number(bc.saved) || 0,
      mode: bc.mode || "calm",
      hasReserve: !!bc.hasReserve,
      // Phase 2: ответ на плашку «расход уже потрачен?» в неполном стартовом месяце.
      // null/"no" → расход целиком; "yes" → 0; "partial" → минус paidAmount.
      currentMonthExpenseStatus: (bc.currentMonthExpenseStatus === "yes" || bc.currentMonthExpenseStatus === "no" || bc.currentMonthExpenseStatus === "partial") ? bc.currentMonthExpenseStatus : null,
      currentMonthExpensePaidAmount: Number(bc.currentMonthExpensePaidAmount) || 0
    };

    this.events = Array.isArray(opts.events)
      ? opts.events.map(normalizeEvent).filter(Boolean)
      : [];

    this._derived = null;
  }

  // ─── Simple: planned monthly ──────────────────────────────

  CashflowEngine.prototype._getPlannedMonthly = function () {
    var bc = this.baseConfig;
    var free = bc.income - bc.expenses;
    if (free <= 0)
      return { toGoal: 0, toReserve: 0, total: 0, free: free, pace: 0 };

    var pace = PACE_MAP[bc.mode] || 0.6;
    var total = Math.round(free * pace);

    if (!bc.hasReserve)
      return { toGoal: total, toReserve: 0, total: total, free: free, pace: pace };

    var toReserve = Math.round(total * 0.1);
    return {
      toGoal: total - toReserve,
      toReserve: toReserve,
      total: total,
      free: free,
      pace: pace
    };
  };

  // ─── Shared: compute balances from events ─────────────────

  CashflowEngine.prototype._computeBalances = function () {
    var goalBal = Number(this.baseConfig.saved) || 0;
    var reserveBal = 0;
    var totalSkips = 0;

    for (var i = 0; i < this.events.length; i++) {
      var e = this.events[i];
      if (e.frequency && e.frequency !== FREQUENCY.ONCE) continue;
      if (e.type === EVENT_TYPE.INCOME || e.type === EVENT_TYPE.EXPENSE) continue;
      if (e.type === EVENT_TYPE.CONTRIBUTION) {
        var to = (e.meta && e.meta.to) || "main";
        if (to === "reserve") reserveBal += e.amount;
        else goalBal += e.amount;
      } else if (e.type === EVENT_TYPE.UNEXPECTED_EXPENSE) {
        var src = (e.meta && e.meta.source) || "goal";
        if (src === "skip") totalSkips++;
        else if (src === "reserve") reserveBal -= e.amount;
        else goalBal -= e.amount;
      }
    }

    return {
      goalBalance: Math.max(0, goalBal),
      reserveBalance: Math.max(0, reserveBal),
      totalSkips: totalSkips
    };
  };

  // ─── Cashflow: monthly aggregate from recurring events ────
  // (kept for backward compat / UI hints in simple mode)

  CashflowEngine.prototype._getRecurringMonthlyNet = function () {
    var monthlyIncome = 0;
    var monthlyExpense = 0;

    for (var i = 0; i < this.events.length; i++) {
      var e = this.events[i];
      if (e.frequency === FREQUENCY.ONCE) continue;

      var monthly = frequencyToMonthly(e.amount, e.frequency, e.meta);

      if (e.type === EVENT_TYPE.INCOME) {
        monthlyIncome += monthly;
      } else if (e.type === EVENT_TYPE.EXPENSE) {
        monthlyExpense += monthly;
      }
    }

    return {
      monthlyIncome: Math.round(monthlyIncome),
      monthlyExpense: Math.round(monthlyExpense),
      monthlyNet: Math.round(monthlyIncome - monthlyExpense)
    };
  };

  // ─── Cashflow: fact-based forecast ──────────────────────────

  function frequencyMultiplier(freq) {
    switch (freq) {
      case FREQUENCY.WEEKLY:   return WEEKLY_PER_MONTH;
      case FREQUENCY.BIWEEKLY: return BIWEEKLY_PER_MONTH;
      case FREQUENCY.MONTHLY:  return 1;
      default:                 return 1;
    }
  }

  /**
   * Календарно-точный подсчёт числа наступлений периодического события в
   * конкретном календарном месяце (year, monthIndex), начиная с anchor-даты.
   *   • monthly  → 1 (если месяц не раньше месяца старта) - месячная сумма всегда
   *                полная (аренда и т.п. платится целиком даже в неполном месяце);
   *   • weekly   → шаг 7 дней;
   *   • biweekly → шаг 14 дней.
   * Пример: недельный доход со стартом 21 июня даёт в июне 2 наступления (21 и 28).
   * Используется для прогноза ТЕКУЩЕГО (возможно неполного) месяца.
   */
  function occurrencesInMonth(anchorDate, frequency, year, monthIndex) {
    var anchor = (anchorDate instanceof Date) ? anchorDate : new Date(anchorDate);
    if (isNaN(anchor.getTime())) return 0;
    var a0 = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    var first = new Date(year, monthIndex, 1);
    var last = new Date(year, monthIndex + 1, 0);
    last.setHours(23, 59, 59, 999);
    if (a0.getTime() > last.getTime()) return 0; // старт ещё не наступил

    if (frequency === FREQUENCY.MONTHLY) return 1;

    var step = frequency === FREQUENCY.WEEKLY ? 7
             : frequency === FREQUENCY.BIWEEKLY ? 14
             : 0;
    if (step === 0) return 0;

    // Первое наступление, попадающее в месяц (>= 1-го числа).
    var startOcc;
    if (a0.getTime() >= first.getTime()) {
      startOcc = new Date(a0);
    } else {
      var diffDays = Math.round((first.getTime() - a0.getTime()) / 86400000);
      var k = Math.ceil(diffDays / step);
      startOcc = new Date(a0);
      startOcc.setDate(startOcc.getDate() + k * step);
    }
    var count = 0;
    var cur = new Date(startOcc);
    // Внутри одного месяца итераций мало (<= 5 для weekly); setDate безопасен к DST.
    while (cur.getTime() <= last.getTime()) {
      count++;
      cur.setDate(cur.getDate() + step);
    }
    return count;
  }

  /**
   * Builds a monthly forecast from actual event amounts.
   * Groups income/expense events by frequency,
   * averages amount per event, multiplies by expected events/month.
   *
   * Returns { monthlyIncome, monthlyExpense, hasIncomeData, hasExpenseData }
   */
  CashflowEngine.prototype._getForecastFromEvents = function () {
    var incomeByFreq = {};
    var expenseByFreq = {};

    for (var i = 0; i < this.events.length; i++) {
      var e = this.events[i];
      if (e.frequency === FREQUENCY.ONCE && !(e.meta && e.meta.userCreated)) continue;

      var freq = e.frequency || FREQUENCY.MONTHLY;

      if (e.type === EVENT_TYPE.INCOME) {
        if (!incomeByFreq[freq]) incomeByFreq[freq] = [];
        incomeByFreq[freq].push(e.amount);
      } else if (e.type === EVENT_TYPE.EXPENSE) {
        if (!expenseByFreq[freq]) expenseByFreq[freq] = [];
        expenseByFreq[freq].push(e.amount);
      }
    }

    var monthlyIncome = 0;
    var hasIncomeData = false;
    for (var fq in incomeByFreq) {
      if (!incomeByFreq.hasOwnProperty(fq)) continue;
      var amounts = incomeByFreq[fq];
      if (!amounts.length) continue;
      hasIncomeData = true;
      var avg = 0;
      for (var j = 0; j < amounts.length; j++) avg += amounts[j];
      avg = avg / amounts.length;

      var mult = fq === FREQUENCY.CUSTOM ? amounts.length : frequencyMultiplier(fq);
      monthlyIncome += avg * mult;
    }

    var monthlyExpense = 0;
    var hasExpenseData = false;
    for (var fq2 in expenseByFreq) {
      if (!expenseByFreq.hasOwnProperty(fq2)) continue;
      var amounts2 = expenseByFreq[fq2];
      if (!amounts2.length) continue;
      hasExpenseData = true;
      var avg2 = 0;
      for (var k = 0; k < amounts2.length; k++) avg2 += amounts2[k];
      avg2 = avg2 / amounts2.length;

      var mult2 = fq2 === FREQUENCY.CUSTOM ? amounts2.length : frequencyMultiplier(fq2);
      monthlyExpense += avg2 * mult2;
    }

    return {
      monthlyIncome: Math.round(monthlyIncome),
      monthlyExpense: Math.round(monthlyExpense),
      hasIncomeData: hasIncomeData,
      hasExpenseData: hasExpenseData
    };
  };

  /**
   * Календарно-точный прогноз ТЕКУЩЕГО (возможно неполного) месяца.
   * В отличие от _getForecastFromEvents (усреднённый «полный месяц»: weekly ×4.33),
   * здесь доход/расход = (число фактических наступлений в текущем календарном
   * месяце) × сумма. Месячные события дают полную сумму; недельные/2-недельные -
   * столько, сколько реально выпадает на месяц при их дне старта.
   *
   * anchor-дата берётся из meta.anchorDate (реальный день старта), т.к. startDate
   * самого события снапнут на 1-е число месяца в normalizeEvent.
   */
  CashflowEngine.prototype._getCurrentMonthForecast = function (refDate) {
    var now = (refDate instanceof Date) ? refDate : new Date();
    var y = now.getFullYear();
    var mo = now.getMonth();

    var income = 0;
    var expense = 0;

    for (var i = 0; i < this.events.length; i++) {
      var e = this.events[i];
      if (e.type !== EVENT_TYPE.INCOME && e.type !== EVENT_TYPE.EXPENSE) continue;

      var anchorRaw = (e.meta && e.meta.anchorDate) ? e.meta.anchorDate : e.startDate;
      var add = 0;

      if (e.frequency === FREQUENCY.ONCE) {
        // one-time / custom-запись: учитываем, только если её дата в текущем месяце.
        if (!(e.meta && e.meta.userCreated)) continue;
        var od = (anchorRaw instanceof Date) ? anchorRaw : new Date(anchorRaw);
        if (!isNaN(od.getTime()) && od.getFullYear() === y && od.getMonth() === mo) {
          add = e.amount;
        }
      } else {
        add = e.amount * occurrencesInMonth(anchorRaw, e.frequency, y, mo);
      }

      if (e.type === EVENT_TYPE.INCOME) income += add;
      else expense += add;
    }

    return { income: Math.round(income), expense: Math.round(expense) };
  };

  // ─── recalculate() ────────────────────────────────────────

  CashflowEngine.prototype.recalculate = function () {
    if (this.modelType === "cashflow") {
      return this._recalculateCashflow();
    }
    return this._recalculateSimple();
  };

  /**
   * SIMPLE: free × pace, ceil(remaining / toGoal). Fast path.
   */
  CashflowEngine.prototype._recalculateSimple = function () {
    var bc = this.baseConfig;
    var planned = this._getPlannedMonthly();
    var balances = this._computeBalances();
    var remaining = Math.max(0, bc.goal - balances.goalBalance);

    var monthsLeft = 0;
    if (remaining > 0 && planned.toGoal > 0) {
      monthsLeft = Math.ceil(remaining / planned.toGoal) + balances.totalSkips;
    }

    var ok = planned.free > 0 && bc.goal > 0;

    this._derived = {
      ok: ok,
      modelType: "simple",
      currentGoalBalance: Math.max(0, balances.goalBalance),
      reserveBalance: balances.reserveBalance,
      remainingGoal: remaining,
      monthsLeft: monthsLeft,
      monthlySave: planned.total,
      plannedToGoal: planned.toGoal,
      plannedToReserve: planned.toReserve,
      free: planned.free,
      pace: planned.pace,
      riskScore: planned.free > 0 ? Math.min(1, planned.total / planned.free) : 1,
      totalSkips: balances.totalSkips,
      projectedCompletionDate: ok && monthsLeft > 0
        ? (function () { var d = new Date(); d.setMonth(d.getMonth() + monthsLeft); return d; })()
        : null,
      averageMonthlyContribution: planned.toGoal,
      timeline: null
    };

    return this._derived;
  };

  /**
   * CASHFLOW: fact-based forecast. Base income/expenses IGNORED.
   * Monthly figures derived entirely from event history.
   */
  CashflowEngine.prototype._recalculateCashflow = function () {
    var bc = this.baseConfig;
    var balances = this._computeBalances();
    var forecast = this._getForecastFromEvents();

    var free = forecast.monthlyIncome - forecast.monthlyExpense;

    var pace = PACE_MAP[bc.mode] || 0.6;
    var monthlySave = free > 0 ? Math.round(free * pace) : 0;

    // Phase 1: календарно-точный прогноз текущего (неполного) месяца. Доход/расход
    // считаются по фактическому числу наступлений в текущем месяце, а не по
    // усреднённому ×4.33. monthlySave/free выше (steady) остаются для будущих
    // месяцев и базы ETA - текущие значения добавляются отдельно (additive).
    var cmForecast = this._getCurrentMonthForecast();

    // Phase 2: остаток расхода в текущем месяце уточняется ответом пользователя
    // на плашку «расход уже потрачен?» (currentMonthExpenseStatus):
    //   "yes"     → расход в этом месяце уже оплачен → остаток 0;
    //   "partial" → остаток = расход − уже потрачено (currentMonthExpensePaidAmount);
    //   "no"/null → расход ещё предстоит целиком (без изменений).
    var cmExpenseRemaining = cmForecast.expense;
    var cmExpStatus = bc.currentMonthExpenseStatus;
    if (cmExpStatus === "yes") {
      cmExpenseRemaining = 0;
    } else if (cmExpStatus === "partial") {
      cmExpenseRemaining = Math.max(0, cmForecast.expense - (bc.currentMonthExpensePaidAmount || 0));
    }

    var cmFree = cmForecast.income - cmExpenseRemaining;
    var cmSave = cmFree > 0 ? Math.round(cmFree * pace) : 0;

    var toGoal = monthlySave;
    var toReserve = 0;
    if (bc.hasReserve && monthlySave > 0) {
      toReserve = Math.round(monthlySave * 0.1);
      toGoal = monthlySave - toReserve;
    }

    // Phase 2: вклад текущего (возможно неполного) месяца в цель — по тем же
    // правилам резерва, что и полный toGoal.
    var cmToGoal = cmSave;
    if (bc.hasReserve && cmSave > 0) {
      cmToGoal = cmSave - Math.round(cmSave * 0.1);
    }

    var remaining = Math.max(0, bc.goal - balances.goalBalance);

    // Phase 2: ETA с учётом неполного первого месяца. Первый календарный месяц
    // добавляет частичный cmToGoal, последующие — полный toGoal. Для ПОЛНОГО
    // месяца (cmToGoal === toGoal) формула тождественна старой Math.ceil(remaining/toGoal),
    // поэтому established-пользователи и полные месяцы не затрагиваются.
    var monthsLeft = 0;
    if (remaining > 0) {
      if (cmToGoal >= remaining) {
        monthsLeft = 1 + balances.totalSkips;
      } else if (toGoal > 0) {
        monthsLeft = 1 + Math.ceil((remaining - cmToGoal) / toGoal) + balances.totalSkips;
      }
    }

    var hasSufficientData = forecast.hasIncomeData;
    var ok = hasSufficientData && free > 0 && bc.goal > 0;

    this._derived = {
      ok: ok,
      modelType: "cashflow",
      currentGoalBalance: Math.max(0, balances.goalBalance),
      reserveBalance: balances.reserveBalance,
      remainingGoal: remaining,
      monthsLeft: monthsLeft,
      monthlySave: monthlySave,
      plannedToGoal: toGoal,
      plannedToReserve: toReserve,
      free: free,
      pace: pace,
      riskScore: free > 0 ? Math.min(1, monthlySave / free) : 1,
      totalSkips: balances.totalSkips,
      projectedCompletionDate: ok && monthsLeft > 0
        ? (function () { var d = new Date(); d.setMonth(d.getMonth() + monthsLeft); return d; })()
        : null,
      averageMonthlyContribution: toGoal,
      forecastIncome: forecast.monthlyIncome,
      forecastExpense: forecast.monthlyExpense,
      // Phase 1/2: значения текущего (возможно неполного) календарного месяца.
      // currentMonthExpense — ОСТАТОК расхода после ответа на плашку.
      currentMonthIncome: cmForecast.income,
      currentMonthExpense: cmExpenseRemaining,
      currentMonthExpenseFull: cmForecast.expense,
      currentMonthFree: cmFree,
      currentMonthSave: cmSave,
      currentMonthToGoal: cmToGoal,
      isPartialMonth: cmSave !== monthlySave,
      hasIncomeData: forecast.hasIncomeData,
      hasExpenseData: forecast.hasExpenseData,
      timeline: null
    };

    return this._derived;
  };

  // ─── generateTimeline ─────────────────────────────────────

  /**
   * Builds a month-by-month projection.
   * For "simple" — flat planned amounts per month.
   * For "cashflow" — aggregates recurring events per month.
   *
   * @param {number} [horizonMonths] — max months to project (default: monthsLeft + 6)
   * @returns {Array<{date, goalBalance, reserveBalance, income, expense}>}
   */
  CashflowEngine.prototype.generateTimeline = function (horizonMonths) {
    if (!this._derived) this.recalculate();
    var d = this._derived;

    var toGoal = d.plannedToGoal || 0;
    var toReserve = d.plannedToReserve || 0;
    var horizon = horizonMonths || (d.monthsLeft > 0 ? d.monthsLeft + 6 : 24);
    if (horizon > 120) horizon = 120;

    var points = [];
    var bal = d.currentGoalBalance;
    var resBal = d.reserveBalance;
    var goal = this.baseConfig.goal;
    var now = startOfMonth();

    points.push({
      date: new Date(now),
      goalBalance: bal,
      reserveBalance: resBal,
      income: 0,
      expense: 0
    });

    for (var m = 1; m <= horizon; m++) {
      var date = new Date(now);
      date.setMonth(date.getMonth() + m);

      bal += toGoal;
      resBal += toReserve;

      if (bal >= goal && goal > 0) {
        bal = goal;
      }

      points.push({
        date: date,
        goalBalance: Math.max(0, Math.round(bal)),
        reserveBalance: Math.max(0, Math.round(resBal)),
        income: d.modelType === "cashflow" ? (d.forecastIncome || 0) : 0,
        expense: d.modelType === "cashflow" ? (d.forecastExpense || 0) : 0
      });

      if (bal >= goal && goal > 0) break;
    }

    this._derived.timeline = points;
    return points;
  };

  // ─── buildAdvice (static) ─────────────────────────────────

  /**
   * Generates advice text from derivedState.
   * Replaces ProtocolCore.buildAdvice — single source of truth.
   */
  CashflowEngine.buildAdvice = function (derived) {
    var _t = typeof t === "function" ? t : function (k) { return k; };

    if (!derived || !derived.ok) {
      return {
        tone: "warning",
        text: _t("engine.noBalance")
      };
    }

    var advice = [];

    if (derived.monthsLeft > 36) {
      advice.push(_t("engine.longTerm"));
    }

    if (derived.pace >= 0.8) {
      advice.push(_t("engine.aggressive"));
    }

    if (derived.monthlySave < 0.15 * derived.free) {
      advice.push(_t("engine.tooLow"));
    }

    if (advice.length === 0) {
      advice.push(_t("engine.stable"));
    }

    return {
      tone: "neutral",
      text: advice.join(" ")
    };
  };

  // ─── getDerivedState ──────────────────────────────────────

  CashflowEngine.prototype.getDerivedState = function () {
    return this._derived;
  };

  // ─── Export ───────────────────────────────────────────────

  global.CashflowEngine = CashflowEngine;
  global.CashflowEngineHelpers = {
    EVENT_TYPE: EVENT_TYPE,
    FREQUENCY: FREQUENCY,
    PACE_MAP: PACE_MAP,
    normalizeEvent: normalizeEvent,
    factHistoryToEvents: factHistoryToEvents,
    legacySkipEventsOnly: legacySkipEventsOnly,
    frequencyToMonthly: frequencyToMonthly,
    startOfMonth: startOfMonth,
    generateId: generateId
  };
})(typeof window !== "undefined" ? window : this);
