// TELEGRAM STARS — Edge Function: напоминание за 3 дня до окончания Premium.
//
// Триггерится клиентом (см. syncUserAccessFlagsFromDB в app.js), если
// premium_until - now() < 3 дней. Все условия отправки (включая дедуп
// через renewal_reminder_at) проверяются на бэкенде — клиент не может
// заставить функцию слать спам.
//
// Сообщение эмоциональное, на языке пользователя (ru/en) — клиент передаёт
// language в body, бэкенд использует его. Если language не передан —
// fallback на "en".
//
// DEPLOY:
//   supabase functions deploy send-renewal-reminder --no-verify-jwt

// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN     = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MINI_APP_URL  = Deno.env.get("MINI_APP_URL") || "";

const supabase = SUPABASE_URL && SERVICE_ROLE
  ? createClient(SUPABASE_URL, SERVICE_ROLE)
  : null;

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

// ── HMAC-SHA256 верификация init_data ─────────────────────────────────────────
async function verifyInitData(initData: string): Promise<{ ok: boolean; userId?: number }> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { ok: false };
    params.delete("hash");
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`).join("\n");
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
      .map((b) => b.toString(16).padStart(2, "0")).join("");
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

function pickLang(code: unknown): "ru" | "en" {
  if (typeof code !== "string") return "en";
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

function dayWord(n: number, lang: "ru" | "en"): string {
  if (lang === "en") return n === 1 ? "day" : "days";
  // ru: 1 день, 2-4 дня, 5+ дней
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

// ── ЭМОЦИОНАЛЬНЫЙ ТЕКСТ ──────────────────────────────────────────────────────

function buildReminderText(lang: "ru" | "en", endsAt: Date, daysLeft: number): string {
  const endsStr = formatDate(endsAt, lang);
  const dw = dayWord(daysLeft, lang);
  if (lang === "ru") {
    return [
      `💛 <b>Через ${daysLeft} ${dw} твой Premium закончится</b>`,
      ``,
      `<b>${endsStr}</b> подписка истекает. И без неё:`,
      `   • Темп накоплений вернётся к стандартному`,
      `   • Долги и кредиты исчезнут из расчёта`,
      `   • Гибкая модель перестанет адаптироваться`,
      `   • Расширенные настройки портфеля заблокируются`,
      ``,
      `Не теряй то, что уже стало частью твоего плана. Продли подписку всего за 300 ⭐ - и продолжай уверенно идти к цели.`,
    ].join("\n");
  }
  return [
    `💛 <b>Your Premium ends in ${daysLeft} ${dw}</b>`,
    ``,
    `On <b>${endsStr}</b> your subscription expires. Without it:`,
    `   • Saving pace will reset to default`,
    `   • Loans and debts will leave your calculation`,
    `   • Flexible model will stop adapting to you`,
    `   • Advanced portfolio settings will be locked`,
    ``,
    `Don't lose what's already part of your plan. Renew for just 300 ⭐ - and keep moving toward your goal with confidence.`,
  ].join("\n");
}

function buildReminderKeyboard(lang: "ru" | "en") {
  if (!MINI_APP_URL) return undefined;
  const text = lang === "ru" ? "💜 Вернуть Premium" : "💜 Get Premium back";
  // Открываем mini app с параметром ?premium=open → app.js поймает его
  // и сразу откроет премиум-модалку.
  const url = MINI_APP_URL + (MINI_APP_URL.includes("?") ? "&" : "?") + "premium=open";
  return {
    inline_keyboard: [[{ text, web_app: { url } }]],
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!BOT_TOKEN || !supabase) return json({ error: "not_configured" }, 500);

  let body: any;
  try { body = await req.json(); }
  catch { return json({ error: "invalid_json" }, 400); }

  const tgId = Number(body?.telegram_id);
  if (!tgId) return json({ error: "telegram_id_required" }, 400);

  // init_data — обязательно для anti-spoofing.
  if (typeof body?.init_data !== "string" || !body.init_data) {
    return json({ error: "init_data_required" }, 401);
  }
  const v = await verifyInitData(body.init_data);
  if (!v.ok) return json({ error: "init_data_invalid" }, 401);
  if (v.userId && v.userId !== tgId) {
    return json({ error: "telegram_id_mismatch" }, 401);
  }

  // Перечитываем users со своей стороны — клиенту не доверяем.
  const { data: user, error } = await supabase
    .from("users")
    .select("telegram_id, is_premium, premium_until, renewal_reminder_at")
    .eq("telegram_id", tgId)
    .maybeSingle();

  if (error) return json({ error: "db_error" }, 500);
  if (!user) return json({ error: "user_not_found" }, 404);
  if (!user.is_premium || !user.premium_until) {
    return json({ skip: "not_active_subscription" });
  }

  const now = Date.now();
  const endsAt = new Date(user.premium_until).getTime();
  const msToExpiry = endsAt - now;
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  if (msToExpiry <= 0 || msToExpiry > THREE_DAYS) {
    return json({ skip: "out_of_window", msToExpiry });
  }

  // Дедуп: уже отправляли в последние 7 дней — не дублируем.
  if (user.renewal_reminder_at) {
    const lastTs = new Date(user.renewal_reminder_at).getTime();
    if (now - lastTs < SEVEN_DAYS) {
      return json({ skip: "already_sent", renewal_reminder_at: user.renewal_reminder_at });
    }
  }

  // Язык: либо передан клиентом, либо fallback "en".
  const lang = pickLang(body?.language);

  const daysLeft = Math.ceil(msToExpiry / (24 * 60 * 60 * 1000));
  const text = buildReminderText(lang, new Date(user.premium_until), daysLeft);
  const reply_markup = buildReminderKeyboard(lang);

  const sendRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: tgId, text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(reply_markup ? { reply_markup } : {}),
    }),
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    console.warn("[renewal-reminder] sendMessage failed:", sendRes.status, errText);
    return json({ error: "send_failed", details: errText }, 502);
  }

  await supabase
    .from("users")
    .update({ renewal_reminder_at: new Date(now).toISOString() })
    .eq("telegram_id", tgId);

  return json({ sent: true, ends_at: user.premium_until, days_left: daysLeft });
});
