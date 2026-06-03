// TELEGRAM STARS — Edge Function: webhook оплаты Premium-подписки.
//
// Обрабатывает ДВА типа платежей:
//   1. ПЕРВИЧНАЯ оплата (one-time или первый платёж subscription)
//   2. ПОВТОРНАЯ оплата (recurring) — Telegram сам списывает 150⭐ каждые
//      30 дней для подписочных invoice'ов, шлёт нам очередной
//      successful_payment с тем же invoice_payload и новым
//      telegram_payment_charge_id.
//
// Renewal detection (приоритет от самого надёжного к менее):
//   (a) successful_payment.subscription_expiration_date — Telegram прямо
//       сообщает дату следующего списания. Если поле есть → это subscription.
//   (b) successful_payment.is_recurring (BotAPI 8.x) — true для повторных.
//   (c) Сравнение с БД: у юзера есть активная premium_until > now() и
//       auto_renew=true → это renewal.
//   (d) Fallback: считаем первичной оплатой.
//
// Логика премиум-периода:
//   • Первичная оплата: premium_until = now + 30d.
//   • Renewal: premium_until = max(now, current_premium_until) + 30d
//     (защищает от потери дней, если webhook пришёл с задержкой).
//   • Если Telegram прислал subscription_expiration_date → используем его
//     (Telegram = canonical truth).
//
// DM-сообщения:
//   • Первичная (auto_renew=true): welcome + точные даты + «автопродление включено».
//   • Первичная (auto_renew=false): welcome + точные даты + «одноразовая оплата».
//   • Renewal: короткое «Подписка успешно продлена до …» без длинного welcome.
//
// DEPLOY:
//   supabase secrets set TELEGRAM_BOT_TOKEN=xxx:yyy
//   supabase secrets set TELEGRAM_WEBHOOK_SECRET=<random_32>
//   supabase secrets set MINI_APP_URL=https://your-domain.com/
//   supabase functions deploy stars-payment-webhook --no-verify-jwt
//   curl -F "url=https://<project>.supabase.co/functions/v1/stars-payment-webhook" \
//        -F "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
//        -F "allowed_updates=[\"pre_checkout_query\",\"message\"]" \
//        https://api.telegram.org/bot<TOKEN>/setWebhook

// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN       = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const WEBHOOK_SECRET  = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MINI_APP_URL    = Deno.env.get("MINI_APP_URL") || "";

const supabase = SUPABASE_URL && SERVICE_ROLE
  ? createClient(SUPABASE_URL, SERVICE_ROLE)
  : null;

const PREMIUM_DAYS = 30;
const PREMIUM_MS = PREMIUM_DAYS * 24 * 60 * 60 * 1000;
// Должно совпадать с create-stars-invoice STARS_PRICE.
const STARS_PRICE = 300;

// COMMUNITY STATS — логирование каждого успешного платежа в stars_payments.
// Идемпотентность гарантируется UNIQUE индексом по telegram_charge_id;
// если тот же платёж придёт повторно, INSERT упадёт с conflict — мы это
// тихо проглатываем (платёж УЖЕ записан, всё ок).
async function logStarsPayment(args: {
  telegramId: number;
  amount: number;
  isRecurring: boolean;
  telegramChargeId: string | null;
  invoicePayload: string;
}): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from("stars_payments").insert({
      telegram_id: args.telegramId,
      amount: args.amount,
      is_recurring: args.isRecurring,
      telegram_charge_id: args.telegramChargeId,
      invoice_payload: args.invoicePayload,
    });
    if (error) {
      // 23505 = unique_violation. Это означает «уже логировали этот платёж» —
      // штатная ситуация при retry от Telegram, не считаем за ошибку.
      if ((error as { code?: string }).code === "23505") {
        console.log(`[stars-webhook] payment already logged (idempotent), charge_id=${args.telegramChargeId}`);
        return;
      }
      console.warn("[stars-webhook] logStarsPayment failed:", error);
    } else {
      console.log(`[stars-webhook] payment logged: tg=${args.telegramId}, amount=${args.amount}, recurring=${args.isRecurring}`);
    }
  } catch (e) {
    console.warn("[stars-webhook] logStarsPayment exception:", e);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function answerPreCheckoutQuery(
  queryId: string,
  ok: boolean,
  errMsg?: string,
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pre_checkout_query_id: queryId, ok,
        ...(errMsg ? { error_message: errMsg } : {}),
      }),
    });
  } catch (e) { console.error("[stars-webhook] answerPreCheckoutQuery failed:", e); }
}

async function sendDM(
  chatId: number,
  text: string,
  inlineKeyboard?: unknown,
): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId, text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(inlineKeyboard ? { reply_markup: inlineKeyboard } : {}),
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn("[stars-webhook] sendDM failed:", res.status, errText);
    }
  } catch (e) { console.warn("[stars-webhook] sendDM exception:", e); }
}

function pickLang(code: string | undefined): "ru" | "en" {
  if (!code) return "en";
  const c = code.toLowerCase();
  if (c === "ru" || c.startsWith("ru-")) return "ru";
  return "en";
}

function formatDate(d: Date, lang: "ru" | "en"): string {
  const day = d.getDate();
  const m = d.getMonth();
  const monthsRu = [
    "января","февраля","марта","апреля","мая","июня",
    "июля","августа","сентября","октября","ноября","декабря",
  ];
  const monthsEn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (lang === "ru") return `${day} ${monthsRu[m]}`;
  return `${monthsEn[m]} ${day}`;
}

// Парсит payload `premium_<tg_id>_<unix_ms>_<autoRenewFlag>`.
// Backward compat: payload без флага (legacy `premium_<tg_id>_<ts>`) → autoRenew=false.
function parsePayload(payload: string): { autoRenew: boolean } {
  if (typeof payload !== "string" || !payload.startsWith("premium_")) {
    return { autoRenew: false };
  }
  const parts = payload.split("_");
  if (parts.length >= 4) {
    return { autoRenew: parts[3] === "1" };
  }
  return { autoRenew: false };
}

// ── ОСНОВНАЯ ЛОГИКА АКТИВАЦИИ / ПРОДЛЕНИЯ ────────────────────────────────────

type ActivationResult = {
  ok: boolean;
  isRenewal: boolean;
  startsAt: Date;
  endsAt: Date;
  effectiveAutoRenew: boolean;
};

async function activateOrExtendSubscription(
  telegramId: number,
  payloadAutoRenew: boolean,
  tgSubscriptionExpiryTs: number | null,
  tgIsRecurring: boolean | null,
): Promise<ActivationResult> {
  const now = new Date();
  const fallbackEnd = new Date(now.getTime() + PREMIUM_MS);

  if (!supabase) {
    return { ok: false, isRenewal: false, startsAt: now, endsAt: fallbackEnd, effectiveAutoRenew: payloadAutoRenew };
  }

  // ── 1. Читаем текущее состояние юзера ───────────────────────────────────
  const { data: currentUser, error: readErr } = await supabase
    .from("users")
    .select("premium_until, auto_renew")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (readErr) {
    console.error("[stars-webhook] read user failed:", readErr);
    return { ok: false, isRenewal: false, startsAt: now, endsAt: fallbackEnd, effectiveAutoRenew: payloadAutoRenew };
  }

  // ── 2. Определяем, это первичная оплата или renewal ─────────────────────
  // Приоритет признаков renewal (от самого надёжного к менее):
  //   (a) tgIsRecurring=true → точно renewal (Telegram нам сказал).
  //   (b) Юзер УЖЕ имеет активную подписку (premium_until > now) и
  //       auto_renew=true → это плановое списание Telegram.
  //   (c) Иначе → первичная оплата.
  const currentEnd = currentUser?.premium_until
    ? new Date(currentUser.premium_until)
    : null;
  const hasActiveSub = currentEnd !== null && currentEnd.getTime() > now.getTime();
  const wasAutoRenew = currentUser?.auto_renew === true;

  let isRenewal = false;
  if (tgIsRecurring === true) {
    isRenewal = true;
  } else if (hasActiveSub && wasAutoRenew) {
    isRenewal = true;
  }

  // ── 3. Рассчитываем новую premium_until ─────────────────────────────────
  // Если Telegram прислал subscription_expiration_date → используем его
  // (это authoritative truth). Иначе — наш расчёт.
  let endsAt: Date;
  if (tgSubscriptionExpiryTs && tgSubscriptionExpiryTs > 0) {
    endsAt = new Date(tgSubscriptionExpiryTs * 1000);
  } else if (isRenewal && currentEnd && currentEnd.getTime() > now.getTime()) {
    // Защита от потери дней: продлеваем от текущего endDate, а не от now.
    // Применяется, если webhook пришёл с задержкой (Telegram списал, но
    // у юзера ещё были оставшиеся дни).
    endsAt = new Date(currentEnd.getTime() + PREMIUM_MS);
  } else {
    endsAt = new Date(now.getTime() + PREMIUM_MS);
  }

  // ── 4. Эффективный auto_renew ───────────────────────────────────────────
  // Если Telegram прислал subscription_expiration_date — это точно
  // subscription invoice, значит auto_renew=true (даже если в payload "0",
  // что маловероятно). Иначе — берём из payload.
  const effectiveAutoRenew = (tgSubscriptionExpiryTs && tgSubscriptionExpiryTs > 0)
    ? true
    : payloadAutoRenew;

  // ── 5. Записываем в БД ───────────────────────────────────────────────────
  const { error: updErr } = await supabase
    .from("users")
    .update({
      is_premium: true,
      premium_until: endsAt.toISOString(),
      auto_renew: effectiveAutoRenew,
      // СБРАСЫВАЕМ оба notification-флага — после нового платежа
      // reminder за 3 дня + expired-notice должны иметь возможность
      // отправиться заново под новый подписочный период.
      renewal_reminder_at: null,
      premium_expired_notice_at: null,
    })
    .eq("telegram_id", telegramId);

  if (updErr) {
    console.error("[stars-webhook] update user failed:", updErr);
    return { ok: false, isRenewal, startsAt: now, endsAt, effectiveAutoRenew };
  }

  console.log(
    `[stars-webhook] ${isRenewal ? "RENEWAL" : "ACTIVATION"} for tg=${telegramId}, ` +
    `until=${endsAt.toISOString()}, auto_renew=${effectiveAutoRenew}`,
  );
  return { ok: true, isRenewal, startsAt: now, endsAt, effectiveAutoRenew };
}

// ── ЭМОЦИОНАЛЬНЫЕ ТЕКСТЫ ─────────────────────────────────────────────────────

// Первичная активация. Текст слегка отличается в зависимости от того,
// одноразовая это оплата или subscription с автопродлением.
function buildActivationText(
  lang: "ru" | "en",
  startsAt: Date,
  endsAt: Date,
  isSubscription: boolean,
): string {
  const startsStr = formatDate(startsAt, lang);
  const endsStr   = formatDate(endsAt,   lang);
  if (lang === "ru") {
    const subscriptionLine = isSubscription
      ? `🔄 <b>Автопродление включено</b> — следующее списание ${endsStr}. Отменить можно в любой момент в настройках Telegram.`
      : `ℹ️ Это разовая оплата без автопродления. Когда подписка закончится — мы напомним.`;
    return [
      `🎉 <b>Добро пожаловать в Premium!</b>`,
      ``,
      `Спасибо, что доверился Protocol Finance — для нас это правда много значит.`,
      ``,
      `📅 Подписка активна <b>с ${startsStr} по ${endsStr}</b>.`,
      subscriptionLine,
      ``,
      `Теперь тебе доступно всё:`,
      `   ✨ Изменение темпа накоплений`,
      `   💳 Кредиты и долги в едином плане`,
      `   🎚 Гибкая финансовая модель`,
      `   ⚙️ Расширенные настройки портфеля`,
      `   📊 Полная статистика счёта`,
      ``,
      `Готов открыть полный потенциал? 👇`,
    ].join("\n");
  }
  const subscriptionLineEn = isSubscription
    ? `🔄 <b>Auto-renewal is ON</b> — next charge on ${endsStr}. You can cancel anytime in Telegram settings.`
    : `ℹ️ This is a one-time purchase without auto-renewal. We'll remind you when the subscription ends.`;
  return [
    `🎉 <b>Welcome to Premium!</b>`,
    ``,
    `Thank you for trusting Protocol Finance — it really means a lot.`,
    ``,
    `📅 Your subscription is active <b>from ${startsStr} to ${endsStr}</b>.`,
    subscriptionLineEn,
    ``,
    `Everything is now unlocked:`,
    `   ✨ Saving pace control`,
    `   💳 Loans and debts in one plan`,
    `   🎚 Flexible financial model`,
    `   ⚙️ Advanced portfolio settings`,
    `   📊 Full account statistics`,
    ``,
    `Ready to unlock the full potential? 👇`,
  ].join("\n");
}

// Renewal — короткое и тёплое сообщение, без длинного welcome-блока.
function buildRenewalText(lang: "ru" | "en", endsAt: Date): string {
  const endsStr = formatDate(endsAt, lang);
  if (lang === "ru") {
    return [
      `🔄 <b>Подписка успешно продлена</b>`,
      ``,
      `Спасибо, что остаёшься с Protocol Finance — это правда важно для нас.`,
      ``,
      `📅 Premium активен <b>до ${endsStr}</b>.`,
      ``,
      `Никаких действий с твоей стороны не нужно — продолжаем работать как обычно. 💚`,
    ].join("\n");
  }
  return [
    `🔄 <b>Subscription successfully renewed</b>`,
    ``,
    `Thank you for staying with Protocol Finance — it truly matters to us.`,
    ``,
    `📅 Premium is active <b>until ${endsStr}</b>.`,
    ``,
    `No action needed on your side — we continue as usual. 💚`,
  ].join("\n");
}

function buildActivationKeyboard(lang: "ru" | "en") {
  if (!MINI_APP_URL) return undefined;
  const text = lang === "ru" ? "🚀 Скорее изучить Premium" : "🚀 Explore Premium now";
  return {
    inline_keyboard: [[{ text, web_app: { url: MINI_APP_URL } }]],
  };
}

function buildRenewalKeyboard(lang: "ru" | "en") {
  if (!MINI_APP_URL) return undefined;
  const text = lang === "ru" ? "📊 Открыть приложение" : "📊 Open the app";
  return {
    inline_keyboard: [[{ text, web_app: { url: MINI_APP_URL } }]],
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  if (!WEBHOOK_SECRET) {
    console.error("[stars-webhook] TELEGRAM_WEBHOOK_SECRET not configured");
    return new Response("webhook_secret_not_configured", { status: 500 });
  }
  const got = req.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  if (got !== WEBHOOK_SECRET) {
    console.warn("[stars-webhook] secret_token mismatch");
    return new Response("forbidden", { status: 403 });
  }

  let update: any;
  try { update = await req.json(); }
  catch { return new Response("invalid_json", { status: 400 }); }

  try {
    // ── pre_checkout_query ─────────────────────────────────────────────
    if (update.pre_checkout_query) {
      const q = update.pre_checkout_query;
      const isStars = q?.currency === "XTR";
      const payload: string = q?.invoice_payload || "";
      const validPayload = payload.startsWith("premium_");
      const totalAmount = (typeof q?.total_amount === "number") ? q.total_amount : 0;
      const validAmount = totalAmount >= STARS_PRICE;
      if (isStars && validPayload && validAmount) {
        await answerPreCheckoutQuery(q.id, true);
      } else {
        await answerPreCheckoutQuery(q.id, false, "Invalid invoice");
      }
      return new Response("OK");
    }

    // ── successful_payment ─────────────────────────────────────────────
    const sp = update.message?.successful_payment;
    if (sp) {
      if (sp.currency !== "XTR") return new Response("OK");

      const from = update.message?.from || {};
      const fromId = Number(from.id);
      if (!fromId) return new Response("OK");

      const payload: string = sp.invoice_payload || "";
      const expectedPrefix = `premium_${fromId}_`;
      if (!payload.startsWith(expectedPrefix)) {
        console.warn("[stars-webhook] payload prefix mismatch:", payload);
        return new Response("OK");
      }

      const paymentAmount = (typeof sp.total_amount === "number") ? sp.total_amount : 0;
      if (paymentAmount < STARS_PRICE) {
        console.warn(
          `[stars-webhook] underpayment tg=${fromId}, amount=${paymentAmount}, expected>=${STARS_PRICE}`,
        );
        return new Response("OK");
      }

      const chargeId = (typeof sp.telegram_payment_charge_id === "string")
        ? sp.telegram_payment_charge_id
        : null;
      if (chargeId && supabase) {
        const { data: existingPay } = await supabase
          .from("stars_payments")
          .select("id")
          .eq("telegram_charge_id", chargeId)
          .maybeSingle();
        if (existingPay) {
          console.log(`[stars-webhook] duplicate charge_id=${chargeId}, skip activation`);
          return new Response("OK");
        }
      }

      // SUBSCRIPTION MODEL — извлекаем флаг auto_renew и subscription_expiration_date.
      const { autoRenew: payloadAutoRenew } = parsePayload(payload);
      const tgSubExpiry = (typeof sp.subscription_expiration_date === "number")
        ? sp.subscription_expiration_date
        : null;
      // Bot API 8.x присылает is_recurring=true для повторных списаний.
      // Старые версии могут не присылать вообще — fallback на DB-сравнение.
      const tgIsRecurring = (typeof sp.is_recurring === "boolean") ? sp.is_recurring : null;

      console.log(
        `[stars-webhook] successful_payment for tg=${fromId}, ` +
        `payload_auto_renew=${payloadAutoRenew}, ` +
        `tg_sub_expiry=${tgSubExpiry}, ` +
        `tg_is_recurring=${tgIsRecurring}`,
      );

      const result = await activateOrExtendSubscription(
        fromId,
        payloadAutoRenew,
        tgSubExpiry,
        tgIsRecurring,
      );
      if (!result.ok) return new Response("db_error", { status: 500 });

      // COMMUNITY STATS — логируем платёж в stars_payments для аналитики
      // (заработано Stars / количество покупок / новые покупки за месяц).
      // Идемпотентно: на duplicate charge_id INSERT молча игнорируется.
      // Поле amount берём из самой записи Telegram (sp.total_amount),
      // а не из захардкоженного STARS_PRICE — чтобы статистика выдержала
      // будущие изменения цены.
      // fire-and-forget: не блокируем ответ Telegram'у — он ждёт быстрый OK.
      // Логирование в фоне; если упадёт — увидим только в логах функции.
      logStarsPayment({
        telegramId: fromId,
        amount: paymentAmount,
        isRecurring: result.isRenewal,
        telegramChargeId: chargeId,
        invoicePayload: payload,
      }).catch(() => { /* graceful */ });

      // ── DM ──────────────────────────────────────────────────────────
      const lang = pickLang(from.language_code);
      if (result.isRenewal) {
        await sendDM(
          fromId,
          buildRenewalText(lang, result.endsAt),
          buildRenewalKeyboard(lang),
        );
      } else {
        await sendDM(
          fromId,
          buildActivationText(lang, result.startsAt, result.endsAt, result.effectiveAutoRenew),
          buildActivationKeyboard(lang),
        );
      }

      return new Response("OK");
    }

    return new Response("OK");
  } catch (e) {
    console.error("[stars-webhook] unhandled error:", e);
    return new Response("error", { status: 500 });
  }
});
