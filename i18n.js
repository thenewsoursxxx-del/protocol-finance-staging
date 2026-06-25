/**
 * Protocol Finance - Global Internationalization Layer
 *
 * Lightweight i18n system supporting Russian (ru) and English (en).
 * Loaded AFTER state-manager.js, BEFORE app.js.
 *
 * Public API:
 *   t(key, vars?)        - translate key, optional interpolation {var}
 *   getCurrentLanguage()  - returns "ru" | "en"
 *   applyLanguageToDOM()  - applies translations to all [data-i18n] elements
 *   getMonthName(idx)     - localized month name (0-based)
 *   getMonthNameShort(idx) - localized short month name
 *   getMonthNameGenitive(idx) - localized genitive month name (for dates)
 *   fmtAmount(n)          - format number with currency using settings
 *   fmtNum(n)             - format number with thousands separator only
 */
(function (global) {
  "use strict";

  var I18N = {
    ru: {
      // ── Navigation ──
      "nav.calc": "Расчёт",
      "nav.protocol": "Protocol",
      "nav.accounts": "Счета",
      "nav.goals": "Цели",
      "nav.expenses": "Расходы",

      // ── Calc screen ──
      "calc.title": "Расчёт",
      "calc.income": "Доход",
      "calc.income.hint": "Укажите ваш ежемесячный доход после налогов",
      "calc.expenses": "Расходы",
      "calc.expenses.hint": "Сумма обязательных ежемесячных расходов",
      "calc.goal": "Цель",
      "calc.goal.hint": "Сумма, которую вы хотите накопить",
      "calc.saved": "Уже накоплено",
      "calc.saved.hint": "Сумма, которую вы уже накопили",
      "calc.mode": "Режим накопления",
      "calc.mode.calm": "Спокойно",
      "calc.mode.normal": "Умеренно",
      "calc.mode.aggressive": "Агрессивно",
      "calc.continue": "Продолжить",
      "calc.resetPlan": "Начать сначала",

      // ── Plan summary ──
      "calc.factPlaceholder": "Сколько вы отложили",
      // ── Cashflow record buttons (на экране графика, гибкая модель) ──
      "graph.recordIncome": "Записать доход",
      "graph.recordExpense": "Записать расход",
      "graph.recordHint": "Записывайте доходы и расходы по мере поступления - Protocol сам отложит на цель. Чтобы сменить периодичность или сумму, откройте гибкую модель.",
      "plan.current": "Текущий план",
      "plan.perMonth": "/ месяц",
      "plan.approx": "Примерно",
      "plan.months": "месяцев",
      "plan.mode": "Режим",
      "plan.changePace": "Изменить темп накоплений",
      "plan.addDebts": "Добавить кредиты и долги",
      "plan.freePerMonth": "Свободно в месяц",
      "plan.youSave": "Откладываете",
      "plan.paceOfFree": "Это ~{pct}% от свободных средств",
      "plan.goalReachedIn": "Цель будет достигнута примерно за",
      "plan.forecastIncome": "Прогноз дохода",
      "plan.forecastExpense": "Прогноз расходов",
      "plan.accumulated": "Накоплено",
      "plan.remaining": "Осталось",
      "plan.thisMonthOngoing": "в этом месяце · далее {ongoing}/мес",
      "plan.thisMonthTag": "в этом месяце",
      "plan.expensePaidNote": "в этом месяце уже оплачен",
      "plan.expensePartialNote": "оплачено {paid} в этом месяце",

      // ── Неполный стартовый месяц: плашка про расход ──
      "cs.partialExpense.title": "Уточните расход за этот месяц",
      "cs.partialExpense.q": "До конца месяца осталось {days} дн. Расход {amount}, который вы указали в гибкой модели, в этом месяце уже потрачен?",
      "cs.partialExpense.yes": "Да, уже потрачен",
      "cs.partialExpense.no": "Нет, ещё предстоит",
      "cs.partialExpense.partial": "Потрачен частично",
      "cs.partialExpense.partialLabel": "Сколько уже потрачено в этом месяце?",
      "cs.partialExpense.partialPlaceholder": "Сумма",
      "cs.partialExpense.save": "Сохранить",
      "cs.partialExpense.hint": "Это нужно один раз — чтобы точно посчитать, сколько отложить в неполном первом месяце.",

      // ── Flexible model ──
      "flex.toggle": "Гибкая финансовая модель",
      "flex.income.title": "Ваш доход",
      "flex.income.subtitle": "Как вы получаете деньги?",
      "flex.income.hint": "Это нужно, чтобы точно понимать, когда у вас появляются деньги",
      "flex.expense.title": "Ваши расходы",
      "flex.expense.subtitle": "Как происходят ваши расходы?",
      "flex.expense.hint": "Это влияет на расчёт свободных средств и срок достижения цели",
      "flex.configured": "Настроено",
      "flex.fixed": "Фиксированный",
      "flex.variable": "Нефиксированный",
      "flex.freq.label.income": "Как часто вы получаете доход?",
      "flex.freq.label.expense": "Как часто вы тратите деньги?",
      "flex.freq.monthly": "Ежемесячно",
      "flex.freq.weekly": "Раз в неделю",
      "flex.freq.biweekly": "Раз в 2 нед.",
      "flex.freq.custom": "Свой график",
      "flex.customDays.income": "Выберите дни месяца, когда приходит доход",
      "flex.customDays.expense": "Выберите дни месяца, когда происходят расходы",
      "flex.model.title": "Ваша модель",
      // FINANCIAL EVENTS - INCOME ONLY - блок переведён исключительно на учёт
      // разовых непредсказуемых доходов. Все тексты обновлены, чтобы пользователь
      // не пытался добавить расход через этот раздел (для расходов есть
      // отдельная кнопка «Непредвиденный расход» на экране с графиком).
      "flex.events.title": "Разовые доходы",
      // FINANCIAL EVENTS - INCOME ONLY - subtitle теперь directive (куда идти за
      // регулярными доходами), а не повтор примеров. Примеры остались только
      // в одном месте - в блоке cf-event-examples.
      "flex.events.subtitle": "Регулярные доходы настраиваются в блоках выше",
      "flex.events.hint": "Регулярные доходы настраиваются в блоках выше",
      "flex.events.examples": "Примеры: премия, подарок, возврат долга, продажа вещей, фриланс-подработка",
      "flex.events.add": "+ Добавить доход",
      "flex.incomeAmount.placeholder": "Сумма дохода",
      "flex.expenseAmount.placeholder": "Сумма расхода",

      // ── Flexible model - current configuration summary ──
      "flex.current.title": "Текущая модель",
      "flex.current.helper": "Эта модель используется для расчёта свободных средств и срока достижения цели.",
      "flex.current.income": "Доход",
      "flex.current.expenses": "Расходы",
      "flex.current.incomeUpper": "ДОХОД",
      "flex.current.expensesUpper": "РАСХОДЫ",
      "flex.current.byEvents": "По событиям",
      "flex.current.byEventsHint": "Сумма формируется из событий",
      "flex.current.monthlyImplicit": "Ежемесячно",
      "flex.current.chip.notSet": "не настроено",
      "flex.amount.notSet": "сумма не указана",
      "flex.dates.notSelected": "даты не выбраны",
      "flex.dates.count": "{n} даты",

      // NEW: periodic mode (start date + next occurrence) i18n
      "flex.start.label.income": "Дата первого поступления",
      "flex.start.label.expense": "Дата первого расхода",
      "flex.start.placeholder": "Выберите дату",
      "flex.current.start": "Начало",
      "flex.current.next": "Следующее",
      "flex.current.startNotSet": "укажите дату старта",
      "flex.current.editHint": "Измените сумму, частоту или дату старта - прогноз обновится мгновенно",
      "flex.events.disabledHint": "В фиксированном режиме события добавляются автоматически. Переключитесь в «Нефиксированный», чтобы редактировать график.",
      "flex.events.disabledShort": "Доступно только в нефиксированном режиме",
      "flex.events.disabledTypeShort": "Эта категория настроена как фиксированная",

      // NEW: fixed vs variable 11.05.2026 - read-only summary + variable inputs
      "flex.fixedSummary.helper": "Используются данные, введённые при открытии гибкой модели",
      "flex.fixedSummary.empty.income": "Доход не указан. Заполните «Доход» в основной форме.",
      "flex.fixedSummary.empty.expense": "Расходы не указаны. Заполните «Расходы» в основной форме.",
      "flex.fixedSummary.line.income": "Фиксированный · {amount} · {freq}",
      "flex.fixedSummary.line.expense": "Фиксированные · {amount} · {freq}",
      "flex.fixedSummary.initial": "данные из начального состояния",
      "flex.variable.amountPlaceholder.income": "Сумма дохода",
      "flex.variable.amountPlaceholder.expense": "Сумма расхода",
      "flex.variable.startDate.income": "Дата первого поступления",
      "flex.variable.startDate.expense": "Дата первого расхода",
      "flex.variable.intro.income": "Выберите периодичность, сумму и дату начала графика дохода",
      "flex.variable.intro.expense": "Выберите периодичность, сумму и дату начала графика расходов",

      // ── Lock overlay ──
      "lock.reset": "Начать сначала",

      // ── Protocol / Advice ──
      "advice.title": "Protocol",
      "advice.loading": "Protocol анализирует данные…",
      "advice.loadFailed": "Не удалось загрузить график.",

      // ── Scenario cards ──
      "scenario.direct": "Всё в цель",
      "scenario.buffer": "С резервом",
      "scenario.toGoal": "В цель",
      "scenario.toReserve": "В резерв",
      "scenario.perMonth": "/ мес",
      "scenario.term": "Срок",
      "scenario.months": "мес",
      "scenario.risk": "Риск",
      "scenario.riskHigh": "Выше",
      "scenario.riskLow": "Ниже",
      "scenario.reserveInfo": "Резерв",
      "scenario.reserveDesc": "Это ваша подушка безопасности. Эти средства можно откладывать на отдельный накопительный или инвестиционный счёт.\n\nРезерв защищает от непредвиденных расходов и снижает риск срыва цели.",
      "scenario.sheet.title": "Как копим?",
      "scenario.noBuf": "Без подушки",
      "scenario.noBuf.desc": "Все деньги идут напрямую в цель.",
      "scenario.withBuf": "С подушкой",
      "scenario.withBuf.desc": "Часть средств идёт в резерв - защита от непредвиденных расходов.",

      // ── History ──
      "history.title": "История счёта",
      "history.mainAccount": "История основного счёта",
      "history.initialBalance": "Начальный баланс",
      "history.deposited": "Отложено",

      // ── Accounts ──
      "accounts.title": "Счета",
      "accounts.main": "Основной счёт",
      "accounts.saved": "Накоплено",
      "accounts.reserve": "Резерв",
      "accounts.reserveSub": "Подушка безопасности",
      "accounts.mainHint": "Этот счёт отражает ваши накопления по плану Protocol. Это может быть банковский или инвестиционный счёт либо наличные - главное, чтобы сумма соответствовала расчётам.",
      "accounts.reserveHint": "Резерв - это средства для экстренных ситуаций. Эти деньги не участвуют в достижении цели и используются только при необходимости.",
      "accounts.newAccount": "Новый счёт",
      "accounts.newAccountHint": "Здесь будет создание нового счёта.",
      "accounts.statsTitle": "Статистика счёта",
      "accounts.storageType": "Тип хранения",
      "accounts.cash": "Наличные",
      "accounts.stock": "Фондовый рынок",
      "accounts.deposit": "Вклад / копилка в банке",
      "accounts.metals": "Драгоценные металлы",
      "accounts.addStats": "Добавить статистику",
      "accounts.country": "Страна",
      "accounts.selectCountry": "Выберите страну",
      "accounts.currency": "Валюта",
      "accounts.selectCurrency": "Выберите валюту",
      "accounts.account": "Счёт",

      // ── Monthly status ──
      "monthly.deposited": "Внесено",
      "monthly.complete": "Полностью",
      "monthly.completeValue": "отложено",

      // ── Goals ──
      "goals.title": "Цели",
      "goals.active": "Активная цель",
      "goals.default": "Основная цель",
      "goals.goalLabel": "Цель",
      "goals.savedLabel": "Накоплено",
      "goals.paused": "На паузе",
      "goals.analyzing": "Protocol анализирует цель…",
      "goals.advancedSettings": "Расширенные настройки",
      "goals.goalN": "Цель {n}",
      "goals.reserveHint": "Эти средства не участвуют в достижении цели и используются как подушка безопасности.",

      // ── Goal verdicts ──
      "verdict.paused": "Цель на паузе - средства не начисляются.",
      "verdict.complete": "Цель достигнута. Protocol фиксирует успех.",
      "verdict.almostDone": "Цель близка к завершению. Темп хороший.",
      "verdict.inProgress": "Цель в процессе. Стабильность важнее скорости.",

      // ── Goal editor ──
      "goalEdit.title": "Редактирование цели",
      "goalEdit.name": "Название цели",
      "goalEdit.namePlaceholder": "Например: Квартира",
      "goalEdit.amount": "Сумма цели",
      "goalEdit.save": "Готово",

      // ── Goal history ──
      "goalHistory.title": "История целей",
      "goalHistory.empty": "Завершённых целей пока нет",
      "goalHistory.achieved": "Достигнута за {n} мес.",

      // ── GOAL COMPLETION FEATURE - congrats modal + empty state + history detail ──
      // PREMIUM GOAL COMPLETION - title с принудительным переносом (CSS white-space:pre-line).
      // FIX: goal completion UI - убран маленький 🎉 после "Цель выполнена!"
      // (большой эмодзи сверху сохранён). Текст выравнивается по левому краю в CSS.
      "goalComplete.modal.title": "Поздравляем!\nЦель выполнена!",
      "goalComplete.modal.subtitle": "{amount} • «{name}»",
      "goalComplete.modal.emotional": "Вы молодец! Вы успешно достигли своей цели.",
      "goalComplete.modal.text": "Вы молодец! Вы успешно накопили {amount} на «{name}»",
      "goalComplete.modal.button": "Я молодец!",
      // NEW: Full goal creation flow in Protocol tab - empty-state переехала в Protocol,
      // кнопка теперь ведёт на отдельный экран создания цели (#screen-new-goal).
      "goalEmpty.title": "У вас пока нет активной цели",
      "goalEmpty.subtitle": "Поставьте новую цель - Protocol поможет её достичь",
      "goalEmpty.button": "Начать копить на новую цель",
      "goalEmpty.verdict": "Активной цели пока нет. Готовы начать новую?",
      // NEW: Full goal creation flow in Protocol tab - экран создания новой цели
      // FIX: new goal creation flow - убраны ключи title / tempo / duration (поля удалены из UI).
      "newGoal.screen.title": "Новая цель",
      "newGoal.intro": "Заполните все поля - Protocol построит план достижения",
      "newGoal.field.amount": "Сумма цели",
      "newGoal.field.amountPlaceholder": "1.000.000",
      "newGoal.field.saved": "Уже накоплено",
      "newGoal.field.savedPlaceholder": "0",
      "newGoal.field.income": "Ежемесячный доход",
      "newGoal.field.incomePlaceholder": "100.000",
      "newGoal.field.expenses": "Ежемесячный расход",
      "newGoal.field.expensesPlaceholder": "50.000",
      "newGoal.field.modeCalm": "Спокойно",
      "newGoal.field.modeNormal": "Умеренно",
      "newGoal.field.modeAggressive": "Агрессивно",
      "newGoal.submit": "Создать цель",
      "newGoal.toast.success": "Новая цель создана. Удачи!",
      "newGoal.toast.invalid": "Заполните все поля корректно",
      "newGoal.toast.expGtIncome": "Расходы не могут превышать доход",
      "goalHistory.detail.subtitle": "Завершённая цель",
      "goalHistory.detail.amountLabel": "Накоплено",
      "goalHistory.detail.periodLabel": "Период",
      "goalHistory.detail.durationLabel": "За сколько",
      "goalHistory.detail.durationMonths": "{n} мес.",
      "goalHistory.detail.durationLessMonth": "Меньше месяца",
      "goalHistory.detail.close": "Закрыть",
      "goalHistory.detail.dateUnknown": "-",

      // ── Advanced settings ──
      "advanced.title": "Расширенные настройки",
      "advanced.newGoal": "Новая цель",
      "advanced.newGoalDesc": "Создайте новую цель и управляйте несколькими накоплениями одновременно",
      "advanced.deadlines": "Управление сроками целей",
      "advanced.deadlinesDesc": "Продлите или сократите срок достижения своих целей",
      "advanced.priorities": "Приоритеты накоплений",
      "advanced.prioritiesDesc": "Определите, какая цель важнее - и перераспределите средства",

      // ── Advanced goals ──
      "advGoals.title": "Ваши цели",
      "advGoals.add": "+ Добавить цель",
      "advGoals.sheetTitle": "Новая цель",
      "advGoals.goalName": "Название цели",
      "advGoals.goalNamePlaceholder": "Например: Машина",
      "advGoals.goalAmount": "Сумма цели",
      "advGoals.priority": "Приоритет",
      "advGoals.mainGoal": "Основная цель",
      "advGoals.save": "Сохранить",

      // ── Goal timeline ──
      "timeline.title": "Сроки целей",
      "timeline.manage": "Управление сроками",
      "timeline.hint": "Увеличивайте или сокращайте срок достижения каждой цели. Изменения применяются после сохранения.",

      // ── Goal priority ──
      "priority.title": "Приоритеты",
      "priority.manage": "Приоритеты и порядок",
      "priority.hint": "Определите приоритет каждой цели и порядок распределения средств",

      // ── Expenses ──
      "expenses.title": "Расходы",
      "expenses.spent": "Потрачено",
      "expenses.remaining": "Осталось",
      "expenses.addExpense": "Добавить расход",
      "expenses.addFirst": "Добавьте первый расход, чтобы начать отслеживание бюджета",
      "expenses.limitExceeded": "Лимит превышен на {amount}",
      "expenses.addPrompt": "Добавьте расход",
      "expenses.newExpense": "Новый расход",
      "expenses.category": "Категория",
      "expenses.amount": "Сумма",
      "expenses.date": "Дата",
      "expenses.note": "Заметка (необязательно)",
      "expenses.notePlaceholder": "Комментарий",
      "expenses.saveExpense": "Сохранить расход",
      "expenses.emptyCategory": "Здесь пока нет расходов",
      "expenses.emptyCategorySub": "Добавьте первый расход в этой категории",

      // ── Expense categories ──
      "cat.food": "Продукты",
      "cat.transport": "Транспорт",
      "cat.cafe": "Кафе и рестораны",
      "cat.home": "Дом",
      "cat.subs": "Подписки",
      "cat.fun": "Развлечения",
      "cat.health": "Здоровье",
      "cat.clothes": "Одежда",
      "cat.other": "Прочее",

      // ── Profile ──
      "profile.title": "Профиль",
      // ── ONBOARDING (first-launch tour) ─────────────────────────────────
      "onb.btn.next":        "Далее",
      "onb.btn.done":        "Готово",
      "onb.btn.skip":        "Пропустить",
      "onb.welcome.title":   "Привет! 👋",
      "onb.welcome.text":    "Давай я быстро покажу основное - это займёт меньше минуты.",
      "onb.income.title":    "Доход",
      "onb.income.text":     "Здесь ты добавляешь зарплату и другие регулярные поступления.",
      "onb.expenses.title":  "Расход",
      "onb.expenses.text":   "Сюда - обязательные ежемесячные траты: аренда, продукты, коммуналка.",
      "onb.goal.title":      "Цель",
      "onb.goal.text":       "Здесь ты ставишь сумму, на которую копишь. Protocol рассчитает план под неё.",
      "onb.continue.title":  "Построим план",
      "onb.continue.text":   "Нажми «Продолжить» – откроются график, расходы и учёт истории.",
      "onb.mainAccount.title":"Основной счёт",
      "onb.mainAccount.text": "Здесь видно, сколько у тебя сейчас накоплено всего. Это твой главный финансовый счёт.",
      "onb.reserve.title":   "Резерв",
      "onb.reserve.text":    "Здесь отображается резерв - деньги, которые ты не тратишь на цели. Это твоя финансовая подушка.",
      "onb.profile.title":   "Premium и профиль",
      "onb.profile.text":    "В профиле - Premium-функции, статус подписки и тонкие настройки приложения.",
      "onb.final.title":     "Готово! 🎉",
      "onb.final.text":      "Теперь ты полностью контролируешь свои финансы. Удачи в накоплениях!",
      // PREMIUM FEATURE TOURS - короткие мини-онбординги, фирующие при первом
      // открытии премиум-функции пользователем с активной подпиской.
      "onb.prem.btn.gotIt":     "Понял",
      "onb.prem.flexible.title":"Гибкая модель",
      "onb.prem.flexible.text": "Используй, когда доходы и расходы непостоянны - фриланс, подработки, сезонные траты. Фиксируй каждую сумму вручную, и Protocol точно покажет, сколько осталось до цели.",
      "onb.prem.pace.title":    "Темп накоплений",
      "onb.prem.pace.text":     "Меняй режим - Спокойно / Умеренно / Агрессивно - когда меняется жизненная ситуация. План автоматически пересчитается под новый ритм.",
      "onb.prem.debts.title":   "Кредиты и долги",
      "onb.prem.debts.text":    "Добавляй ипотеку, кредиты, рассрочки и кредитные карты. Protocol учтёт обязательные платежи, льготные периоды и подскажет, когда долг будет погашен.",
      "onb.prem.advanced.title":"Расширенные настройки",
      "onb.prem.advanced.text": "Тонкая настройка плана: добавление нескольких целей, индивидуальная смена сроков любой из целей. Подгони Protocol под себя.",
      "onb.prem.stats.title":   "Статистика счёта",
      "onb.prem.stats.text":    "Обратная сторона карточки - распределяй накопления по типам: наличные, фондовый рынок, вклад, драгоценные металлы. Получишь точную структуру портфеля.",

      "profile.user": "Пользователь",
      // PREMIUM PROFILE BADGE - текст изумрудной плашки рядом с именем
      // (показывается, когда isPremiumActive()=true).
      "profile.premiumBadge": "Premium",
      "profile.settings": "⚙️ Настройки",
      "profile.goalHistory": "📋 История целей",
      "profile.resetPlan": "🔄 Сбросить план",
      // NEW: Full reset button in Profile - финальный текст кнопки "Начать сначала".
      "profile.fullReset": "🆕 Начать сначала",
      // STATISTICS COLLECTION - заголовки блока статистики сообщества
      "profile.stats.title":   "Статистика сообщества",
      "profile.stats.premium": "Пользователей с премиум",
      "profile.stats.free":    "Пользователей без премиум",
      "profile.stats.total":   "Всего",
      // COMMUNITY STATS - extended admin metrics (Stars + growth)
      "profile.stats.subtitle.revenue":  "Доходы Stars",
      "profile.stats.subtitle.activity": "Активность",
      "profile.stats.starsTotal":   "Заработано Stars всего",
      "profile.stats.starsMonth":   "За последний месяц",
      "profile.stats.purchases":    "Покупок Premium",
      "profile.stats.newUsers30d":  "Новых пользователей за 30 дней",
      // EARLY BIRDS — акция «первые 500 = 15 дней Premium»
      "earlyBird.title": "Поздравляем! Вы в числе первых 500 пользователей",
      "earlyBird.subtitle": "Вам доступны 15 дней Premium бесплатно",
      "earlyBird.b1": "Изменение темпа накоплений",
      "earlyBird.b2": "Кредиты и долги в едином плане",
      "earlyBird.b3": "Гибкая финансовая модель",
      "earlyBird.b4": "Расширенные настройки портфеля",
      "earlyBird.b5": "Полная статистика счёта",
      "earlyBird.counter": "Осталось: {n} из {total}",
      "earlyBird.cta": "Активировать 15 дней Premium",
      "earlyBird.activating": "Активируем…",
      "earlyBird.success.title": "Premium активирован!",
      "earlyBird.success.text": "15 дней Premium уже у вас — откройте все возможности приложения.",
      "earlyBird.success.cta": "Продолжить",
      "earlyBird.error": "Не удалось активировать. Попробуйте ещё раз.",
      // NEW: Report problem feature
      "profile.reportProblem": "🐞 Сообщить о проблеме",
      "report.modal.title": "Сообщить о проблеме",
      "report.modal.subtitle": "Ваше сообщение поможет нам улучшить Protocol",
      "report.modal.placeholder": "Опишите проблему как можно подробнее…",
      "report.modal.send": "Отправить",
      "report.modal.cancel": "Отмена",
      "report.modal.empty": "Пожалуйста, опишите проблему",
      // COMPACT BUTTONS - короткие варианты помещаются в компактную кнопку
      "report.modal.sending": "Отправка...",
      "report.toast.success": "Спасибо! Мы посмотрим и ответим как можно скорее",
      "report.toast.failed": "Не удалось отправить отчёт. Попробуйте позже",
      "report.toast.noUser": "Нужно открыть приложение через Telegram, чтобы отправить отчёт",
      // NEW: Media attachment in reports
      "report.modal.attachMedia": "📎 Прикрепить фото/видео",
      "report.modal.mediaLimit": "Можно прикрепить до 5 файлов (макс. 25 МБ каждый)",
      // COMPACT BUTTONS - короткий вариант помещается в компактную кнопку
      "report.modal.uploading": "Загрузка...",
      "report.toast.mediaTooMany": "Максимум 5 файлов",
      "report.toast.mediaTooBig": "Файл слишком большой (макс. 25 МБ): {name}",
      "report.toast.mediaBadType": "Поддерживаются только фото и видео",
      "report.toast.mediaUploadError": "Не удалось загрузить файл: {name}",

      // ── Confirm reset ──
      // NEW: Full reset button in Profile - усиленный текст, упоминает все категории данных.
      "reset.text": "Если вы нажмёте «Начать сначала», будет сброшено всё: текущая цель, накопления, история целей и статистика счетов.",
      "reset.cancel": "Отменить",
      "reset.confirm": "Начать сначала",

      // ── Unexpected expense ──
      "unexpected.title": "Непредвиденный расход",
      // FINANCIAL EVENTS - INCOME ONLY (mirror UX for expense) - индикатор
      // доступного к списанию остатка под input'ом «Сумма расхода».
      "unexpected.available": "Доступно: {amount}",
      "unexpected.overLimit": "Превышает доступный остаток ({amount})",
      "unexpected.desc": "Этот механизм фиксирует внеплановые расходы. После подтверждения Protocol пересчитает финансовый план, скорректирует срок цели и обновит аналитику.",
      "unexpected.fromGoal": "Потратил из накоплений",
      "unexpected.fromGoalDesc": "Сумма будет вычтена из основного счёта",
      "unexpected.fromReserve": "Потратил из резерва",
      "unexpected.fromReserveDesc": "Сумма будет вычтена из резервного счёта",
      "unexpected.skip": "Пропускаю взнос",
      "unexpected.skipDesc": "Этот месяц будет пропущен в плане",
      "unexpected.amount": "Сумма расхода",
      "unexpected.confirm": "Подтвердить",
      "unexpected.skipConfirm": "Подтвердить пропуск",
      "unexpected.skipInfo": "Месяц будет пропущен. Срок цели увеличится на 1 месяц.",

      // PREMIUM SYSTEM - тексты премиум-модалки
      "premium.title": "Protocol Premium",
      "premium.subtitle": "Полный контроль над своими финансами",
      "premium.statsLocked": "Статистика - только в Premium",
      "premium.f1.title": "Управляй темпом",
      "premium.f1.text": "Выбирай между спокойным, умеренным и агрессивным режимом. Настраивай скорость накоплений под свой ритм жизни - и приходи к цели именно тогда, когда нужно тебе.",
      "premium.f2.title": "Долги под контролем",
      "premium.f2.text": "Ипотека, кредит, рассрочка, кредитная карта - всё учитывается автоматически. Аннуитетный расчёт, льготный период карт, прогноз переплаты. Перестань терять деньги на процентах.",
      "premium.f3.title": "Гибкая модель",
      "premium.f3.text": "Нерегулярные доходы, сезонные расходы, фриланс - базовый план не справится. Гибкая модель учитывает реальную жизнь и мгновенно пересчитывает, сколько нужно отложить.",
      "premium.f4.title": "Расширенные настройки",
      "premium.f4.text": "Создавай несколько целей одновременно - копи на квартиру, отпуск и подушку безопасности параллельно. Меняй сроки достижения индивидуально для каждой. Protocol адаптирует план под твою реальную жизнь.",
      "premium.f5.title": "Статистика счёта",
      "premium.f5.text": "Переверни карточку счёта - и сможешь распределять накопления по инструментам: акции, наличные, вклады. Видь точное отражение своих вложенных накоплений.",
      "premium.buyBtn": "Оформить Premium",
      "premium.price": "300 ⭐ / 30 дней",
      "premium.ctaHint": "Полный доступ ко всем функциям · 30 дней",

      // SUBSCRIPTION MODEL - чекбокс автопродления
      "premium.autoRenew.label": "Автоматически продлевать каждые 30 дней",

      // SUBSCRIPTION MODEL - блок текущего статуса подписки в премиум-модалке
      "premium.status.activeUntil": "Premium активен до",
      "premium.status.autoRenewOn": "🔄 Автопродление включено",
      "premium.status.autoRenewOff": "ℹ️ Без автопродления",

      // TELEGRAM STARS - экраны оплаты
      "payment.processing": "Открываем оплату Telegram Stars…",
      "payment.success.title": "Premium активирован!",
      "payment.success.text": "Проверь чат с ботом - там вся информация о подписке",
      "payment.cancelled": "Оплата отменена",
      "payment.failed": "Оплата не прошла. Попробуйте ещё раз",
      "payment.unavailable": "Оплата временно недоступна",

      // ── Pace ──
      "pace.title": "Темп накоплений",
      "pace.current": "Текущий темп",
      "pace.currentSaving": "Сейчас вы откладываете",
      "pace.perMonth": "/ мес",
      "pace.goalAchieved": "Текущая цель будет достигнута за",
      "pace.months": "мес",
      "pace.selectNew": "Выберите новый темп",
      "pace.save": "Сохранить темп накоплений",
      "pace.increased": "Ваш темп увеличится.\nВы будете откладывать на {amount} больше в месяц.\nСрок достижения цели сократится на {months} мес.",
      "pace.decreased": "Ваш темп уменьшится.\nВы будете откладывать на {amount} меньше в месяц.\nСрок достижения цели увеличится на {months} мес.",
      "pace.newVolume": "Новый объём накоплений",
      "pace.newTerm": "Новый срок",

      // ── Debts ──
      "debts.title": "Кредиты и долги",
      "debts.totalDebt": "Общий долг",
      "debts.remaining": "Осталось выплатить",
      "debts.nextPayment": "Ближайший платёж",
      "debts.planToggle": "Учитывать долги отдельно в расчёте",
      "debts.planHint": "Если включено - ежемесячные платежи по долгам будут уменьшать свободные средства для накоплений",
      "debts.accounted": "Платежи учтены в финансовом плане",
      "debts.tracked": "Долги отслеживаются, но не влияют на расчёт",
      "debts.addDebt": "Добавить кредит или долг",
      "debts.repayLabel": "На сколько вы погасили долг",
      "debts.repayBtn": "Зафиксировать погашение",
      "debts.newDebt": "Новый кредит / долг",
      "debts.type": "Тип",
      "debts.credit": "Кредит",
      "debts.debt": "Долг",
      "debts.installment": "Рассрочка",
      "debts.card": "Карта",
      "debts.creditCard": "Кредитная карта",
      "debts.name": "Название",
      "debts.namePlaceholder": "Например: Ипотека",
      "debts.totalAmount": "Общая сумма",
      "debts.remainingAmount": "Осталось выплатить",
      "debts.monthlyPayment": "Ежемесячный платёж",
      "debts.nextDate": "Дата следующего платежа",
      "debts.endDate": "Дата окончания",
      "debts.creditLimit": "Кредитный лимит",
      "debts.freeLimit": "Свободный лимит",
      "debts.note": "Комментарий (необязательно)",
      "debts.notePlaceholder": "Заметка",
      "debts.save": "Сохранить",
      "debts.entryQuestion": "Учтены ли кредиты и долги в указанной вами сумме расходов?",
      "debts.entryHint": "Это поможет Protocol точнее рассчитать ваш финансовый план",
      "debts.entryNo": "Нет",
      "debts.entryYes": "Да, примерно",
      "debts.paymentHistory": "История платежей пуста",
      "debts.paymentHistorySub": "Погашения появятся здесь",
      "debts.breakdown.from": "Из последних {amount}:",
      "debts.breakdown.toDebt": "→ в долг",
      "debts.breakdown.toSavings": "→ в накопления",

      // ── Event editor ──
      // FINANCIAL EVENTS - INCOME ONLY - модалка теперь имеет фиксированный
      // заголовок «Непредсказуемый доход» + поясняющий subtitle и examples-блок.
      "event.title": "Непредсказуемый доход",
      "event.subtitle": "Премия, подарок, возврат долга, продажа вещей и т.п.",
      "event.examples": "💡 Например: премия 50 000, подарок 5 000, возврат долга, продажа техники",
      "event.type": "Тип",
      "event.income": "Доход",
      "event.expense": "Расход",
      "event.amount": "Сумма поступления",
      "event.date": "Дата",
      "event.add": "Добавить доход",

      // ── Mode names ──
      "mode.calm": "Спокойный",
      "mode.normal": "Умеренный",
      "mode.aggressive": "Агрессивный",

      // ── Engine advice ──
      "engine.noBalance": "Сначала нужно привести расходы и доходы в баланс.",
      "engine.longTerm": "Цель долгосрочная - подумайте, готовы ли вы ждать так долго.",
      "engine.aggressive": "Агрессивный режим требует дисциплины и стабильного дохода.",
      "engine.tooLow": "Вы откладываете слишком мало - цель будет достигаться медленно.",
      "engine.stable": "План выглядит устойчивым и реалистичным.",

      // ── Months (nominative) ──
      "month.0": "Январь",
      "month.1": "Февраль",
      "month.2": "Март",
      "month.3": "Апрель",
      "month.4": "Май",
      "month.5": "Июнь",
      "month.6": "Июль",
      "month.7": "Август",
      "month.8": "Сентябрь",
      "month.9": "Октябрь",
      "month.10": "Ноябрь",
      "month.11": "Декабрь",

      // ── Months (genitive, for dates) ──
      "monthGen.0": "января",
      "monthGen.1": "февраля",
      "monthGen.2": "марта",
      "monthGen.3": "апреля",
      "monthGen.4": "мая",
      "monthGen.5": "июня",
      "monthGen.6": "июля",
      "monthGen.7": "августа",
      "monthGen.8": "сентября",
      "monthGen.9": "октября",
      "monthGen.10": "ноября",
      "monthGen.11": "декабря",

      // ── Settings (already existed in settings IIFE, now centralized) ──
      "settings.title": "Настройки",
      "settings.section.finance": "Финансы",
      "settings.baseCurrency": "Основная валюта",
      "settings.baseCurrency.hint": "Все суммы хранятся и рассчитываются в этой валюте",
      "settings.baseCurrency.confirmMsg": "Все суммы будут пересчитаны по текущему курсу. Продолжить?",
      "settings.baseCurrency.failMsg": "Не удалось получить курсы валют. Попробуйте позже.",
      "settings.displayCurrencyEnabled": "Отображать в другой валюте",
      "settings.displayCurrencyEnabled.hint": "Не влияет на расчёты, только на отображение",
      "settings.displayCurrency": "Валюта отображения",
      "settings.section.plan": "План",
      "settings.carryOver": "Автоматически переносить остаток",
      "settings.carryOver.on": "Остаток прошлых месяцев учитывается в прогрессе текущего месяца",
      "settings.carryOver.off": "Учитываются только пополнения текущего месяца",
      "settings.allocation": "Приоритет распределения",
      "settings.allocation.hint": "Определяет, как свободные деньги распределяются внутри плана",
      "settings.allocation.goal": "Всё в цель",
      "settings.allocation.buffer": "С резервом",
      "settings.allowOverpay": "Разрешить перевыполнение плана",
      "settings.allowOverpay.on": "Можно превышать месячный план — излишек переносится на будущие месяцы",
      "settings.allowOverpay.off": "Прогресс ограничен планом — излишек сверх него не переносится",
      "settings.section.interface": "Интерфейс",
      "settings.animations": "Анимации",
      "settings.animations.hint": "Управляет плавными анимациями интерфейса",
      "settings.numberFormat": "Формат чисел",
      "settings.numberFormat.hint": "Выберите, как отображать разделители тысяч",
      // LOADING VIDEO TOGGLE - переключатель в секции «Интерфейс»
      "settings.disableLoadingVideo": "Отключить загрузку видео",
      "settings.disableLoadingVideo.hint": "Отключает фоновые видео на экране загрузки и в премиум-вкладке - экономит трафик и батарею",
      "settings.section.notifications": "Уведомления",
      "settings.notifications": "Напоминания",
      "settings.notifications.hint": "Напоминания помогут не пропускать взносы и выплаты",
      "settings.depositReminder": "Напоминание о внесении",
      "settings.debtReminder": "Напоминание о долгах",
      "settings.reminderTime": "Время напоминаний",
      "settings.section.language": "Язык",
      "settings.language": "Язык интерфейса",
      "settings.language.hint": "Язык интерфейса приложения",

      // ── Stats / purchasing power ──
      "stats.purchasingPower": "Покупательная способность",
      "stats.extraMonthly": "/ месяц",

      // ── History ──
      "history.reserveTitle": "История резерва",
      "history.mainTitle": "История основного счёта",

      // ── Toasts ──
      "toast.debtRepaid": "Часть суммы направлена на погашение долга",
      "toast.insufficientReserve": "Недостаточно средств в резерве.",

      // ── Monthly Status ──
      "status.onTrack": "Ты идёшь по плану или лучше. Всё под контролем.",
      "status.slightlyBehind": "Есть небольшое отставание. Пока не критично.",
      "status.behind": "Ты заметно отстаёшь от плана. Стоит пересмотреть стратегию.",

      // ── Flexible Model ──
      "flex.noDataTitle": "Заполните гибкую финансовую модель",
      "flex.noDataHint": "Добавьте хотя бы одно событие дохода через «Добавить событие», чтобы Protocol рассчитал прогноз.",
      "flex.addIncomeHint": "Добавьте событие дохода, чтобы построить прогноз",
      "flex.noData": "Гибкий (нет данных)",
      "flex.income": "Доход",
      "flex.expense": "Расход",
      "flex.expenses": "Расходы",

      // ── Frequency Labels ──
      "freq.weekly": "раз в неделю",
      "freq.biweekly": "раз в 2 недели",
      "freq.monthly": "ежемесячно",
      "freq.custom": "свой график",
      "freq.fixed": "фиксированный",
      "freq.variable": "нефиксированный",
      "freq.fixedPlural": "фиксированные",
      "freq.variablePlural": "нефиксированные",

      // ── Goal Edit Warnings ──
      "goalEdit.warn3x": "Цель увеличена более чем в 3 раза. План станет значительно длиннее - убедитесь, что это осознанное решение.",
      "goalEdit.warn2x": "Цель увеличена в 2 раза. Срок и нагрузка изменятся.",
      "goalEdit.warnIncrease": "Цель заметно увеличена. Protocol пересчитает план.",

      // ── Misc ──
      "misc.perWeek": "в неделю",
      "misc.perBiweek": "раз в 2 недели",
      "misc.from": "из",
      "misc.saved": "Накоплено",
      "misc.goalLabel": "Цель",
      "misc.monthShort": "мес",
      "misc.monthFull": "месяц",
      "misc.monthsFull": "месяцев",
      "misc.inSavings": "в накопления",
      "misc.exceeded": "Превышен на",
      "misc.required": "Потребуется откладывать",
      "misc.saving": "Откладывается",
      "misc.noTitle": "Без названия",
      "misc.inflation": "Текущая инфляция",
      "misc.required.field": "Обязательное поле",
      "misc.overview": "Обзор",

      // ── Events ──
      "events.tooManySkips": "Уже {count} пропущенных месяцев. Стоит пересмотреть план или режим.",
      "events.frequentExpenses": "Частые расходы из накоплений замедляют цель. Подумайте о резервном фонде.",
      "events.unexpectedSingle": "Зафиксирован непредвиденный расход. План скорректирован.",
      "events.unexpectedMultiple": "Непредвиденных расходов: {count}. План пересчитан.",

      // ── Flow / Protocol ──
      "flow.analyzing": "Protocol анализирует данные…",
      "flow.bufferChosen": "Часть средств будет направляться в резерв.",
      "flow.directChosen": "Все средства идут напрямую в цель.",
      "flow.done": "Готово.",

      // ── Protocol screen ──
      "protocol.loadFailed": "Не удалось загрузить график.",
      "protocol.loadError": "Ошибка загрузки графика.",
      "protocol.goToCalc": "К расчёту",
      "protocol.chooseScenario": "Выберите возможные варианты:",
      "protocol.unexpectedBtn": "Непредвиденный расход",

      // ── History operations ──
      "history.noOps": "Операций пока нет",
      "history.createdWithPlan": "Указано при создании плана",
      "history.unplannedExpense": "Незапланированный расход",

      // ── Graph timeline ──
      "graph.segmentAll": "Все",

      // ── Account stats ──
      "stats.country.RU": "Россия",
      "stats.country.US": "США",
      "stats.country.IN": "Индия",
      "stats.country.CN": "Китай",
      "stats.country.ES": "Испания",
      "stats.country.JP": "Япония",
      "stats.inflation.loading": "Загружаем актуальную инфляцию…",
      "stats.inflation.preview": "Текущая инфляция: {pct}%",
      "stats.inflation.fallback": "Используем приблизительную ставку",
      "stats.type.cash": "Наличные",
      "stats.type.stock": "Фондовый рынок",
      "stats.type.deposit": "Вклад / копилка",
      "stats.type.metals": "Драг. металлы",
      "stats.added": "Статистика добавлена",
      "stats.addBtn": "+ Добавить статистику",
      "stats.storageType": "Тип хранения",
      "stats.country": "Страна",
      "stats.currency": "Валюта",
      "stats.inMonths": "Через {n} {unit}",
      "stats.monthUnit1": "месяц",
      "stats.monthUnit2_4": "месяца",
      "stats.monthUnit5": "месяцев",
      "stats.inYears": "Через {n} года",
      "stats.inflationDisclaimer": "Если инфляция останется {pct}%",
      "stats.purchasingLabel": "Покупательная способность",
      "stats.inflationLoss": "Потеря из-за инфляции",
      "stats.compensationLabel": "Чтобы сохранить покупательную способность:",
      "stats.changeBtn": "Изменить",

      // NEW: Storage type fields
      "stats.field.ticker": "Тикер или название (например, SBER, VOO)",
      "stats.field.tickerHint": "Свободный ввод - используется для подсказки",
      "stats.field.expectedReturn": "Ожидаемая годовая доходность (%)",
      "stats.field.depositRate": "Процентная ставка (% годовых)",
      "stats.field.depositTerm": "Срок вклада (месяцев)",
      "stats.field.capitalization": "Капитализация процентов",
      "stats.cap.monthly": "Ежемесячно",
      "stats.cap.quarterly": "Ежеквартально",
      "stats.cap.end": "В конце срока",
      // FUTURE DEPOSITS PER ITEM - per-allocation auto-replenishment toggle.
      "stats.field.acceptsFutureDeposits":       "Пополнять из будущих отложений",
      "stats.field.acceptsFutureDepositsHint":   "Будущие отложения (доходы) будут автоматически распределяться в этот тип хранения",
      "stats.field.acceptsFutureDeposits.short": "Авто-пополнение",
      // Kept for back-compat with legacy state (used only in alloc-detail history view).
      "stats.field.replenishable": "Пополнять из будущих отложений",
      "stats.field.replenishableHint": "Будущие отложения (доходы) будут автоматически распределяться в этот тип хранения",
      "stats.field.metal": "Металл",
      "stats.metal.gold": "Золото",
      "stats.metal.silver": "Серебро",
      "stats.metal.platinum": "Платина",
      "stats.realReturn": "Реальная доходность",
      "stats.realReturnPositive": "Доходность покрывает инфляцию",
      "stats.purchasingGain": "Прирост за счёт доходности",
      "stats.depositInfo": "Эффективная ставка",
      "stats.metalInfo": "Драгметалл",
      "stats.stockInfo": "Инструмент",

      // PORTFOLIO ALLOCATION LOGIC - portfolio composition UI
      "portfolio.title": "Состав портфеля",
      "portfolio.subtitle": "Распределите накопления по типам хранения",
      "portfolio.empty": "Портфель пуст - добавьте первый тип хранения",
      "portfolio.addBtn": "+ Добавить тип хранения",
      "portfolio.allocated": "Распределено",
      "portfolio.remaining": "Осталось распределить",
      "portfolio.over": "Превышено",
      "portfolio.complete": "Портфель распределён полностью",
      "portfolio.percentage": "Доля портфеля (%)",
      "portfolio.percentageHint": "Какой процент от всей суммы цели вы планируете хранить в этом типе",
      "portfolio.percentagePlaceholder": "например, 40",
      "portfolio.remove": "Удалить",
      "portfolio.edit": "Изменить",
      // FUTURE DEPOSITS PER ITEM - composition footer chip labels.
      "portfolio.futureAccept.none":    "Без авто-пополнения",
      "portfolio.futureAccept.partial": "Авто-пополнение: {n} из {total}",
      "portfolio.futureAccept.all":     "Авто-пополнение во все",

      // FIX: portfolio UX v2 - required fields + soft-disabled add btn + live amount.
      "portfolio.addBtn.fullToast":     "Вы уже используете 100% средств. Чтобы добавить новый тип, уменьшите долю одного из существующих.",
      "portfolio.validation.requiredFields": "Заполните все обязательные поля",
      "portfolio.percentage.liveLabel": "= {amount}",
      "portfolio.modal.addTitle": "Добавить тип хранения",
      "portfolio.modal.editTitle": "Изменить тип хранения",
      "portfolio.modal.save": "Сохранить",
      "portfolio.modal.cancel": "Отмена",
      "portfolio.validation.notFull": "Сумма долей должна составлять 100%",
      "portfolio.validation.over": "Сумма долей превышает 100%",
      "portfolio.validation.empty": "Добавьте хотя бы один тип хранения",
      "portfolio.validation.fillFields": "Заполните все обязательные поля",
      "portfolio.validation.percentageInvalid": "Доля должна быть от 1 до 100",

      // MOEX INTEGRATION - preset assets (RU stocks + MOEX ETFs only)
      "stats.asset.ru_sber":    "Сбер (SBER)",
      "stats.asset.ru_gazprom": "Газпром (GAZP)",
      "stats.asset.ru_yandex":  "Яндекс (YDEX)",
      "stats.asset.ru_tinkoff": "Т-Технологии (T)",
      "stats.asset.ru_lukoil":  "Лукойл (LKOH)",
      "stats.asset.ru_magnit":  "Магнит (MGNT)",
      "stats.asset.ru_norilsk": "Норникель (GMKN)",
      "stats.asset.ru_rosneft": "Роснефть (ROSN)",
      "stats.asset.ru_vk":      "VK (VKCO)",
      "stats.asset.ru_polyus":  "Полюс (PLZL)",
      "stats.asset.etf_fxrl":   "FXRL - Российские акции",
      "stats.asset.etf_fxit":   "FXIT - IT-сектор",
      "stats.asset.etf_fxus":   "FXUS - Акции США",
      "stats.asset.etf_tmos":   "TMOS - Индекс МосБиржи",
      "stats.asset.etf_sbsp":   "SBSP - S&P 500 (СберИнвестиции)",
      "stats.field.asset": "Актив / ETF",

      // MOEX INTEGRATION - section labels for grouped asset list (RU only)
      "stats.assetGroup.ru":      "Российские акции",
      "stats.assetGroup.etfMoex": "ETF на МосБирже",

      // MOEX INTEGRATION - live quote card
      "stats.moex.price":   "Текущая цена",
      "stats.moex.change":  "Изменение за день",
      "stats.moex.loading": "Загружаем котировки с MOEX…",
      "stats.moex.error":   "Не удалось получить котировки",
      "stats.moex.source":  "Данные с MOEX ISS",

      // METALS - IN DEVELOPMENT - info card
      "metals.inDev.title": "В разработке",
      "metals.inDev.desc":  "Поддержка золота, серебра и платины появится в одном из ближайших обновлений приложения.",
      "metals.inDev.toast": "Драгоценные металлы пока в разработке",

      // PORTFOLIO ALLOCATION v2 - deposit promo + renamed capitalization
      // FIX: Promo period for deposits - extended to 0–12 months, clearer hint
      // FIX: friendlier capitalization label + hint, replenishable hint, portfolio percentage hint
      "stats.field.capitalization": "Как часто начисляются проценты",
      "stats.cap.hint": "Чем чаще начисляются проценты - тем быстрее они «работают» сами на себя и увеличивают итоговую доходность",
      "stats.field.promoMonths": "Промо-период (мес, 0–12)",
      "stats.field.promoMonthsHint": "Повышенная ставка на первые месяцы (обычно 1–3 мес, иногда до 6)",
      "stats.field.promoRate":   "Повышенная ставка на промо-период (% годовых)",
      // FIX: dynamic deposit rate label - base only / after promo
      "stats.field.depositRate":     "Процентная ставка (% годовых)",
      "stats.field.depositRateAfterPromo": "Ставка после промо-периода (% годовых)",
      "stats.deposit.effectiveBlended": "Эффективная ставка (промо + база)",
      "stats.deposit.effectivePreview": "Итоговая ожидаемая доходность: {pct}% годовых",

      // PORTFOLIO ALLOCATION v2 - withdraw flow
      "portfolio.withdraw":        "Вывести",
      "portfolio.restore":         "Вернуть",
      "portfolio.withdrawConfirm": "Вывести этот тип хранения? Доли активных типов будут пересчитаны автоматически.",
      "portfolio.withdrawnOn":     "Выведено {date}",
      "portfolio.withdrawnSection": "Выведено из портфеля",
      "portfolio.withdrawnEmpty":   "Здесь будут появляться выведенные типы",
      "portfolio.rebalanced":      "Доли пересчитаны автоматически",
      "portfolio.composition":     "Состав",

      // PORTFOLIO ALLOCATION + CARD EXPANSION - back-card per-type detail flow
      "portfolio.detail.viewMore":     "Посмотреть более детально",
      "portfolio.detail.section.params":    "Параметры",
      "portfolio.detail.section.share":     "Доля в портфеле",
      "portfolio.detail.section.analytics": "Аналитика и прогноз",
      "portfolio.detail.section.history":   "История",
      "portfolio.detail.share.percent":  "Процент от портфеля",
      "portfolio.detail.share.amount":   "Сумма в этом типе",
      "portfolio.detail.analytics.expectedReturn": "Ожидаемая годовая доходность",
      "portfolio.detail.analytics.inflation":      "Инфляция (для cash-долей)",
      "portfolio.detail.analytics.realReturn":     "Реальная доходность",
      "portfolio.detail.analytics.projection":     "Прогноз через {n} {unit}",
      "portfolio.detail.analytics.projectionValue":"Ожидаемая сумма",
      "portfolio.detail.analytics.projectionDelta":"Прирост за период",
      "portfolio.detail.analytics.noProjection":   "Прогноз появится, когда будет рассчитан срок цели",
      "portfolio.detail.history.withdrawnOn":  "Выведено {date}",
      "portfolio.detail.history.snapshotShare":"Доля на момент вывода",
      "portfolio.detail.history.snapshotReturn":"Доходность на момент вывода",
      "portfolio.detail.close": "Закрыть",

      // ── Event toasts ──
      "event.incomeAdded": "Доход добавлен",
      "event.expenseAdded": "Расход добавлен",

      // ── Advanced goals ──
      "advGoals.editTitle": "Редактирование цели",
      "advGoals.newGoal": "Новая цель",
      "advGoals.fillRequired": "Заполните название и сумму",
      "advGoals.maxGoals": "Можно создать максимум 3 цели",
      "advGoals.savedLabel": "Накоплено",
      "advGoals.goalLabel": "Цель",
      "advGoals.perMonthLabel": "В месяц",
      "advGoals.termLabel": "Срок",
      "advGoals.termMonths": "мес.",
      "advGoals.editBtn": "Изменить",
      "advGoals.deleteBtn": "Удалить",
      "advGoals.newGoalDesc": "Создайте новую цель и управляйте несколькими накоплениями одновременно",
      "advGoals.priorityHint1": "Цель получит наибольшую долю накоплений.\nЕсли выбрана позиция 1, остальные цели автоматически сдвинутся ниже.",
      "advGoals.priorityHint2": "Средний приоритет.\nЧасть накоплений будет направляться в эту цель.",
      "advGoals.priorityHint3": "Низкий приоритет.\nЦель будет получать минимальную долю накоплений.",
      "advGoals.priorityShift": "Приоритет выбранной цели изменит порядок других целей.",

      // ── Goal timeline ──
      "timeline.toSavings": "В накопления",
      "timeline.overLimit": "Превышен на",
      "timeline.paused": "На паузе",
      "timeline.completed": "Выполнена",
      "timeline.pctDone": "{pct}% выполнено",
      "timeline.duration": "Срок достижения",
      "timeline.monthsUnit": "мес",
      "timeline.requiredSaving": "Потребуется откладывать",
      "timeline.perMonth": "/ мес",
      "timeline.minimum": "Минимум",
      "timeline.customTerm": "Пользовательский срок",
      "timeline.auto": "Авто",
      "timeline.pausedHint": "Цель на паузе - срок начнёт влиять на расчёт после возобновления",
      "timeline.unrealisticHint": "Установленный срок стал нереалистичным - используется автоматический расчёт",
      "timeline.minLimitHint": "Ниже нельзя - срок станет нереалистичным при текущем темпе накоплений",
      "timeline.saveBtn": "Сохранить сроки",
      "timeline.noChanges": "Сроки целей не были изменены",
      "timeline.saved": "Сроки целей сохранены",

      // ── Goal priority ──
      "priority.label": "Приоритет",
      "priority.saving": "Откладывается",
      "priority.goalReachedIn": "Цель будет достигнута за",
      "priority.saveBtn": "Сохранить приоритет",
      "priority.noChanges": "Приоритеты целей не были изменены",
      "priority.saved": "Приоритет сохранён",

      // ── Pace hints ──
      "pace.hint.calm": "~40% от свободных средств. Комфортный режим без лишнего давления на бюджет.",
      "pace.hint.normal": "~60% от свободных средств. Баланс между скоростью и комфортом.",
      "pace.hint.aggressive": "~80% от свободных средств. Максимальная скорость, но выше нагрузка на бюджет.",
      "pace.noChange": "Темп накоплений не был изменён",
      "pace.updated": "Темп накоплений обновлён",

      // ── Debts extra ──
      "debts.historyBtn": "История",
      "debts.deleteBtn": "Удалить",
      "debts.emptyHint": "Добавьте свой первый кредит или долг",
      "debts.deleted": "Удалено",
      "debts.entryNoToast": "Вы можете рассчитать кредиты и долги, чтобы protocol учёл их в своей системе.",
      "debts.entryYesToast": "Вы можете рассчитать кредиты и долги точнее, если сумма расходов была указана приблизительно.",
      "debts.noTitle": "Укажите название",
      "debts.noPayment": "Укажите ежемесячный платёж",
      "debts.changesSaved": "Изменения сохранены",
      "debts.debtAdded": "Кредит / долг добавлен",
      "debts.accountedToast": "Долги учтены в расчёте",
      "debts.notAccountedToast": "Долги не учтены в расчёте",
      "debts.modeHintOn": "Часть суммы из «Сколько вы отложили» будет автоматически направляться на погашение долгов.",
      "debts.modeHintOff": "Погашение долгов фиксируется отдельно и не влияет на сумму накоплений автоматически.",
      "debts.repaid": "Погашение долга зафиксировано",
      "debts.historyAutoDesc": "Из {total} → {amount} в этот долг",
      "debts.historyManualDesc": "Ручное погашение",
      // REALISTIC DEBT LOGIC - Russian banks
      "debts.interestRate": "Процентная ставка, % годовых",
      "debts.termMonths": "Срок, месяцев",
      "debts.monthsShort": "мес.",
      "debts.gracePeriodDays": "Льготный период, дней",
      "debts.minPaymentPercent": "Минимальный платёж, %",
      "debts.minPayment": "Минимальный платёж",
      // FRIENDLY ANNUITY TEXT - заменили банковский термин на дружелюбную формулировку
      "debts.annuityHint": "Платёж равными частями (как в большинстве российских банков). Если не указать свой платёж - приложение рассчитает его автоматически.",
      "debts.cardHint": "Льготный период обычно 50–120 дней (Сбер, Тинькофф, Альфа). В этот период проценты не начисляются. Минимальный платёж - 5–10% от долга.",
      "debts.graceActive": "До конца льготного периода: {days} дн.",
      "debts.graceExpired": "Льготный период истёк - начисляются проценты",
      "debts.alreadyPaid": "Уже выплачено",
      "debts.interestRemaining": "Осталось переплатить",
      "debts.estimatedPayoff": "Примерный срок полного погашения",

      // ── Expenses extra ──
      "expenses.noLimit": "Лимит не задан",
      "expenses.limitAlmost": "Лимит почти исчерпан",
      "expenses.withinLimit": "Вы укладываетесь в лимит",
      "expenses.selectCategory": "Выберите категорию",
      "expenses.enterAmount": "Введите сумму расхода",
      "expenses.added": "Расход добавлен",
      "expenses.pctOfAll": "{pct}% от всех расходов",
      "expenses.ofTotal": "{amount} из {limit} {sym}",
      "expenses.noNote": "Без заметки",
      "expenses.opPlural0": "операций",
      "expenses.opPlural1": "операция",
      "expenses.opPlural2_4": "операции",

      // ── Settings dynamic hints ──
      "settings.selectCountry": "Выберите страну",
      "settings.selectCurrency": "Выберите валюту",

      // ── Misc extra ──
      "misc.defaultGoalTitle": "Основная цель",

      // CUSTOM SCHEDULE LOGIC - ручной ввод «Свой график» (доход / расход)
      "cs.btn.add.income": "+ Записать поступление",
      "cs.btn.add.expense": "+ Записать расход",
      "cs.modal.title.income": "Ручной ввод поступления",
      "cs.modal.title.expense": "Ручной ввод расхода",
      "cs.modal.title.edit.income": "Изменить поступление",
      "cs.modal.title.edit.expense": "Изменить расход",
      "cs.field.amount.income": "Сумма, которую я получил сейчас",
      "cs.field.amount.expense": "Сумма расхода",
      "cs.field.amountHint.income": "Введите реальную сумму, которую вы получили. Приложение сразу рассчитает, сколько от неё нужно отложить на цель.",
      "cs.field.amountHint.expense": "Введите реальную сумму, которую вы потратили. Запись попадёт в историю и учтётся в прогнозе.",
      // UNIFIED CUSTOM SCHEDULE FLOW - динамическая подсказка под полем суммы,
      // зависит от выбранной периодичности (weekly / biweekly / monthly / custom).
      // Текст одинаковый для income/expense - отличается только глагол «получили/потратили».
      "cs.field.amountHint.income.weekly": "Введите сумму. Приложение будет автоматически учитывать её каждую неделю.",
      "cs.field.amountHint.income.biweekly": "Введите сумму. Приложение будет автоматически учитывать её каждые две недели.",
      "cs.field.amountHint.income.monthly": "Введите сумму. Приложение будет автоматически учитывать её каждый месяц.",
      "cs.field.amountHint.income.custom": "Введите реальную сумму, которую вы получили. Приложение сразу рассчитает, сколько от неё нужно отложить.",
      "cs.field.amountHint.expense.weekly": "Введите сумму. Приложение будет автоматически учитывать её каждую неделю.",
      "cs.field.amountHint.expense.biweekly": "Введите сумму. Приложение будет автоматически учитывать её каждые две недели.",
      "cs.field.amountHint.expense.monthly": "Введите сумму. Приложение будет автоматически учитывать её каждый месяц.",
      "cs.field.amountHint.expense.custom": "Введите реальную сумму, которую вы потратили. Запись попадёт в историю и учтётся в прогнозе.",
      // UNIFIED CUSTOM SCHEDULE FLOW - заголовки модалки с указанием частоты,
      // чтобы пользователь понимал, что именно настраивает.
      "cs.modal.title.income.weekly": "Доход раз в неделю",
      "cs.modal.title.income.biweekly": "Доход раз в две недели",
      "cs.modal.title.income.monthly": "Доход раз в месяц",
      "cs.modal.title.income.custom": "Записать поступление",
      "cs.modal.title.expense.weekly": "Расход раз в неделю",
      "cs.modal.title.expense.biweekly": "Расход раз в две недели",
      "cs.modal.title.expense.monthly": "Расход раз в месяц",
      "cs.modal.title.expense.custom": "Записать расход",
      // UNIFIED CUSTOM SCHEDULE FLOW - badge «следующее: ...» внутри модалки.
      "cs.modal.nextOccurrence.weekly": "Дальше - каждую неделю",
      "cs.modal.nextOccurrence.biweekly": "Дальше - каждые две недели",
      "cs.modal.nextOccurrence.monthly": "Дальше - каждый месяц",
      "cs.modal.nextOccurrence.custom": "Каждый ввод вручную",
      // UNIFIED CUSTOM SCHEDULE FLOW - live-preview (под полем «Дата»).
      "cs.preview.willDeposit": "Отложите на вашу цель",
      "cs.preview.modeHint": "Расчёт от режима «{mode}»",
      "cs.preview.alreadyEnough": "Цель на этот период уже закрыта",
      "cs.preview.expenseNote": "Расход не идёт на цель - учтётся в прогнозе",
      "cs.field.date": "Дата",
      "cs.modal.continue": "Продолжить",
      "cs.modal.save": "Сохранить",
      "cs.modal.cancel": "Отмена",
      "cs.modal.back": "Назад",
      "cs.mode.calm": "Режим: спокойно",
      "cs.mode.normal": "Режим: умеренно",
      "cs.mode.aggressive": "Режим: агрессивно",
      "cs.alloc.title": "График отложений",
      "cs.alloc.needTitle": "Нужно отложить",
      "cs.alloc.fromAmount": "от суммы",
      "cs.alloc.depositBtn": "Отложить на цель",
      "cs.alloc.skipBtn": "Только записать без отложения",
      "cs.alloc.modeLabel": "Расчёт от текущего режима накопления",
      "cs.toast.added.income": "Поступление записано",
      "cs.toast.added.expense": "Расход записан",
      "cs.toast.deposited": "Отложено на цель: {amount}",
      "cs.toast.deleted": "Запись удалена",
      "cs.toast.updated": "Запись обновлена",
      "cs.toast.invalidAmount": "Введите корректную сумму",
      "cs.toast.noGoal": "Сначала создайте цель - иначе не на что откладывать",
      "cs.toast.noChange.income": "Доход не изменился. Меняйте здесь, только если сумма или периодичность изменились. Чтобы записать поступление - используйте кнопки на графике.",
      "cs.toast.noChange.expense": "Расход не изменился. Меняйте здесь, только если сумма или периодичность изменились. Чтобы записать расход - используйте кнопки на графике.",
      "cs.toast.planUpdated.income": "Готово - план пересчитан под новый доход",
      "cs.toast.planUpdated.expense": "Готово - план пересчитан под новый расход",
      "cs.modal.configTitle.income": "Настроить доход",
      "cs.modal.configTitle.expense": "Настроить расход",
      "cs.modal.configBtn": "Сохранить и пересчитать",
      "cs.modal.configHint.income": "Укажите ожидаемый доход за период. Это настраивает план - деньги не откладываются. Фактические поступления записывайте кнопками на графике.",
      "cs.modal.configHint.expense": "Укажите ожидаемый расход за период. Это настраивает план - фактические расходы записывайте кнопками на графике.",
      "cs.reminder.expenses.title": "Не забудьте ввести расходы",
      "cs.reminder.expenses.subtitle": "Запишите расходы за этот период, если они были - прогноз станет точнее.",
      "cs.reminder.expenses.cta": "Записать расход",
      "cs.reminder.expenses.dismiss": "Позже",
      // CUSTOM SCHEDULE v2 - fix main plan display - зеркальное напоминание о доходе.
      "cs.reminder.income.title": "Зафиксируйте доход за период",
      "cs.reminder.income.subtitle": "Если за этот период был доход - впишите его, чтобы план отложений был точнее.",
      "cs.reminder.income.cta": "Записать поступление",
      "cs.reminder.income.dismiss": "Позже",
      // CUSTOM SCHEDULE v2 - fix main plan display - кастомный экран «Текущий план».
      "cs.plan.title": "Нужно отложить",
      "cs.plan.fromLast": "от последней суммы ({amount})",
      "cs.plan.fromLast.income": "от последнего поступления ({amount})",
      "cs.plan.fromLast.expense": "от последнего расхода ({amount})",
      "cs.plan.deposited": "Отложено на цель",
      "cs.plan.depositedFromLast": "Отложено от этой суммы",
      "cs.plan.term": "Срок до цели",
      "cs.plan.termInsufficient": "пока недостаточно данных",
      "cs.plan.termMonths": "≈ {n} мес.",
      "cs.plan.emptyHint": "Сделайте первый ввод в «Своём графике», чтобы рассчитать индивидуальный план.",
      "cs.plan.counterpart.income": "учтён фикс. доход {amount} / мес.",
      "cs.plan.counterpart.expense": "учтён фикс. расход {amount} / мес.",
      "cs.plan.counterpart.lastIncome": "учтён последний доход {amount}",
      "cs.plan.counterpart.lastExpense": "учтён последний расход {amount}",
      "cs.plan.noCounterpart.income": "доход за период не задан",
      "cs.plan.noCounterpart.expense": "расход за период не задан",
      "cs.alloc.breakdown": "{income} − {expense} = свободные {free}",
      "cs.alloc.subTitle.income": "от поступления {amount}",
      "cs.alloc.subTitle.expense": "после расхода {amount}",
      // FIX: custom schedule accumulation + counters update - аккумулированные ключи.
      "cs.plan.totalIncome": "Накоплено дохода",
      "cs.plan.totalExpense": "Расходы за период",
      "cs.plan.free": "Свободно",
      "cs.plan.depositedFromTotal": "Отложено от этой суммы",
      "cs.plan.counterpart.totalIncome": "учтён ручной доход {amount}",
      "cs.plan.counterpart.totalExpense": "учтён ручной расход {amount}",
      "cs.alloc.fromTotal.income": "от накопленного дохода <b>{total}</b> (добавили {added})",
      "cs.alloc.fromTotal.expense": "накопленный расход <b>{total}</b> (добавили {added})",
      "cs.alloc.alreadyDeposited": "Уже отложено",
      "cs.toast.alreadyDeposited": "Уже всё отложено по этим записям",
      "cs.summary.last.income": "Последнее поступление",
      "cs.summary.last.expense": "Последний расход",
      // FIX: custom schedule accumulation + counters update - итоговые суммы.
      "cs.summary.total.income": "Накоплено за период",
      "cs.summary.total.expense": "Расходы за период",
      "cs.summary.deposited": "Отложено",
      "cs.summary.notDeposited": "Не отложено",
      "cs.summary.empty.income": "Пока нет ручных поступлений",
      "cs.summary.empty.expense": "Пока нет ручных расходов",
      "cs.summary.eta": "Примерный срок до цели",
      "cs.summary.eta.months": "≈ {n} мес.",
      "cs.summary.eta.insufficient": "Пока недостаточно данных",
      "cs.history.title.income": "История поступлений",
      "cs.history.title.expense": "История расходов",
      "cs.history.empty": "Записей пока нет",
      "cs.history.deposited.badge": "Отложено {amount}",
      "cs.history.notDeposited.badge": "Не отложено",
      "cs.history.edit": "Изменить",
      "cs.history.delete": "Удалить",
      "cs.history.deposit": "Отложить",
      "cs.history.confirmDelete": "Удалить эту запись из истории?"
    },

    en: {
      // ── Navigation ──
      "nav.calc": "Plan",
      "nav.protocol": "Protocol",
      "nav.accounts": "Accounts",
      "nav.goals": "Goals",
      "nav.expenses": "Expenses",

      // ── Calc screen ──
      "calc.title": "Plan",
      "calc.income": "Income",
      "calc.income.hint": "Your monthly income after taxes",
      "calc.expenses": "Expenses",
      "calc.expenses.hint": "Total mandatory monthly expenses",
      "calc.goal": "Goal",
      "calc.goal.hint": "The amount you want to save",
      "calc.saved": "Already saved",
      "calc.saved.hint": "The amount you have already saved",
      "calc.mode": "Saving mode",
      "calc.mode.calm": "Relaxed",
      "calc.mode.normal": "Moderate",
      "calc.mode.aggressive": "Aggressive",
      "calc.continue": "Continue",
      "calc.resetPlan": "Start over",
      "calc.factPlaceholder": "How much did you save",

      // ── Cashflow record buttons (graph screen, flexible model) ──
      "graph.recordIncome": "Record income",
      "graph.recordExpense": "Record expense",
      "graph.recordHint": "Log income and expenses as they happen - Protocol sets aside toward your goal automatically. To change the frequency or amount, open the flexible model.",

      // ── Plan summary ──
      "plan.current": "Current plan",
      "plan.perMonth": "/ month",
      "plan.approx": "Approximately",
      "plan.months": "months",
      "plan.mode": "Mode",
      "plan.changePace": "Change saving pace",
      "plan.addDebts": "Add loans and debts",
      "plan.freePerMonth": "Free per month",
      "plan.youSave": "You save",
      "plan.paceOfFree": "That's ~{pct}% of free funds",
      "plan.goalReachedIn": "Goal will be reached in approx.",
      "plan.forecastIncome": "Forecast income",
      "plan.forecastExpense": "Forecast expenses",
      "plan.thisMonthOngoing": "this month · then {ongoing}/mo",
      "plan.thisMonthTag": "this month",
      "plan.expensePaidNote": "already paid this month",
      "plan.expensePartialNote": "{paid} paid this month",

      "cs.partialExpense.title": "Clarify this month's expense",
      "cs.partialExpense.q": "{days} days left this month. The expense {amount} you set in the flexible model — has it already been spent this month?",
      "cs.partialExpense.yes": "Yes, already spent",
      "cs.partialExpense.no": "No, still due",
      "cs.partialExpense.partial": "Partially spent",
      "cs.partialExpense.partialLabel": "How much has been spent this month?",
      "cs.partialExpense.partialPlaceholder": "Amount",
      "cs.partialExpense.save": "Save",
      "cs.partialExpense.hint": "One-time question — so we accurately compute how much to set aside in the partial first month.",
      "plan.accumulated": "Accumulated",
      "plan.remaining": "Remaining",

      // ── Flexible model ──
      "flex.toggle": "Flexible financial model",
      "flex.income.title": "Your income",
      "flex.income.subtitle": "How do you receive money?",
      "flex.income.hint": "This helps us understand when your money arrives",
      "flex.expense.title": "Your expenses",
      "flex.expense.subtitle": "How do your expenses occur?",
      "flex.expense.hint": "This affects free cash calculation and goal timeline",
      "flex.configured": "Configured",
      "flex.fixed": "Fixed",
      "flex.variable": "Variable",
      "flex.freq.label.income": "How often do you receive income?",
      "flex.freq.label.expense": "How often do you spend money?",
      "flex.freq.monthly": "Monthly",
      "flex.freq.weekly": "Weekly",
      "flex.freq.biweekly": "Biweekly",
      "flex.freq.custom": "Custom",
      "flex.customDays.income": "Select the days you receive income",
      "flex.customDays.expense": "Select the days expenses occur",
      "flex.model.title": "Your model",
      // FINANCIAL EVENTS - INCOME ONLY - section is now exclusively for one-off
      // unpredictable income (bonus, gift, debt repayment, sales, etc.). Expenses
      // are handled by a separate «Unexpected expense» button on the graph screen.
      "flex.events.title": "One-off income",
      // FINANCIAL EVENTS - INCOME ONLY - subtitle is now a directive, not a
      // repetition of the examples. Examples live only in cf-event-examples.
      "flex.events.subtitle": "Recurring income is configured in the blocks above",
      "flex.events.hint": "Recurring income is configured in the blocks above",
      "flex.events.examples": "Examples: bonus, gift, debt repayment, sale of items, freelance gig",
      "flex.events.add": "+ Add income",
      "flex.incomeAmount.placeholder": "Income amount",
      "flex.expenseAmount.placeholder": "Expense amount",

      // ── Flexible model - current configuration summary ──
      "flex.current.title": "Current model",
      "flex.current.helper": "This model is used to calculate free cash flow and goal timing.",
      "flex.current.income": "Income",
      "flex.current.expenses": "Expenses",
      "flex.current.incomeUpper": "INCOME",
      "flex.current.expensesUpper": "EXPENSES",
      "flex.current.byEvents": "From events",
      "flex.current.byEventsHint": "Amount is built from events",
      "flex.current.monthlyImplicit": "Monthly",
      "flex.current.chip.notSet": "not set",
      "flex.amount.notSet": "amount not set",
      "flex.dates.notSelected": "no dates selected",
      "flex.dates.count": "{n} dates",

      // NEW: periodic mode (start date + next occurrence) i18n
      "flex.start.label.income": "Date of first payment",
      "flex.start.label.expense": "Date of first expense",
      "flex.start.placeholder": "Select a date",
      "flex.current.start": "Start",
      "flex.current.next": "Next",
      "flex.current.startNotSet": "set a start date",
      "flex.current.editHint": "Change amount, frequency or start date - the forecast updates instantly",
      "flex.events.disabledHint": "In fixed mode events are added automatically. Switch to «Variable» to edit the schedule.",
      "flex.events.disabledShort": "Available only in variable mode",
      "flex.events.disabledTypeShort": "This category is set to fixed",

      // NEW: fixed vs variable 11.05.2026 - read-only summary + variable inputs
      "flex.fixedSummary.helper": "Using the values you entered when opening the flexible model",
      "flex.fixedSummary.empty.income": "Income is not set. Fill in «Income» on the main form.",
      "flex.fixedSummary.empty.expense": "Expenses are not set. Fill in «Expenses» on the main form.",
      "flex.fixedSummary.line.income": "Fixed · {amount} · {freq}",
      "flex.fixedSummary.line.expense": "Fixed · {amount} · {freq}",
      "flex.fixedSummary.initial": "data from initial state",
      "flex.variable.amountPlaceholder.income": "Income amount",
      "flex.variable.amountPlaceholder.expense": "Expense amount",
      "flex.variable.startDate.income": "Date of first payment",
      "flex.variable.startDate.expense": "Date of first expense",
      "flex.variable.intro.income": "Pick a frequency, amount and the date your income schedule starts",
      "flex.variable.intro.expense": "Pick a frequency, amount and the date your expense schedule starts",

      // ── Lock overlay ──
      "lock.reset": "Start over",

      // ── Protocol / Advice ──
      "advice.title": "Protocol",
      "advice.loading": "Protocol is analyzing your data…",
      "advice.loadFailed": "Failed to load the chart.",

      // ── Scenario cards ──
      "scenario.direct": "All to goal",
      "scenario.buffer": "With reserve",
      "scenario.toGoal": "To goal",
      "scenario.toReserve": "To reserve",
      "scenario.perMonth": "/ mo",
      "scenario.term": "Term",
      "scenario.months": "mo",
      "scenario.risk": "Risk",
      "scenario.riskHigh": "Higher",
      "scenario.riskLow": "Lower",
      "scenario.reserveInfo": "Reserve",
      "scenario.reserveDesc": "This is your safety cushion. You can keep these funds in a separate savings or investment account.\n\nThe reserve protects against unexpected expenses and reduces the risk of missing your goal.",
      "scenario.sheet.title": "How to save?",
      "scenario.noBuf": "No cushion",
      "scenario.noBuf.desc": "All money goes directly toward the goal.",
      "scenario.withBuf": "With cushion",
      "scenario.withBuf.desc": "Part of the funds goes to a reserve - protection against unexpected expenses.",

      // ── History ──
      "history.title": "Account History",
      "history.mainAccount": "Main Account History",
      "history.initialBalance": "Initial balance",
      "history.deposited": "Deposited",

      // ── Accounts ──
      "accounts.title": "Accounts",
      "accounts.main": "Main Account",
      "accounts.saved": "Saved",
      "accounts.reserve": "Reserve",
      "accounts.reserveSub": "Emergency fund",
      "accounts.mainHint": "This account reflects your savings under the Protocol plan. It can be a bank account, investment account, or cash - as long as the amount matches your calculations.",
      "accounts.reserveHint": "The reserve is for emergencies. These funds are not used toward your goal and are only touched when necessary.",
      "accounts.newAccount": "New Account",
      "accounts.newAccountHint": "New account creation will be here.",
      "accounts.statsTitle": "Account Statistics",
      "accounts.storageType": "Storage type",
      "accounts.cash": "Cash",
      "accounts.stock": "Stock market",
      "accounts.deposit": "Bank deposit / savings",
      "accounts.metals": "Precious metals",
      "accounts.addStats": "Add statistics",
      "accounts.country": "Country",
      "accounts.selectCountry": "Select country",
      "accounts.currency": "Currency",
      "accounts.selectCurrency": "Select currency",
      "accounts.account": "Account",

      // ── Monthly status ──
      "monthly.deposited": "Deposited",
      "monthly.complete": "Fully",
      "monthly.completeValue": "deposited",

      // ── Goals ──
      "goals.title": "Goals",
      "goals.active": "Active goal",
      "goals.default": "Main Goal",
      "goals.goalLabel": "Goal",
      "goals.savedLabel": "Saved",
      "goals.paused": "Paused",
      "goals.analyzing": "Protocol is analyzing the goal…",
      "goals.advancedSettings": "Advanced settings",
      "goals.goalN": "Goal {n}",
      "goals.reserveHint": "These funds are not used toward the goal and serve as an emergency cushion.",

      // ── Goal verdicts ──
      "verdict.paused": "Goal is paused - no funds are being allocated.",
      "verdict.complete": "Goal achieved. Protocol records your success.",
      "verdict.almostDone": "Goal is nearly complete. You're on track.",
      "verdict.inProgress": "Goal in progress. Consistency matters more than speed.",

      // ── Goal editor ──
      "goalEdit.title": "Edit Goal",
      "goalEdit.name": "Goal name",
      "goalEdit.namePlaceholder": "e.g. Apartment",
      "goalEdit.amount": "Goal amount",
      "goalEdit.save": "Done",

      // ── Goal history ──
      "goalHistory.title": "Goal History",
      "goalHistory.empty": "No completed goals yet",
      "goalHistory.achieved": "Achieved in {n} mo.",

      // ── GOAL COMPLETION FEATURE - congrats modal + empty state + history detail ──
      // PREMIUM GOAL COMPLETION - title с принудительным переносом (CSS white-space:pre-line).
      // FIX: goal completion UI - small 🎉 removed; big emoji on top kept.
      "goalComplete.modal.title": "Congrats!\nGoal completed!",
      "goalComplete.modal.subtitle": "{amount} \u2022 \u201C{name}\u201D",
      "goalComplete.modal.emotional": "Well done! You've successfully reached your goal.",
      "goalComplete.modal.text": "Well done! You've saved {amount} for \u201C{name}\u201D",
      "goalComplete.modal.button": "I did it!",
      // NEW: Full goal creation flow in Protocol tab
      "goalEmpty.title": "You don\u2019t have an active goal yet",
      "goalEmpty.subtitle": "Set a new goal \u2014 Protocol will help you reach it",
      "goalEmpty.button": "Start saving for a new goal",
      "goalEmpty.verdict": "No active goal yet. Ready to start a new one?",
      // NEW: Full goal creation flow in Protocol tab
      // FIX: new goal creation flow - title / tempo / duration keys removed (fields dropped).
      "newGoal.screen.title": "New Goal",
      "newGoal.intro": "Fill in all fields \u2014 Protocol will build your savings plan",
      "newGoal.field.amount": "Goal amount",
      "newGoal.field.amountPlaceholder": "1,000,000",
      "newGoal.field.saved": "Already saved",
      "newGoal.field.savedPlaceholder": "0",
      "newGoal.field.income": "Monthly income",
      "newGoal.field.incomePlaceholder": "100,000",
      "newGoal.field.expenses": "Monthly expenses",
      "newGoal.field.expensesPlaceholder": "50,000",
      "newGoal.field.modeCalm": "Relaxed",
      "newGoal.field.modeNormal": "Moderate",
      "newGoal.field.modeAggressive": "Aggressive",
      "newGoal.submit": "Create Goal",
      "newGoal.toast.success": "New goal created. Good luck!",
      "newGoal.toast.invalid": "Please fill in all fields correctly",
      "newGoal.toast.expGtIncome": "Expenses cannot exceed income",
      "goalHistory.detail.subtitle": "Completed Goal",
      "goalHistory.detail.amountLabel": "Saved",
      "goalHistory.detail.periodLabel": "Period",
      "goalHistory.detail.durationLabel": "Duration",
      "goalHistory.detail.durationMonths": "{n} mo.",
      "goalHistory.detail.durationLessMonth": "Less than a month",
      "goalHistory.detail.close": "Close",
      "goalHistory.detail.dateUnknown": "-",

      // ── Advanced settings ──
      "advanced.title": "Advanced Settings",
      "advanced.newGoal": "New Goal",
      "advanced.newGoalDesc": "Create a new goal and manage multiple savings targets at once",
      "advanced.deadlines": "Manage goal timelines",
      "advanced.deadlinesDesc": "Extend or shorten the timeline for each goal",
      "advanced.priorities": "Savings priorities",
      "advanced.prioritiesDesc": "Decide which goal matters most and reallocate funds",

      // ── Advanced goals ──
      "advGoals.title": "Your Goals",
      "advGoals.add": "+ Add Goal",
      "advGoals.sheetTitle": "New Goal",
      "advGoals.goalName": "Goal name",
      "advGoals.goalNamePlaceholder": "e.g. Car",
      "advGoals.goalAmount": "Goal amount",
      "advGoals.priority": "Priority",
      "advGoals.mainGoal": "Main Goal",
      "advGoals.save": "Save",

      // ── Goal timeline ──
      "timeline.title": "Goal Timelines",
      "timeline.manage": "Manage timelines",
      "timeline.hint": "Extend or shorten the timeline for each goal. Changes are applied after saving.",

      // ── Goal priority ──
      "priority.title": "Priorities",
      "priority.manage": "Priorities & order",
      "priority.hint": "Set the priority for each goal and the order of fund allocation",

      // ── Expenses ──
      "expenses.title": "Expenses",
      "expenses.spent": "Spent",
      "expenses.remaining": "Remaining",
      "expenses.addExpense": "Add expense",
      "expenses.addFirst": "Add your first expense to start tracking your budget",
      "expenses.limitExceeded": "Limit exceeded by {amount}",
      "expenses.addPrompt": "Add an expense",
      "expenses.newExpense": "New Expense",
      "expenses.category": "Category",
      "expenses.amount": "Amount",
      "expenses.date": "Date",
      "expenses.note": "Note (optional)",
      "expenses.notePlaceholder": "Comment",
      "expenses.saveExpense": "Save expense",
      "expenses.emptyCategory": "No expenses here yet",
      "expenses.emptyCategorySub": "Add the first expense in this category",

      // ── Expense categories ──
      "cat.food": "Groceries",
      "cat.transport": "Transport",
      "cat.cafe": "Dining out",
      "cat.home": "Home",
      "cat.subs": "Subscriptions",
      "cat.fun": "Entertainment",
      "cat.health": "Health",
      "cat.clothes": "Clothing",
      "cat.other": "Other",

      // ── Profile ──
      "profile.title": "Profile",
      // ── ONBOARDING (first-launch tour) ─────────────────────────────────
      "onb.btn.next":        "Next",
      "onb.btn.done":        "Done",
      "onb.btn.skip":        "Skip",
      "onb.welcome.title":   "Hi there! 👋",
      "onb.welcome.text":    "Let me quickly show you the basics - it will take less than a minute.",
      "onb.income.title":    "Income",
      "onb.income.text":     "Add your salary and other regular sources of income here.",
      "onb.expenses.title":  "Expenses",
      "onb.expenses.text":   "Mandatory monthly spending goes here: rent, groceries, utilities.",
      "onb.goal.title":      "Goal",
      "onb.goal.text":       "Set the amount you're saving toward - Protocol will build a plan to reach it.",
      "onb.continue.title":  "Build the plan",
      "onb.continue.text":   "Tap «Continue» – you'll see the chart, expenses and history tracking.",
      "onb.mainAccount.title":"Main account",
      "onb.mainAccount.text": "This shows your total savings - your main financial account in Protocol.",
      "onb.reserve.title":   "Reserve",
      "onb.reserve.text":    "Your reserve - money set aside, separate from goals. Your financial safety cushion.",
      "onb.profile.title":   "Premium & Profile",
      "onb.profile.text":    "Inside the profile - Premium features, subscription status and fine-grained settings.",
      "onb.final.title":     "All set! 🎉",
      "onb.final.text":      "You now have full control over your finances. Good luck saving!",
      // PREMIUM FEATURE TOURS - short mini-onboardings shown on first open of
      // each premium feature by a paid user.
      "onb.prem.btn.gotIt":     "Got it",
      "onb.prem.flexible.title":"Flexible Model",
      "onb.prem.flexible.text": "Use it when income and expenses vary - freelance, side gigs, seasonal spending. Log each amount manually, and Protocol will precisely show how much is left to your goal.",
      "onb.prem.pace.title":    "Savings Pace",
      "onb.prem.pace.text":     "Switch between Calm / Moderate / Aggressive when life changes. The plan recalculates automatically to match your new rhythm.",
      "onb.prem.debts.title":   "Debts & Credits",
      "onb.prem.debts.text":    "Add mortgages, loans, installments and credit cards. Protocol factors in mandatory payments and grace periods, telling you exactly when each debt is paid off.",
      "onb.prem.advanced.title":"Advanced Settings",
      "onb.prem.advanced.text": "Fine-tune your plan: add multiple goals and customize deadlines for any of them. Make Protocol fit your style.",
      "onb.prem.stats.title":   "Account Statistics",
      "onb.prem.stats.text":    "The back of the card - split savings across cash, stocks, deposits, precious metals. See the exact structure of your portfolio.",

      "profile.user": "User",
      // PREMIUM PROFILE BADGE - label of the emerald badge next to the name
      // (visible when isPremiumActive()=true).
      "profile.premiumBadge": "Premium",
      "profile.settings": "⚙️ Settings",
      "profile.goalHistory": "📋 Goal History",
      "profile.resetPlan": "🔄 Reset Plan",
      // NEW: Full reset button in Profile
      "profile.fullReset": "🆕 Start Over",
      // STATISTICS COLLECTION - community stats block headings
      "profile.stats.title":   "Community Stats",
      "profile.stats.premium": "Premium users",
      "profile.stats.free":    "Free users",
      "profile.stats.total":   "Total",
      // COMMUNITY STATS - extended admin metrics (Stars + growth)
      "profile.stats.subtitle.revenue":  "Stars revenue",
      "profile.stats.subtitle.activity": "Activity",
      "profile.stats.starsTotal":   "Total Stars earned",
      "profile.stats.starsMonth":   "Last 30 days",
      "profile.stats.purchases":    "Premium purchases",
      "profile.stats.newUsers30d":  "New users in 30 days",
      // EARLY BIRDS — promo "first 500 = 15 days Premium"
      "earlyBird.title": "Congrats! You're among the first 500 users",
      "earlyBird.subtitle": "You get 15 days of Premium for free",
      "earlyBird.b1": "Saving pace control",
      "earlyBird.b2": "Loans and debts in one plan",
      "earlyBird.b3": "Flexible financial model",
      "earlyBird.b4": "Advanced portfolio settings",
      "earlyBird.b5": "Full account statistics",
      "earlyBird.counter": "Left: {n} of {total}",
      "earlyBird.cta": "Activate 15 days of Premium",
      "earlyBird.activating": "Activating…",
      "earlyBird.success.title": "Premium activated!",
      "earlyBird.success.text": "15 days of Premium are now yours — unlock everything.",
      "earlyBird.success.cta": "Continue",
      "earlyBird.error": "Activation failed. Please try again.",
      // NEW: Report problem feature
      "profile.reportProblem": "🐞 Report a problem",
      "report.modal.title": "Report a problem",
      "report.modal.subtitle": "Your message helps us improve Protocol",
      "report.modal.placeholder": "Describe the problem in as much detail as possible…",
      "report.modal.send": "Send",
      "report.modal.cancel": "Cancel",
      "report.modal.empty": "Please describe the problem",
      // COMPACT BUTTONS - короткие варианты помещаются в компактную кнопку
      "report.modal.sending": "Sending...",
      "report.toast.success": "Thanks! We'll look into it and reply as soon as possible",
      "report.toast.failed": "Could not send the report. Please try again later",
      "report.toast.noUser": "Open the app via Telegram to send a report",
      // NEW: Media attachment in reports
      "report.modal.attachMedia": "📎 Attach photo/video",
      "report.modal.mediaLimit": "You can attach up to 5 files (max 25 MB each)",
      // COMPACT BUTTONS - короткий вариант помещается в компактную кнопку
      "report.modal.uploading": "Uploading...",
      "report.toast.mediaTooMany": "Maximum 5 files",
      "report.toast.mediaTooBig": "File too large (max 25 MB): {name}",
      "report.toast.mediaBadType": "Only photos and videos are supported",
      "report.toast.mediaUploadError": "Could not upload file: {name}",

      // ── Confirm reset ──
      // NEW: Full reset button in Profile - beefed-up wording listing all reset categories.
      "reset.text": "If you press \u201CStart over\u201D, everything will be reset: current goal, savings, goal history and account statistics.",
      "reset.cancel": "Cancel",
      "reset.confirm": "Start over",

      // ── Unexpected expense ──
      "unexpected.title": "Unexpected Expense",
      // FINANCIAL EVENTS - INCOME ONLY (mirror UX for expense) - available-balance hint.
      "unexpected.available": "Available: {amount}",
      "unexpected.overLimit": "Exceeds available balance ({amount})",
      "unexpected.desc": "This records unplanned expenses. After confirmation, Protocol will recalculate your financial plan, adjust the goal timeline, and update analytics.",
      "unexpected.fromGoal": "Spent from savings",
      "unexpected.fromGoalDesc": "The amount will be deducted from the main account",
      "unexpected.fromReserve": "Spent from reserve",
      "unexpected.fromReserveDesc": "The amount will be deducted from the reserve account",
      "unexpected.skip": "Skip this deposit",
      "unexpected.skipDesc": "This month will be skipped in the plan",
      "unexpected.amount": "Expense amount",
      "unexpected.confirm": "Confirm",
      "unexpected.skipConfirm": "Confirm skip",
      "unexpected.skipInfo": "This month will be skipped. Goal timeline extends by 1 month.",

      // PREMIUM SYSTEM - premium modal texts (EN)
      "premium.title": "Protocol Premium",
      "premium.subtitle": "Full control over your finances",
      "premium.statsLocked": "Statistics - Premium only",
      "premium.f1.title": "Control your pace",
      "premium.f1.text": "Choose between calm, moderate, and aggressive saving modes. Set the speed that fits your lifestyle - and reach your goal exactly when you want.",
      "premium.f2.title": "Debts under control",
      "premium.f2.text": "Mortgage, loan, installment, credit card - all accounted for automatically. Annuity calculation, grace periods, overpayment forecast. Stop losing money on interest.",
      "premium.f3.title": "Flexible model",
      "premium.f3.text": "Irregular income, seasonal expenses, freelance - a basic plan won't cut it. The flexible model adapts to real life and instantly recalculates how much you need to save.",
      "premium.f4.title": "Advanced settings",
      "premium.f4.text": "Create multiple goals at once - save for a home, vacation and emergency fund in parallel. Adjust deadlines individually for each goal. Protocol adapts the plan to your real life.",
      "premium.f5.title": "Account statistics",
      "premium.f5.text": "Flip the account card - and you'll be able to allocate savings across instruments: stocks, cash, deposits. See an accurate breakdown of your invested savings.",
      "premium.buyBtn": "Get Premium",
      "premium.price": "300 ⭐ / 30 days",
      "premium.ctaHint": "Full access to all features · 30 days",

      // SUBSCRIPTION MODEL - auto-renew checkbox
      "premium.autoRenew.label": "Auto-renew every 30 days",

      // SUBSCRIPTION MODEL - current subscription status block in premium modal
      "premium.status.activeUntil": "Premium active until",
      "premium.status.autoRenewOn": "🔄 Auto-renewal is ON",
      "premium.status.autoRenewOff": "ℹ️ No auto-renewal",

      // TELEGRAM STARS - payment screens
      "payment.processing": "Opening Telegram Stars payment…",
      "payment.success.title": "Premium activated!",
      "payment.success.text": "Check your chat with the bot - all subscription details are there",
      "payment.cancelled": "Payment cancelled",
      "payment.failed": "Payment failed. Please try again",
      "payment.unavailable": "Payment is temporarily unavailable",

      // ── Pace ──
      "pace.title": "Saving Pace",
      "pace.current": "Current pace",
      "pace.currentSaving": "Currently saving",
      "pace.perMonth": "/ mo",
      "pace.goalAchieved": "Goal will be reached in",
      "pace.months": "mo",
      "pace.selectNew": "Select new pace",
      "pace.save": "Save new pace",
      "pace.increased": "Your pace will increase.\nYou'll save {amount} more per month.\nGoal timeline shortens by {months} mo.",
      "pace.decreased": "Your pace will decrease.\nYou'll save {amount} less per month.\nGoal timeline extends by {months} mo.",
      "pace.newVolume": "New monthly savings",
      "pace.newTerm": "New term",

      // ── Debts ──
      "debts.title": "Loans & Debts",
      "debts.totalDebt": "Total debt",
      "debts.remaining": "Remaining to pay",
      "debts.nextPayment": "Next payment",
      "debts.planToggle": "Track debt payments separately",
      "debts.planHint": "When enabled, monthly debt payments reduce free funds available for savings",
      "debts.accounted": "Payments accounted for in the financial plan",
      "debts.tracked": "Debts are tracked but don't affect calculations",
      "debts.addDebt": "Add loan or debt",
      "debts.repayLabel": "How much did you repay",
      "debts.repayBtn": "Record repayment",
      "debts.newDebt": "New Loan / Debt",
      "debts.type": "Type",
      "debts.credit": "Loan",
      "debts.debt": "Debt",
      "debts.installment": "Installment",
      "debts.card": "Card",
      "debts.creditCard": "Credit card",
      "debts.name": "Name",
      "debts.namePlaceholder": "e.g. Mortgage",
      "debts.totalAmount": "Total amount",
      "debts.remainingAmount": "Remaining balance",
      "debts.monthlyPayment": "Monthly payment",
      "debts.nextDate": "Next payment date",
      "debts.endDate": "End date",
      "debts.creditLimit": "Credit limit",
      "debts.freeLimit": "Available limit",
      "debts.note": "Note (optional)",
      "debts.notePlaceholder": "Note",
      "debts.save": "Save",
      "debts.entryQuestion": "Are loans and debts included in the expenses you entered?",
      "debts.entryHint": "This helps Protocol calculate your financial plan more accurately",
      "debts.entryNo": "No",
      "debts.entryYes": "Yes, roughly",
      "debts.paymentHistory": "No payment history",
      "debts.paymentHistorySub": "Repayments will appear here",
      "debts.breakdown.from": "From the last {amount}:",
      "debts.breakdown.toDebt": "→ to debt",
      "debts.breakdown.toSavings": "→ to savings",

      // ── Event editor ──
      // FINANCIAL EVENTS - INCOME ONLY - fixed «Unexpected income» modal title.
      "event.title": "Unexpected income",
      "event.subtitle": "Bonus, gift, debt repayment, sale of items, etc.",
      "event.examples": "💡 E.g.: bonus $500, gift $50, debt repayment, gear sale",
      "event.type": "Type",
      "event.income": "Income",
      "event.expense": "Expense",
      "event.amount": "Amount received",
      "event.date": "Date",
      "event.add": "Add income",

      // ── Mode names ──
      "mode.calm": "Relaxed",
      "mode.normal": "Moderate",
      "mode.aggressive": "Aggressive",

      // ── Engine advice ──
      "engine.noBalance": "First, you need to balance your income and expenses.",
      "engine.longTerm": "This is a long-term goal - consider whether you're ready for the wait.",
      "engine.aggressive": "Aggressive mode requires discipline and stable income.",
      "engine.tooLow": "You're saving too little - goal progress will be very slow.",
      "engine.stable": "The plan looks sustainable and realistic.",

      // ── Months (nominative) ──
      "month.0": "January",
      "month.1": "February",
      "month.2": "March",
      "month.3": "April",
      "month.4": "May",
      "month.5": "June",
      "month.6": "July",
      "month.7": "August",
      "month.8": "September",
      "month.9": "October",
      "month.10": "November",
      "month.11": "December",

      // ── Months (genitive - same in English) ──
      "monthGen.0": "January",
      "monthGen.1": "February",
      "monthGen.2": "March",
      "monthGen.3": "April",
      "monthGen.4": "May",
      "monthGen.5": "June",
      "monthGen.6": "July",
      "monthGen.7": "August",
      "monthGen.8": "September",
      "monthGen.9": "October",
      "monthGen.10": "November",
      "monthGen.11": "December",

      // ── Settings ──
      "settings.title": "Settings",
      "settings.section.finance": "Finance",
      "settings.baseCurrency": "Base currency",
      "settings.baseCurrency.hint": "All amounts are stored and calculated in this currency",
      "settings.baseCurrency.confirmMsg": "All amounts will be converted at the current exchange rate. Continue?",
      "settings.baseCurrency.failMsg": "Could not fetch exchange rates. Please try again later.",
      "settings.displayCurrencyEnabled": "Show in a different currency",
      "settings.displayCurrencyEnabled.hint": "Does not affect calculations, only display",
      "settings.displayCurrency": "Display currency",
      "settings.section.plan": "Plan",
      "settings.carryOver": "Carry over balance automatically",
      "settings.carryOver.on": "Surplus from previous months counts toward the current month",
      "settings.carryOver.off": "Only deposits made in the current month are counted",
      "settings.allocation": "Allocation priority",
      "settings.allocation.hint": "Controls how free money is allocated within the plan",
      "settings.allocation.goal": "All to goal",
      "settings.allocation.buffer": "With reserve",
      "settings.allowOverpay": "Allow overpayment",
      "settings.allowOverpay.on": "You can exceed the monthly plan — surplus carries into future months",
      "settings.allowOverpay.off": "Progress is capped at the plan — surplus is not carried over",
      "settings.section.interface": "Interface",
      "settings.animations": "Animations",
      "settings.animations.hint": "Controls smooth UI animations",
      "settings.numberFormat": "Number format",
      "settings.numberFormat.hint": "Choose how to display thousand separators",
      // LOADING VIDEO TOGGLE - Interface section toggle
      "settings.disableLoadingVideo": "Disable video loading",
      "settings.disableLoadingVideo.hint": "Disables background videos on the loading screen and in the Premium tab - saves traffic and battery",
      "settings.section.notifications": "Notifications",
      "settings.notifications": "Reminders",
      "settings.notifications.hint": "Reminders help you stay on track with deposits and payments",
      "settings.depositReminder": "Deposit reminder",
      "settings.debtReminder": "Debt reminder",
      "settings.reminderTime": "Reminder time",
      "settings.section.language": "Language",
      "settings.language": "App language",
      "settings.language.hint": "Application interface language",

      // ── Stats / purchasing power ──
      "stats.purchasingPower": "Purchasing power",
      "stats.extraMonthly": "/ month",

      // ── History ──
      "history.reserveTitle": "Reserve History",
      "history.mainTitle": "Main Account History",

      // ── Toasts ──
      "toast.debtRepaid": "A portion has been applied to debt repayment",
      "toast.insufficientReserve": "Insufficient reserve funds.",

      // ── Monthly Status ──
      "status.onTrack": "You're on track or ahead. Everything is under control.",
      "status.slightlyBehind": "Slightly behind schedule. Not critical yet.",
      "status.behind": "You're noticeably behind. Consider revising your strategy.",

      // ── Flexible Model ──
      "flex.noDataTitle": "Set up your financial model",
      "flex.noDataHint": "Add at least one income event via 'Add Event' so Protocol can build a forecast.",
      "flex.addIncomeHint": "Add an income event to build a forecast",
      "flex.noData": "Flexible (no data)",
      "flex.income": "Income",
      "flex.expense": "Expense",
      "flex.expenses": "Expenses",

      // ── Frequency Labels ──
      "freq.weekly": "weekly",
      "freq.biweekly": "biweekly",
      "freq.monthly": "monthly",
      "freq.custom": "custom schedule",
      "freq.fixed": "fixed",
      "freq.variable": "variable",
      "freq.fixedPlural": "fixed",
      "freq.variablePlural": "variable",

      // ── Goal Edit Warnings ──
      "goalEdit.warn3x": "Goal increased by more than 3x. The plan will take significantly longer - make sure this is intentional.",
      "goalEdit.warn2x": "Goal doubled. Timeline and effort will change.",
      "goalEdit.warnIncrease": "Goal increased noticeably. Protocol will recalculate the plan.",

      // ── Misc ──
      "misc.perWeek": "per week",
      "misc.perBiweek": "biweekly",
      "misc.from": "of",
      "misc.saved": "Saved",
      "misc.goalLabel": "Goal",
      "misc.monthShort": "mo",
      "misc.monthFull": "month",
      "misc.monthsFull": "months",
      "misc.inSavings": "to savings",
      "misc.exceeded": "Exceeded by",
      "misc.required": "Monthly deposit needed",
      "misc.saving": "Saving",
      "misc.noTitle": "Untitled",
      "misc.inflation": "Current inflation",
      "misc.required.field": "Required field",
      "misc.overview": "Overview",

      // ── Events ──
      "events.tooManySkips": "{count} months skipped. Consider adjusting your plan or pace.",
      "events.frequentExpenses": "Frequent withdrawals from savings slow your goal. Consider a reserve fund.",
      "events.unexpectedSingle": "An unexpected expense was recorded. Plan adjusted.",
      "events.unexpectedMultiple": "Unexpected expenses: {count}. Plan recalculated.",

      // ── Flow / Protocol ──
      "flow.analyzing": "Protocol is analyzing your data…",
      "flow.bufferChosen": "A portion of funds will be allocated to a reserve.",
      "flow.directChosen": "All funds go directly to your goal.",
      "flow.done": "Done.",

      // ── Protocol screen ──
      "protocol.loadFailed": "Failed to load the chart.",
      "protocol.loadError": "Chart loading error.",
      "protocol.goToCalc": "Go to Plan",
      "protocol.chooseScenario": "Choose an option:",
      "protocol.unexpectedBtn": "Unexpected Expense",

      // ── History operations ──
      "history.noOps": "No operations yet",
      "history.createdWithPlan": "Set when creating the plan",
      "history.unplannedExpense": "Unplanned expense",

      // ── Graph timeline ──
      "graph.segmentAll": "All",

      // ── Account stats ──
      "stats.country.RU": "Russia",
      "stats.country.US": "USA",
      "stats.country.IN": "India",
      "stats.country.CN": "China",
      "stats.country.ES": "Spain",
      "stats.country.JP": "Japan",
      "stats.inflation.loading": "Loading current inflation\u2026",
      "stats.inflation.preview": "Current inflation: {pct}%",
      "stats.inflation.fallback": "Using approximate rate",
      "stats.type.cash": "Cash",
      "stats.type.stock": "Stock market",
      "stats.type.deposit": "Bank deposit",
      "stats.type.metals": "Precious metals",
      "stats.added": "Statistics added",
      "stats.addBtn": "+ Add statistics",
      "stats.storageType": "Storage type",
      "stats.country": "Country",
      "stats.currency": "Currency",
      "stats.inMonths": "In {n} {unit}",
      "stats.monthUnit1": "month",
      "stats.monthUnit2_4": "months",
      "stats.monthUnit5": "months",
      "stats.inYears": "In {n} years",
      "stats.inflationDisclaimer": "If inflation stays at {pct}%",
      "stats.purchasingLabel": "Purchasing power",
      "stats.inflationLoss": "Loss due to inflation",
      "stats.compensationLabel": "To preserve purchasing power:",
      "stats.changeBtn": "Change",

      // NEW: Storage type fields
      "stats.field.ticker": "Ticker or name (e.g. SBER, VOO)",
      "stats.field.tickerHint": "Free text - used as a reference",
      "stats.field.expectedReturn": "Expected annual return (%)",
      "stats.field.depositRate": "Interest rate (% annual)",
      "stats.field.depositTerm": "Deposit term (months)",
      "stats.field.capitalization": "Interest capitalization",
      "stats.cap.monthly": "Monthly",
      "stats.cap.quarterly": "Quarterly",
      "stats.cap.end": "At the end",
      // FUTURE DEPOSITS PER ITEM - per-allocation auto-replenishment toggle.
      "stats.field.acceptsFutureDeposits":       "Auto-replenish from future savings",
      "stats.field.acceptsFutureDepositsHint":   "Future savings (income) will be automatically allocated into this storage type",
      "stats.field.acceptsFutureDeposits.short": "Auto top-ups",
      // Kept for back-compat with legacy state (used only in alloc-detail history view).
      "stats.field.replenishable": "Auto-replenish from future savings",
      "stats.field.replenishableHint": "Future savings (income) will be automatically allocated into this storage type",
      "stats.field.metal": "Metal",
      "stats.metal.gold": "Gold",
      "stats.metal.silver": "Silver",
      "stats.metal.platinum": "Platinum",
      "stats.realReturn": "Real return",
      "stats.realReturnPositive": "Yield covers inflation",
      "stats.purchasingGain": "Growth from yield",
      "stats.depositInfo": "Effective rate",
      "stats.metalInfo": "Metal",
      "stats.stockInfo": "Instrument",

      // PORTFOLIO ALLOCATION LOGIC - portfolio composition UI
      "portfolio.title": "Portfolio composition",
      "portfolio.subtitle": "Split your savings across storage types",
      "portfolio.empty": "Portfolio is empty - add your first storage type",
      "portfolio.addBtn": "+ Add storage type",
      "portfolio.allocated": "Allocated",
      "portfolio.remaining": "Left to allocate",
      "portfolio.over": "Over allocated",
      "portfolio.complete": "Portfolio is fully allocated",
      "portfolio.percentage": "Share of portfolio (%)",
      "portfolio.percentageHint": "How much of your total goal you plan to keep in this storage type",
      "portfolio.percentagePlaceholder": "e.g. 40",
      "portfolio.remove": "Remove",
      "portfolio.edit": "Edit",
      // FUTURE DEPOSITS PER ITEM - composition footer chip labels.
      "portfolio.futureAccept.none":    "No auto top-ups",
      "portfolio.futureAccept.partial": "Auto top-ups: {n} of {total}",
      "portfolio.futureAccept.all":     "Auto top-ups in all",

      // FIX: portfolio UX v2 - required fields + soft-disabled add btn + live amount.
      "portfolio.addBtn.fullToast":     "You're already using 100% of your funds. To add a new type, reduce the share of an existing one.",
      "portfolio.validation.requiredFields": "Please fill in all required fields",
      "portfolio.percentage.liveLabel": "= {amount}",
      "portfolio.modal.addTitle": "Add storage type",
      "portfolio.modal.editTitle": "Edit storage type",
      "portfolio.modal.save": "Save",
      "portfolio.modal.cancel": "Cancel",
      "portfolio.validation.notFull": "Allocations must add up to 100%",
      "portfolio.validation.over": "Allocations exceed 100%",
      "portfolio.validation.empty": "Add at least one storage type",
      "portfolio.validation.fillFields": "Please fill in all required fields",
      "portfolio.validation.percentageInvalid": "Share must be between 1 and 100",

      // MOEX INTEGRATION - preset assets (RU stocks + MOEX ETFs only)
      "stats.asset.ru_sber":    "Sber (SBER)",
      "stats.asset.ru_gazprom": "Gazprom (GAZP)",
      "stats.asset.ru_yandex":  "Yandex (YDEX)",
      "stats.asset.ru_tinkoff": "T-Technologies (T)",
      "stats.asset.ru_lukoil":  "Lukoil (LKOH)",
      "stats.asset.ru_magnit":  "Magnit (MGNT)",
      "stats.asset.ru_norilsk": "Norilsk Nickel (GMKN)",
      "stats.asset.ru_rosneft": "Rosneft (ROSN)",
      "stats.asset.ru_vk":      "VK (VKCO)",
      "stats.asset.ru_polyus":  "Polyus (PLZL)",
      "stats.asset.etf_fxrl":   "FXRL - Russian equities",
      "stats.asset.etf_fxit":   "FXIT - IT sector",
      "stats.asset.etf_fxus":   "FXUS - US equities",
      "stats.asset.etf_tmos":   "TMOS - MOEX Index",
      "stats.asset.etf_sbsp":   "SBSP - S&P 500 (SberInvest)",
      "stats.field.asset": "Asset / ETF",

      // MOEX INTEGRATION - section labels for grouped asset list (RU only)
      "stats.assetGroup.ru":      "Russian stocks",
      "stats.assetGroup.etfMoex": "MOEX ETFs",

      // MOEX INTEGRATION - live quote card
      "stats.moex.price":   "Current price",
      "stats.moex.change":  "Change today",
      "stats.moex.loading": "Loading MOEX quotes…",
      "stats.moex.error":   "Failed to load quotes",
      "stats.moex.source":  "Data from MOEX ISS",

      // METALS - IN DEVELOPMENT - info card
      "metals.inDev.title": "Coming soon",
      "metals.inDev.desc":  "Support for gold, silver and platinum will arrive in one of the upcoming app updates.",
      "metals.inDev.toast": "Precious metals are coming soon",

      // PORTFOLIO ALLOCATION v2 - deposit promo + renamed capitalization
      // FIX: Promo period for deposits - extended to 0–12 months, clearer hint
      // FIX: friendlier capitalization label + hint, replenishable hint, portfolio percentage hint
      "stats.field.capitalization": "How often interest is credited",
      "stats.cap.hint": "The more often interest is credited, the more it compounds and grows your final yield",
      "stats.field.promoMonths": "Promo period (months, 0–12)",
      "stats.field.promoMonthsHint": "Higher rate for the first months (usually 1–3, sometimes up to 6)",
      "stats.field.promoRate":   "Promo rate (% annual)",
      // FIX: dynamic deposit rate label - base only / after promo
      "stats.field.depositRate":     "Interest rate (% annual)",
      "stats.field.depositRateAfterPromo": "Rate after promo (% annual)",
      "stats.deposit.effectiveBlended": "Effective rate (promo + base)",
      "stats.deposit.effectivePreview": "Estimated annual yield: {pct}% p.a.",

      // PORTFOLIO ALLOCATION v2 - withdraw flow
      "portfolio.withdraw":        "Withdraw",
      "portfolio.restore":         "Restore",
      "portfolio.withdrawConfirm": "Withdraw this storage type? Active shares will be recalculated automatically.",
      "portfolio.withdrawnOn":     "Withdrawn on {date}",
      "portfolio.withdrawnSection": "Withdrawn from portfolio",
      "portfolio.withdrawnEmpty":   "Withdrawn storage types will appear here",
      "portfolio.rebalanced":      "Shares rebalanced automatically",
      "portfolio.composition":     "Composition",

      // PORTFOLIO ALLOCATION + CARD EXPANSION - back-card per-type detail flow
      "portfolio.detail.viewMore":     "View more details",
      "portfolio.detail.section.params":    "Parameters",
      "portfolio.detail.section.share":     "Share of portfolio",
      "portfolio.detail.section.analytics": "Analytics & projection",
      "portfolio.detail.section.history":   "History",
      "portfolio.detail.share.percent":  "Portfolio share",
      "portfolio.detail.share.amount":   "Amount in this type",
      "portfolio.detail.analytics.expectedReturn": "Expected annual return",
      "portfolio.detail.analytics.inflation":      "Inflation (for cash slices)",
      "portfolio.detail.analytics.realReturn":     "Real return",
      "portfolio.detail.analytics.projection":     "Forecast in {n} {unit}",
      "portfolio.detail.analytics.projectionValue":"Projected amount",
      "portfolio.detail.analytics.projectionDelta":"Change over period",
      "portfolio.detail.analytics.noProjection":   "Forecast will appear once a goal timeline is computed",
      "portfolio.detail.history.withdrawnOn":  "Withdrawn on {date}",
      "portfolio.detail.history.snapshotShare":"Share at withdrawal",
      "portfolio.detail.history.snapshotReturn":"Yield at withdrawal",
      "portfolio.detail.close": "Close",

      // ── Event toasts ──
      "event.incomeAdded": "Income added",
      "event.expenseAdded": "Expense added",

      // ── Advanced goals ──
      "advGoals.editTitle": "Edit Goal",
      "advGoals.newGoal": "New Goal",
      "advGoals.fillRequired": "Please fill in the name and amount",
      "advGoals.maxGoals": "You can create up to 3 goals",
      "advGoals.savedLabel": "Saved",
      "advGoals.goalLabel": "Goal",
      "advGoals.perMonthLabel": "Per month",
      "advGoals.termLabel": "Term",
      "advGoals.termMonths": "mo.",
      "advGoals.editBtn": "Edit",
      "advGoals.deleteBtn": "Delete",
      "advGoals.newGoalDesc": "Create a new goal and manage multiple savings targets at once",
      "advGoals.priorityHint1": "This goal will receive the largest share.\nIf position 1 is selected, other goals will shift down automatically.",
      "advGoals.priorityHint2": "Medium priority.\nA portion of savings will go toward this goal.",
      "advGoals.priorityHint3": "Low priority.\nThis goal will receive the smallest share of savings.",
      "advGoals.priorityShift": "Changing the priority will reorder other goals.",

      // ── Goal timeline ──
      "timeline.toSavings": "To savings",
      "timeline.overLimit": "Exceeded by",
      "timeline.paused": "Paused",
      "timeline.completed": "Completed",
      "timeline.pctDone": "{pct}% complete",
      "timeline.duration": "Time to goal",
      "timeline.monthsUnit": "mo",
      "timeline.requiredSaving": "Required monthly saving",
      "timeline.perMonth": "/ mo",
      "timeline.minimum": "Minimum",
      "timeline.customTerm": "Custom term",
      "timeline.auto": "Auto",
      "timeline.pausedHint": "Goal is paused - the timeline will apply once resumed",
      "timeline.unrealisticHint": "The set term has become unrealistic - automatic calculation is used",
      "timeline.minLimitHint": "Cannot go lower - term would be unrealistic at current pace",
      "timeline.saveBtn": "Save timelines",
      "timeline.noChanges": "Goal timelines were not changed",
      "timeline.saved": "Goal timelines saved",

      // ── Goal priority ──
      "priority.label": "Priority",
      "priority.saving": "Saving",
      "priority.goalReachedIn": "Goal will be reached in",
      "priority.saveBtn": "Save priority",
      "priority.noChanges": "Goal priorities were not changed",
      "priority.saved": "Priority saved",

      // ── Pace hints ──
      "pace.hint.calm": "~40% of free funds. A comfortable pace without budget pressure.",
      "pace.hint.normal": "~60% of free funds. A balance between speed and comfort.",
      "pace.hint.aggressive": "~80% of free funds. Maximum speed, but higher budget load.",
      "pace.noChange": "Saving pace was not changed",
      "pace.updated": "Saving pace updated",

      // ── Debts extra ──
      "debts.historyBtn": "History",
      "debts.deleteBtn": "Delete",
      "debts.emptyHint": "Add your first loan or debt",
      "debts.deleted": "Deleted",
      "debts.entryNoToast": "You can add loans and debts so Protocol accounts for them.",
      "debts.entryYesToast": "You can calculate debts more precisely if expenses were approximate.",
      "debts.noTitle": "Please enter a name",
      "debts.noPayment": "Please enter the monthly payment",
      "debts.changesSaved": "Changes saved",
      "debts.debtAdded": "Loan / debt added",
      "debts.accountedToast": "Debts included in calculations",
      "debts.notAccountedToast": "Debts excluded from calculations",
      "debts.modeHintOn": "A portion of your deposit will automatically go toward debt repayment.",
      "debts.modeHintOff": "Debt repayment is tracked separately and does not affect savings automatically.",
      "debts.repaid": "Debt repayment recorded",
      "debts.historyAutoDesc": "From {total} → {amount} to this debt",
      "debts.historyManualDesc": "Manual repayment",
      // REALISTIC DEBT LOGIC - Russian banks
      "debts.interestRate": "Interest rate, % p.a.",
      "debts.termMonths": "Term, months",
      "debts.monthsShort": "mo.",
      "debts.gracePeriodDays": "Grace period, days",
      "debts.minPaymentPercent": "Minimum payment, %",
      "debts.minPayment": "Minimum payment",
      // FRIENDLY ANNUITY TEXT
      "debts.annuityHint": "Equal-installment payment (as in most Russian banks). If you don't enter your own payment - the app will calculate it for you.",
      "debts.cardHint": "Grace period is typically 50–120 days (Sber, Tinkoff, Alfa). No interest accrues during this period. Minimum payment is 5–10% of the balance.",
      "debts.graceActive": "Grace period ends in: {days} d.",
      "debts.graceExpired": "Grace period expired - interest is being charged",
      "debts.alreadyPaid": "Already paid",
      "debts.interestRemaining": "Interest remaining",
      "debts.estimatedPayoff": "Estimated full payoff",

      // ── Expenses extra ──
      "expenses.noLimit": "No limit set",
      "expenses.limitAlmost": "Limit almost reached",
      "expenses.withinLimit": "You're within the limit",
      "expenses.selectCategory": "Select a category",
      "expenses.enterAmount": "Enter the expense amount",
      "expenses.added": "Expense added",
      "expenses.pctOfAll": "{pct}% of all expenses",
      "expenses.ofTotal": "{amount} of {limit} {sym}",
      "expenses.noNote": "No note",
      "expenses.opPlural0": "operations",
      "expenses.opPlural1": "operation",
      "expenses.opPlural2_4": "operations",

      // ── Settings dynamic hints ──
      "settings.selectCountry": "Select country",
      "settings.selectCurrency": "Select currency",

      // ── Misc extra ──
      "misc.defaultGoalTitle": "Main Goal",

      // CUSTOM SCHEDULE LOGIC - manual entry flow (income / expense)
      "cs.btn.add.income": "+ Record income",
      "cs.btn.add.expense": "+ Record expense",
      "cs.modal.title.income": "Record income",
      "cs.modal.title.expense": "Record expense",
      "cs.modal.title.edit.income": "Edit income",
      "cs.modal.title.edit.expense": "Edit expense",
      "cs.field.amount.income": "Amount you've just received",
      "cs.field.amount.expense": "Expense amount",
      "cs.field.amountHint.income": "Enter the real amount you received. The app will instantly calculate how much of it should go toward your goal.",
      "cs.field.amountHint.expense": "Enter the real amount you spent. The entry will be saved in history and factored into the forecast.",
      // UNIFIED CUSTOM SCHEDULE FLOW - dynamic hint under the amount field,
      // changes with the chosen frequency (weekly / biweekly / monthly / custom).
      "cs.field.amountHint.income.weekly": "Enter the amount. The app will automatically count it every week.",
      "cs.field.amountHint.income.biweekly": "Enter the amount. The app will automatically count it every two weeks.",
      "cs.field.amountHint.income.monthly": "Enter the amount. The app will automatically count it every month.",
      "cs.field.amountHint.income.custom": "Enter the real amount you received. The app will instantly calculate how much of it should go toward your goal.",
      "cs.field.amountHint.expense.weekly": "Enter the amount. The app will automatically count it every week.",
      "cs.field.amountHint.expense.biweekly": "Enter the amount. The app will automatically count it every two weeks.",
      "cs.field.amountHint.expense.monthly": "Enter the amount. The app will automatically count it every month.",
      "cs.field.amountHint.expense.custom": "Enter the real amount you spent. The entry will be saved in history and factored into the forecast.",
      // UNIFIED CUSTOM SCHEDULE FLOW - frequency-aware modal titles
      "cs.modal.title.income.weekly": "Weekly income",
      "cs.modal.title.income.biweekly": "Bi-weekly income",
      "cs.modal.title.income.monthly": "Monthly income",
      "cs.modal.title.income.custom": "Record income",
      "cs.modal.title.expense.weekly": "Weekly expense",
      "cs.modal.title.expense.biweekly": "Bi-weekly expense",
      "cs.modal.title.expense.monthly": "Monthly expense",
      "cs.modal.title.expense.custom": "Record expense",
      // UNIFIED CUSTOM SCHEDULE FLOW - badge «next: ...»
      "cs.modal.nextOccurrence.weekly": "Repeats every week",
      "cs.modal.nextOccurrence.biweekly": "Repeats every two weeks",
      "cs.modal.nextOccurrence.monthly": "Repeats every month",
      "cs.modal.nextOccurrence.custom": "Manual entries only",
      // UNIFIED CUSTOM SCHEDULE FLOW - live-preview labels
      "cs.preview.willDeposit": "Set aside for your goal",
      "cs.preview.modeHint": "Based on «{mode}» mode",
      "cs.preview.alreadyEnough": "Goal target for this period is already covered",
      "cs.preview.expenseNote": "Expenses don't go to the goal - only factored into the forecast",
      "cs.field.date": "Date",
      "cs.modal.continue": "Continue",
      "cs.modal.save": "Save",
      "cs.modal.cancel": "Cancel",
      "cs.modal.back": "Back",
      "cs.mode.calm": "Mode: relaxed",
      "cs.mode.normal": "Mode: moderate",
      "cs.mode.aggressive": "Mode: aggressive",
      "cs.alloc.title": "Allocation plan",
      "cs.alloc.needTitle": "You should save",
      "cs.alloc.fromAmount": "of",
      "cs.alloc.depositBtn": "Allocate to goal",
      "cs.alloc.skipBtn": "Just record, don't allocate",
      "cs.alloc.modeLabel": "Calculated from your current saving mode",
      "cs.toast.added.income": "Income recorded",
      "cs.toast.added.expense": "Expense recorded",
      "cs.toast.deposited": "Allocated to goal: {amount}",
      "cs.toast.deleted": "Entry deleted",
      "cs.toast.updated": "Entry updated",
      "cs.toast.invalidAmount": "Enter a valid amount",
      "cs.toast.noGoal": "Create a goal first - there's nothing to save toward yet",
      "cs.toast.noChange.income": "Income hasn't changed. Use this only if the amount or frequency changed. To log actual income, use the buttons on the chart.",
      "cs.toast.noChange.expense": "Expense hasn't changed. Use this only if the amount or frequency changed. To log actual expenses, use the buttons on the chart.",
      "cs.toast.planUpdated.income": "Done - the plan was recalculated for the new income",
      "cs.toast.planUpdated.expense": "Done - the plan was recalculated for the new expense",
      "cs.modal.configTitle.income": "Set up income",
      "cs.modal.configTitle.expense": "Set up expense",
      "cs.modal.configBtn": "Save & recalculate",
      "cs.modal.configHint.income": "Enter the expected income per period. This configures the plan - no money is set aside. Log actual income with the buttons on the chart.",
      "cs.modal.configHint.expense": "Enter the expected expense per period. This configures the plan - log actual expenses with the buttons on the chart.",
      "cs.reminder.expenses.title": "Don't forget your expenses",
      "cs.reminder.expenses.subtitle": "Record this period's expenses if there were any - the forecast will be more accurate.",
      "cs.reminder.expenses.cta": "Record expense",
      "cs.reminder.expenses.dismiss": "Later",
      // CUSTOM SCHEDULE v2 - fix main plan display - mirrored prompt for income.
      "cs.reminder.income.title": "Record this period's income",
      "cs.reminder.income.subtitle": "If you had any income this period - record it so the allocation plan is more accurate.",
      "cs.reminder.income.cta": "Record income",
      "cs.reminder.income.dismiss": "Later",
      // CUSTOM SCHEDULE v2 - fix main plan display - custom-mode plan header.
      "cs.plan.title": "You should save",
      "cs.plan.fromLast": "of the last amount ({amount})",
      "cs.plan.fromLast.income": "of the last income ({amount})",
      "cs.plan.fromLast.expense": "of the last expense ({amount})",
      "cs.plan.deposited": "Allocated to goal",
      "cs.plan.depositedFromLast": "Allocated from this amount",
      "cs.plan.term": "Time to goal",
      "cs.plan.termInsufficient": "not enough data yet",
      "cs.plan.termMonths": "≈ {n} mo.",
      "cs.plan.emptyHint": "Make your first \"Custom schedule\" entry to compute an individual plan.",
      "cs.plan.counterpart.income": "incl. fixed income {amount} / mo.",
      "cs.plan.counterpart.expense": "incl. fixed expense {amount} / mo.",
      "cs.plan.counterpart.lastIncome": "incl. last income {amount}",
      "cs.plan.counterpart.lastExpense": "incl. last expense {amount}",
      "cs.plan.noCounterpart.income": "income for the period not set",
      "cs.plan.noCounterpart.expense": "expense for the period not set",
      "cs.alloc.breakdown": "{income} − {expense} = free {free}",
      "cs.alloc.subTitle.income": "from income {amount}",
      "cs.alloc.subTitle.expense": "after expense {amount}",
      // FIX: custom schedule accumulation + counters update - accumulated keys.
      "cs.plan.totalIncome": "Period income",
      "cs.plan.totalExpense": "Period expenses",
      "cs.plan.free": "Free",
      "cs.plan.depositedFromTotal": "Allocated from this amount",
      "cs.plan.counterpart.totalIncome": "incl. manual income {amount}",
      "cs.plan.counterpart.totalExpense": "incl. manual expense {amount}",
      "cs.alloc.fromTotal.income": "of accumulated income <b>{total}</b> (just added {added})",
      "cs.alloc.fromTotal.expense": "accumulated expense <b>{total}</b> (just added {added})",
      "cs.alloc.alreadyDeposited": "Already allocated",
      "cs.toast.alreadyDeposited": "All entries are already allocated",
      "cs.summary.last.income": "Last income",
      "cs.summary.last.expense": "Last expense",
      // FIX: custom schedule accumulation + counters update - accumulated totals.
      "cs.summary.total.income": "Period income",
      "cs.summary.total.expense": "Period expenses",
      "cs.summary.deposited": "Allocated",
      "cs.summary.notDeposited": "Not allocated",
      "cs.summary.empty.income": "No manual income entries yet",
      "cs.summary.empty.expense": "No manual expense entries yet",
      "cs.summary.eta": "Approx. time to goal",
      "cs.summary.eta.months": "≈ {n} mo.",
      "cs.summary.eta.insufficient": "Not enough data yet",
      "cs.history.title.income": "Income history",
      "cs.history.title.expense": "Expense history",
      "cs.history.empty": "No entries yet",
      "cs.history.deposited.badge": "Allocated {amount}",
      "cs.history.notDeposited.badge": "Not allocated",
      "cs.history.edit": "Edit",
      "cs.history.delete": "Delete",
      "cs.history.deposit": "Allocate",
      "cs.history.confirmDelete": "Delete this entry from history?"
    }
  };

  // ── Public API ──────────────────────────────────────────────

  function getCurrentLanguage() {
    if (typeof getState === "function") {
      var s = getState();
      if (s && s.settings && s.settings.language) return s.settings.language;
    }
    return "ru";
  }

  function t(key, vars) {
    var lang = getCurrentLanguage();
    var dict = I18N[lang] || I18N["ru"];
    var text = dict[key] || (I18N["ru"][key]) || key;
    if (vars && typeof vars === "object") {
      Object.keys(vars).forEach(function (k) {
        text = text.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
      });
    }
    return text;
  }

  function getMonthName(idx) {
    return t("month." + idx);
  }

  function getMonthNameGenitive(idx) {
    return t("monthGen." + idx);
  }

  function getMonthNameShort(idx) {
    var full = getMonthName(idx);
    return full.substring(0, 3);
  }

  function applyLanguageToDOM() {
    var els = document.querySelectorAll("[data-i18n]");
    els.forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var text = t(key);
      if (text && text !== key) {
        el.textContent = text;
      }
    });
    var phEls = document.querySelectorAll("[data-i18n-placeholder]");
    phEls.forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      var text = t(key);
      if (text && text !== key) {
        el.placeholder = text;
      }
    });
    var csEls = document.querySelectorAll(".currency-symbol");
    csEls.forEach(function (el) {
      var sym = "₽";
      if (typeof getCurrencySymbol === "function") sym = getCurrencySymbol();
      el.textContent = sym;
    });
    var htmlEl = document.documentElement;
    if (htmlEl) htmlEl.lang = getCurrentLanguage();
  }

  function fmtNum(n) {
    var num = Math.abs(Number(n)) || 0;
    var nf = "spaces";
    if (typeof getState === "function") {
      var s = getState();
      if (s && s.settings && s.settings.numberFormat) nf = s.settings.numberFormat;
    }
    if (typeof window !== "undefined" && window._protocolNumberFormat) nf = window._protocolNumberFormat;
    var sep = (nf === "dots") ? "." : "\u00A0";
    var str = Math.round(num).toString();
    return str.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }

  function fmtAmount(n) {
    var num = Number(n) || 0;
    var sym = "₽";
    if (typeof getCurrencySymbol === "function") {
      sym = getCurrencySymbol();
    } else if (typeof getBaseCurrency === "function") {
      var c = getBaseCurrency();
      if (c === "USD") sym = "$";
      else if (c === "EUR") sym = "€";
    }
    if (typeof getDisplayAmount === "function") {
      num = getDisplayAmount(num);
    }
    return (num < 0 ? "−" : "") + fmtNum(num) + " " + sym;
  }

  // ── Expose Globally ──

  global.I18N = I18N;
  global.t = t;
  global.getCurrentLanguage = getCurrentLanguage;
  global.applyLanguageToDOM = applyLanguageToDOM;
  global.getMonthName = getMonthName;
  global.getMonthNameGenitive = getMonthNameGenitive;
  global.getMonthNameShort = getMonthNameShort;
  global.fmtNum = fmtNum;
  global.fmtAmount = fmtAmount;

})(typeof window !== "undefined" ? window : this);
