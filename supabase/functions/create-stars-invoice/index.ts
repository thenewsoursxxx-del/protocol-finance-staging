// TELEGRAM STARS — Edge Function: создание invoice link для Premium-подписки.
//
// SUBSCRIPTION MODEL (с настоящим recurring billing):
//   • Цена 150 ⭐ за 30 дней.
//   • Пользователь выбирает: одноразовая оплата или автопродление каждые 30 дней.
//   • Если auto_renew=true → invoice становится subscription-invoice'ом:
//     добавляем поле subscription_period=2592000 (30 дней в секундах,
//     это ЕДИНСТВЕННОЕ допустимое значение в Bot API на текущий момент).
//     Telegram сам списывает 150⭐ каждые 30 дней и шлёт нам очередной
//     successful_payment update; пользователь может отменить подписку в
//     Telegram Settings → Subscriptions.
//   • Если auto_renew=false → обычный одноразовый invoice. После 30 дней
//     подписка истекает, пользователю отправляется expired-notice DM.
//
// FLOW:
//   1. Клиент шлёт POST { telegram_id, init_data, auto_renew }.
//   2. Функция верифицирует init_data (HMAC-SHA256 от BOT_TOKEN).
//   3. Дёргает Bot API createInvoiceLink (currency=XTR, amount=150,
//      и subscription_period=2592000 если auto_renew=true).
//   4. Возвращает { invoice_url, payload, amount, is_subscription }.
//      payload: `premium_<telegram_id>_<unix_ms>_<autoRenewFlag>` —
//      webhook парсит его, чтобы знать, какое значение записать в
//      users.auto_renew после successful_payment.
//
// DEPLOY:
//   supabase secrets set TELEGRAM_BOT_TOKEN=xxx:yyy
//   supabase functions deploy create-stars-invoice --no-verify-jwt

// deno-lint-ignore-file no-explicit-any

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";

// Цена: 300 ⭐ за Premium на 30 дней.
const STARS_PRICE = 300;
// 30 дней в секундах. ЕДИНСТВЕННОЕ значение, которое Telegram Stars
// принимает для subscription_period в createInvoiceLink на 2026 год.
const SUBSCRIPTION_PERIOD_SEC = 2592000;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// HMAC-SHA256 верификация Telegram WebApp initData.
async function verifyInitData(initData: string): Promise<{ ok: boolean; userId?: number }> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { ok: false };
    params.delete("hash");
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const enc = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      "raw", enc.encode("WebAppData"),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const secret = await crypto.subtle.sign("HMAC", secretKey, enc.encode(BOT_TOKEN));
    const calcKey = await crypto.subtle.importKey(
      "raw", secret,
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", calcKey, enc.encode(dataCheckString));
    const sigHex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (sigHex !== hash) return { ok: false };
    const userRaw = params.get("user");
    let userId: number | undefined;
    if (userRaw) {
      try {
        const u = JSON.parse(userRaw);
        if (u && typeof u.id === "number") userId = u.id;
      } catch { /* ignore */ }
    }
    return { ok: true, userId };
  } catch { return { ok: false }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!BOT_TOKEN) return json({ error: "bot_token_not_configured" }, 500);

  let body: any;
  try { body = await req.json(); }
  catch { return json({ error: "invalid_json" }, 400); }

  const tgId = Number(body?.telegram_id);
  if (!tgId) return json({ error: "telegram_id_required" }, 400);

  // SUBSCRIPTION MODEL: клиент явно говорит, какой invoice ему нужен.
  // Дефолт false — одноразовая оплата (на случай, если по какой-то причине
  // поле не пришло, лучше НЕ списывать с пользователя автоматически).
  const autoRenew: boolean = body?.auto_renew === true;

  if (typeof body?.init_data !== "string" || body.init_data.length === 0) {
    return json({ error: "init_data_required" }, 401);
  }
  const v = await verifyInitData(body.init_data);
  if (!v.ok) return json({ error: "init_data_invalid" }, 401);
  if (!v.userId) return json({ error: "init_data_user_missing" }, 401);
  if (v.userId !== tgId) {
    return json({ error: "telegram_id_mismatch" }, 401);
  }

  // Payload содержит auto_renew flag — webhook будет писать его в users.auto_renew.
  // Формат: premium_<telegram_id>_<unix_ms>_<autoRenewFlag>
  //   где autoRenewFlag = "1" (subscription) или "0" (one-time).
  // Backward compat: webhook парсит и payload без флага (legacy "0").
  const payload = `premium_${tgId}_${Date.now()}_${autoRenew ? "1" : "0"}`;

  // Сборка тела invoice. Описание отличается для подписки vs одноразовой оплаты,
  // чтобы пользователь чётко видел, на что соглашается в Telegram UI.
  const invoiceBody: Record<string, unknown> = {
    title: "Protocol Premium",
    description: autoRenew
      ? `Полный доступ ко всем функциям. Подписка с автопродлением — ${STARS_PRICE} ⭐ каждые 30 дней. Отмена в любой момент в настройках Telegram.`
      : "Полный доступ ко всем функциям приложения на 30 дней (одноразовая оплата).",
    payload,
    currency: "XTR",
    prices: [{ label: "Premium на 30 дней", amount: STARS_PRICE }],
  };

  // RECURRING BILLING — ключевое поле для subscription-invoice'а.
  // Telegram автоматически списывает STARS_PRICE ⭐ каждые 2592000 секунд (30 дней)
  // и отправляет нам очередной successful_payment update.
  if (autoRenew) {
    invoiceBody.subscription_period = SUBSCRIPTION_PERIOD_SEC;
  }

  const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoiceBody),
  });

  const tgJson = await tgRes.json().catch(() => null);
  if (!tgRes.ok || !tgJson?.ok) {
    console.error("[create-stars-invoice] Telegram API error:", tgJson);
    return json({ error: "telegram_api_error", details: tgJson }, 502);
  }

  console.log(`[create-stars-invoice] created for tg=${tgId}, auto_renew=${autoRenew}`);

  return json({
    invoice_url: tgJson.result,
    payload,
    amount: STARS_PRICE,
    is_subscription: autoRenew,
  });
});
