// === Eruda — консоль для iOS и Android ===
// Грузится ТОЛЬКО для разработки/отладки. Обычные пользователи не видят.
// Условия включения (любое из):
//   1. URL содержит ?debug=1 (можно временно поменять URL в BotFather)
//   2. Telegram-юзер — DEV_TELEGRAM_ID (свой ID разработчика)
//   3. localStorage.eruda === '1' (поставить вручную: localStorage.eruda='1')
(function() {
  var DEV_TELEGRAM_ID = 1365199221;

  var hasDebugParam = false;
  try {
    hasDebugParam = new URLSearchParams(location.search).get('debug') === '1';
  } catch (_e) { /* ignore */ }

  var hasLocalStorageFlag = false;
  try {
    hasLocalStorageFlag = (localStorage.getItem('eruda') === '1');
  } catch (_e) { /* ignore */ }

  var isDevUser = false;
  try {
    var tg  = window.Telegram && window.Telegram.WebApp;
    var uid = tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id;
    isDevUser = (uid === DEV_TELEGRAM_ID);
  } catch (_e) { /* ignore */ }

  if (!hasDebugParam && !hasLocalStorageFlag && !isDevUser) return;

  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  script.onload = function () { eruda.init(); };
  document.head.appendChild(script);
})();

/**
 * Supabase для Protocol Mini App (vanilla JS + CDN, без npm).
 *
 * CDN-скрипт в index.html:
 *   https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
 * Он создаёт глобальный объект window.supabase с методом createClient.
 *
 * ── SECURITY MODE: CLIENT-TRUST (DEVELOPMENT / INTERNAL BETA) ──
 *
 * Current implementation trusts the Telegram user identity provided by
 * window.Telegram.WebApp.initDataUnsafe on the client side.
 * This is acceptable for local testing and internal beta, but NOT
 * suitable for public production because a malicious client can spoof
 * the telegram_id and read/write another user's data.
 *
 * For production, the secure path is:
 *   1. Client sends raw Telegram initData string to a backend
 *      (Supabase Edge Function, Cloudflare Worker, own server, etc.)
 *   2. Backend validates initData with the bot secret (HMAC-SHA-256)
 *      per https://core.telegram.org/bots/webapps#validating-data
 *   3. Backend resolves the verified telegram_id and either:
 *      a) returns a signed JWT / session token to the client, or
 *      b) performs the DB operation itself on behalf of the user
 *   4. Supabase RLS policies restrict rows to the verified identity
 *
 * The single future upgrade point is getVerifiedUserIdentity().
 * When a verification backend is ready, only that function needs
 * to change — all save/load functions already depend on it.
 *
 * ── RLS PREPARATION (NEXT PRODUCTION STEP) ──
 *
 * Tables used: `users`, `user_state`
 * Both are currently accessed with the anon key and NO RLS.
 *
 * Recommended steps before going fully public:
 *   - Enable RLS on `users` and `user_state`
 *   - Create policies that restrict SELECT/INSERT/UPDATE to rows
 *     matching the authenticated user's telegram_id
 *   - Move writes behind a verified server-side identity
 *     (Edge Function that validates initData → performs DB ops)
 *   - Do NOT rely permanently on unrestricted client writes
 */

/* ─────────────────────────────────────────────────────────────────────────
 * ENVIRONMENT AUTO-DETECTION (PROD vs STAGING)
 *
 * Один и тот же код деплоится в ДВА GitHub-репозитория:
 *   • PROD    — https://thenewsoursxxx-del.github.io/protocol-finance/
 *   • STAGING — https://thenewsoursxxx-del.github.io/protocol-finance-staging/
 *
 * Чтобы не подменять ключи вручную при каждом переносе (и не зашить случайно
 * staging-ключ в прод), окружение определяется автоматически по URL страницы.
 * Признак staging: путь/хост содержит "-staging" ИЛИ есть ?env=staging.
 *
 * ⚠️ ЗАПОЛНИ STAGING-КЛЮЧИ после создания проекта "protocol-staging" в Supabase
 * (Settings → API → Project URL и anon/publishable key). До заполнения staging
 * автоматически падает обратно на прод-ключи, чтобы ничего не сломать.
 * ──────────────────────────────────────────────────────────────────────── */
var SUPABASE_ENVS = {
  prod: {
    url: "https://cztfcseyzezincbwotvt.supabase.co",
    anonKey: "sb_publishable_Ava2_GYcJBWjcFIL_VFzWQ_-r1DYIiU"
  },
  staging: {
    url: "https://phtfzkwbxxfrmloiolza.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBodGZ6a3dieHhmcm1sb2lvbHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzkwOTgsImV4cCI6MjA5NjA1NTA5OH0.dgNUgAQGP0Sob-YbZCIyYbNSpDZ5QjEwcVgK53bSXoI"
  }
};

function _detectSupabaseEnv() {
  try {
    var href = (location.href || "").toLowerCase();
    var byUrl = href.indexOf("-staging") !== -1;
    var byParam = false;
    try { byParam = new URLSearchParams(location.search).get("env") === "staging"; } catch (_e) { /* ignore */ }
    if (byUrl || byParam) return "staging";
  } catch (_e) { /* ignore */ }
  return "prod";
}

var SUPABASE_ENV = _detectSupabaseEnv();

// Если staging выбран, но ключи ещё не заполнены — безопасный откат на прод.
if (SUPABASE_ENV === "staging" && !SUPABASE_ENVS.staging.url) {
  console.warn("[Supabase] STAGING выбран по URL, но ключи не заданы — откат на PROD-конфиг.");
  SUPABASE_ENV = "prod";
}

var SUPABASE_URL = SUPABASE_ENVS[SUPABASE_ENV].url;
var SUPABASE_ANON_KEY = SUPABASE_ENVS[SUPABASE_ENV].anonKey;

var supabaseClient = null;

/* ── XHR-обёртка, совместимая с fetch-интерфейсом (для iOS WKWebView) ── */
function _xhrFetch(url, opts) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    var method = (opts && opts.method) ? opts.method.toUpperCase() : "GET";
    xhr.open(method, url, true);

    var h = (opts && opts.headers) || {};
    if (h instanceof Headers) {
      h.forEach(function (v, k) { xhr.setRequestHeader(k, v); });
    } else if (typeof h === "object") {
      Object.keys(h).forEach(function (k) { xhr.setRequestHeader(k, h[k]); });
    }

    xhr.onload = function () {
      var rh = {};
      xhr.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach(function (line) {
        var p = line.split(": ");
        var key = p.shift().toLowerCase();
        rh[key] = p.join(": ");
      });

      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
        headers: {
          get: function (n) { return rh[n.toLowerCase()] || null; },
          forEach: function (cb) { Object.keys(rh).forEach(function (k) { cb(rh[k], k); }); }
        },
        json: function () {
          try { return Promise.resolve(JSON.parse(xhr.responseText)); }
          catch (e) { return Promise.reject(e); }
        },
        text: function () { return Promise.resolve(xhr.responseText); }
      });
    };

    xhr.onerror = function () { reject(new TypeError("XHR network error")); };
    xhr.ontimeout = function () { reject(new TypeError("XHR timeout")); };
    xhr.timeout = 15000;
    xhr.send(opts && opts.body ? opts.body : null);
  });
}

/* ── iOS-safe fetch: native fetch с безопасными опциями → XHR fallback ── */
// Authorization header больше не подменяется здесь — supabase-js v2 ставит
// его сам из нативной сессии (после verifyOtp в ensureAuthenticated).
function _iosSafeFetch(url, opts) {
  if (typeof fetch !== "function") {
    console.log("[Supabase] fetch() не доступен, используем XHR.");
    return _xhrFetch(url, opts);
  }

  var safeOpts = {};
  if (opts) {
    Object.keys(opts).forEach(function (k) { safeOpts[k] = opts[k]; });
  }
  safeOpts.cache = "no-store";
  safeOpts.credentials = "omit";

  return fetch(url, safeOpts).catch(function (err) {
    console.warn("[Supabase] fetch() упал:", err.message, "— fallback → XHR");
    return _xhrFetch(url, opts);
  });
}

function initSupabaseClient() {
  if (supabaseClient) return true;

  var sb = window.supabase;

  if (!sb) {
    console.error("[Supabase] window.supabase не найден — CDN-скрипт не загрузился.");
    return false;
  }

  if (typeof sb.createClient !== "function") {
    console.error("[Supabase] window.supabase.createClient — не функция.",
      "Ключи:", Object.keys(sb).join(", "));
    return false;
  }

  try {
    supabaseClient = sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // autoRefreshToken: true — supabase-js сам обновит access_token
        // через refresh_token до его истечения. С нативной Supabase Auth
        // сессией (verifyOtp magiclink) это работает корректно.
        autoRefreshToken:   true,
        // persistSession: false — не пишем в localStorage. Telegram WebView
        // в редких случаях очищает storage между сессиями, а initData всегда
        // свежий → проще пере-аутентифицироваться при каждом запуске аппы.
        persistSession:     false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          "X-Client-Info": "protocol-mini-app"
        },
        fetch: _iosSafeFetch
      }
    });

    window.supabaseClient = supabaseClient;
    console.log("[Supabase] Клиент создан (iOS-safe). ENV:", SUPABASE_ENV, "URL:", SUPABASE_URL);
    return true;
  } catch (e) {
    console.error("[Supabase] createClient ошибка:", e.message, e);
    return false;
  }
}

/* ============================================================================
 * RLS AUTH — Supabase Auth bootstrap via Telegram initData
 * ----------------------------------------------------------------------------
 * При первом вызове ensureAuthenticated():
 *   1. POST в Edge Function `auth-telegram` с Telegram.WebApp.initData.
 *   2. Функция верифицирует initData по HMAC, через service_role создаёт
 *      (или находит) Supabase Auth юзера с email tg-{tid}@telegram.local
 *      и user_metadata.telegram_id = tid, затем выпускает magic link
 *      через admin.generateLink → отдаёт нам { email, token_hash }.
 *   3. Делаем supabaseClient.auth.verifyOtp({ email, token, type:'magiclink' })
 *      — supabase-js получает НАСТОЯЩУЮ сессию, подписанную текущим
 *      JWT Signing Key проекта (ES256). С этого момента getSession(),
 *      autoRefreshToken и Authorization во всех запросах работают нативно.
 *
 * telegram_id попадает в JWT через Custom Access Token Hook
 * (миграция 20260523_custom_access_token_hook.sql) — он копирует
 * user_metadata.telegram_id в top-level claim, поэтому существующие
 * RLS-политики (jwt->>'telegram_id')::bigint работают без правок.
 *
 * Промис кешируется в _authReadyPromise — гарантирует одну авторизацию
 * в условиях параллельных вызовов.
 *
 * Возвращает boolean. Все DB-функции ниже делают
 *   if (!(await ensureAuthenticated())) return null;
 * — без auth БД-операции пропускаются, без падений.
 * ============================================================================ */

var _authReadyPromise    = null;
var _authIsAuthenticated = false;

async function ensureAuthenticated() {
  if (_authReadyPromise) return _authReadyPromise;
  _authReadyPromise = (async function () {
    try {
      if (!initSupabaseClient()) return false;

      var w = window.Telegram && window.Telegram.WebApp;
      var initData = (w && w.initData) || "";
      if (!initData) {
        console.warn("[Auth] init_data отсутствует — Telegram WebApp недоступен (браузер?). DB-операции будут пропущены.");
        return false;
      }

      // 1. Запрос к auth-telegram → получаем { email, token_hash }
      var url = SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/auth-telegram";
      var res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "apikey":        SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ init_data: initData })
      });

      if (!res.ok) {
        var errText = await res.text().catch(function () { return ""; });
        console.error("[Auth] auth-telegram HTTP " + res.status + ":", errText);
        return false;
      }

      var resp = await res.json();
      if (!resp || !resp.email || (!resp.token && !resp.token_hash)) {
        console.error("[Auth] auth-telegram: ожидался { email, token | token_hash }, получено:", resp);
        return false;
      }

      // 2. verifyOtp — пробуем несколько вариантов, потому что Supabase
      //    в зависимости от настроек проекта (PKCE flow / классический)
      //    ожидает разные комбинации параметров. Перебираем по убыванию
      //    предпочтительности — первый успешный выигрывает.
      var otp = null;
      var attempts = [];
      if (resp.token_hash) {
        attempts.push({ token_hash: resp.token_hash, type: "email"     });
        attempts.push({ token_hash: resp.token_hash, type: "magiclink" });
      }
      if (resp.token) {
        attempts.push({ email: resp.email, token: resp.token, type: "magiclink" });
        attempts.push({ email: resp.email, token: resp.token, type: "email"     });
      }

      var lastErr = null;
      for (var i = 0; i < attempts.length; i++) {
        var result = await supabaseClient.auth.verifyOtp(attempts[i]);
        if (!result.error) {
          otp = result;
          console.log("[Auth] verifyOtp успех попытка " + (i + 1) + ":",
                      JSON.stringify({ hasHash: !!attempts[i].token_hash, type: attempts[i].type }));
          break;
        }
        lastErr = result.error;
        console.warn("[Auth] verifyOtp попытка " + (i + 1) + " (" +
                     (attempts[i].token_hash ? "token_hash" : "token") + ", " +
                     attempts[i].type + "):", result.error.message, result.error.status);
      }

      if (!otp) {
        console.error("[Auth] verifyOtp — все попытки провалились. Последняя ошибка:",
                      lastErr && lastErr.message, lastErr && lastErr.status);
        return false;
      }

      if (otp.error) {
        console.error("[Auth] verifyOtp ошибка:", otp.error.message, otp.error.status);
        return false;
      }

      _authIsAuthenticated = true;
      var sess = otp.data && otp.data.session;
      console.log("[Auth] Supabase-сессия установлена (нативная, ES256), exp=" +
                  (sess && sess.expires_at ? sess.expires_at : "?"));
      return true;
    } catch (e) {
      console.error("[Auth] ensureAuthenticated exception:", e && e.message);
      return false;
    }
  })();
  return _authReadyPromise;
}

/**
 * Возвращает текущий access_token из активной Supabase Auth сессии
 * (для мест, где мы делаем raw fetch/XHR вне supabaseClient, например
 * Storage upload с XHR-прогрессом или Edge Functions). Если сессии нет
 * (auth ещё не прошла или фейлнулась) — возвращает anon-ключ как fallback.
 */
async function _currentAuthToken() {
  try {
    if (supabaseClient && supabaseClient.auth && typeof supabaseClient.auth.getSession === "function") {
      var r = await supabaseClient.auth.getSession();
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (tok) return tok;
    }
  } catch (_e) { /* ignore */ }
  return SUPABASE_ANON_KEY;
}

window.ensureAuthenticated = ensureAuthenticated;

/* ── Centralized Telegram identity extraction ── */

function getTelegramIdentity() {
  if (!window.Telegram || !window.Telegram.WebApp) {
    console.warn("[Identity] Telegram WebApp не доступен.");
    return null;
  }
  var ud = window.Telegram.WebApp.initDataUnsafe;
  if (!ud || !ud.user || ud.user.id == null) {
    console.warn("[Identity] initDataUnsafe.user отсутствует (браузер без Telegram).");
    return null;
  }

  var rawId = ud.user.id;
  var numId = Number(rawId);
  if (!Number.isFinite(numId) || numId <= 0 || Math.floor(numId) !== numId) {
    console.warn("[Identity] telegram_id не является валидным целым числом:", rawId);
    return null;
  }

  return {
    telegram_id: numId,
    username:    ud.user.username   || null,
    first_name:  ud.user.first_name || null,
    last_name:   ud.user.last_name  || null
  };
}

/**
 * Single future upgrade point for verified user identity.
 *
 * Currently returns the client-side Telegram identity directly.
 * When a verification backend is ready (Edge Function / own server),
 * this function should:
 *   1. Send window.Telegram.WebApp.initData to the backend
 *   2. Backend validates HMAC-SHA-256 with bot secret
 *   3. Backend returns verified { telegram_id, ... }
 *   4. This function returns that verified identity
 *
 * All save/load functions depend on this single entry point,
 * so upgrading to server verification requires changing only here.
 */
async function getVerifiedUserIdentity() {
  // TODO: replace with server-side initData verification
  return getTelegramIdentity();
}

/* ── Backward-compatible alias (used by app.js for UI-only access) ── */
function getTelegramUser() {
  var identity = getTelegramIdentity();
  if (!identity) return null;
  return {
    id:         identity.telegram_id,
    username:   identity.username,
    first_name: identity.first_name,
    last_name:  identity.last_name
  };
}

async function saveCurrentUser() {
  console.log("[Supabase] saveCurrentUser() — старт");

  if (!initSupabaseClient()) return;
  // RLS AUTH: без JWT с claim telegram_id INSERT/UPDATE в users отклонится
  // политиками "Users can insert/update own profile". Поэтому сначала
  // выпускаем сессию через Edge Function auth-telegram.
  if (!(await ensureAuthenticated())) {
    console.warn("[Supabase] saveCurrentUser: нет авторизации, пропускаем.");
    return;
  }

  var identity = await getVerifiedUserIdentity();
  if (!identity) return;

  var row = {
    telegram_id: identity.telegram_id,
    username:    identity.username,
    first_name:  identity.first_name,
    last_name:   identity.last_name
  };

  console.log("[Supabase] save row:", JSON.stringify(row));

  var maxRetries = 3;
  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      var existing = await supabaseClient
        .from("users")
        .select("telegram_id")
        .eq("telegram_id", row.telegram_id)
        .maybeSingle();

      if (existing.error) {
        console.error("[Supabase] select users (попытка " + attempt + "):",
          existing.error.message, existing.error.code, existing.error);
        if (attempt < maxRetries) {
          var wSel = attempt * 1500;
          console.log("[Supabase] Повтор через " + wSel + " мс...");
          await new Promise(function(r) { setTimeout(r, wSel); });
          continue;
        }
        return;
      }

      var result;
      if (existing.data) {
        result = await supabaseClient
          .from("users")
          .update({
            username: row.username,
            first_name: row.first_name,
            last_name: row.last_name
          })
          .eq("telegram_id", row.telegram_id);
      } else {
        result = await supabaseClient.from("users").insert(row);
      }

      if (result.error) {
        console.error("[Supabase] insert/update ошибка (попытка " + attempt + "):",
          result.error.message, result.error.code, result.error);
        if (attempt < maxRetries) {
          var wait = attempt * 1500;
          console.log("[Supabase] Повтор через " + wait + " мс...");
          await new Promise(function(r) { setTimeout(r, wait); });
          continue;
        }
        return;
      }

      console.log("[Supabase] Пользователь сохранён: telegram_id=" + row.telegram_id);
      return;

    } catch (e) {
      console.error("[Supabase] fetch exception (попытка " + attempt + "):",
        e.name, e.message);
      if (attempt < maxRetries) {
        var w = attempt * 2000;
        console.log("[Supabase] Повтор через " + w + " мс...");
        await new Promise(function(r) { setTimeout(r, w); });
      }
    }
  }
}

async function getMyData() {
  console.log("[Supabase] getMyData() — старт");

  if (!initSupabaseClient()) return null;
  // RLS AUTH: SELECT в users требует JWT с claim telegram_id (политика
  // "Users can view own profile"). Без сессии вернётся 0 строк.
  if (!(await ensureAuthenticated())) {
    console.warn("[Supabase] getMyData: нет авторизации, возвращаем null.");
    return null;
  }

  var identity = await getVerifiedUserIdentity();
  if (!identity) return null;

  try {
    var result = await supabaseClient
      .from("users")
      .select("*")
      .eq("telegram_id", identity.telegram_id)
      .maybeSingle();

    if (result.error) {
      console.error("[Supabase] getMyData ошибка:", result.error.message, result.error);
      return null;
    }

    console.log("[Supabase] getMyData результат:", JSON.stringify(result.data));
    return result.data;

  } catch (e) {
    console.error("[Supabase] getMyData exception:", e.name, e.message);
    return null;
  }
}

/* ── saveAppState: save full app state to user_state table ── */
async function saveAppState(state) {
  try {
    if (!initSupabaseClient()) {
      console.warn("[Supabase] saveAppState: клиент не инициализирован, пропускаем.");
      return;
    }
    // RLS AUTH: INSERT/UPDATE в user_state требуют JWT с claim telegram_id.
    if (!(await ensureAuthenticated())) {
      console.warn("[Supabase] saveAppState: нет авторизации, пропускаем (cloud sync отключён).");
      return;
    }

    var identity = await getVerifiedUserIdentity();
    if (!identity) {
      console.warn("[Supabase] saveAppState: нет пользователя, пропускаем.");
      return;
    }

    var tid = identity.telegram_id;
    var payload = {
      telegram_id: tid,
      data: state,
      updated_at: new Date().toISOString()
    };

    var existing = await supabaseClient
      .from("user_state")
      .select("telegram_id")
      .eq("telegram_id", tid)
      .maybeSingle();

    if (existing.error) {
      console.error("[Supabase] saveAppState select ошибка:", existing.error.message,
        existing.error.code, existing.error.hint || "");
      return;
    }

    var result;
    if (existing.data) {
      result = await supabaseClient
        .from("user_state")
        .update({ data: state, updated_at: payload.updated_at })
        .eq("telegram_id", tid);
    } else {
      result = await supabaseClient
        .from("user_state")
        .insert(payload);
    }

    if (result.error) {
      console.error("[Supabase] saveAppState insert/update ошибка:", result.error.message,
        result.error.code, result.error.hint || "",
        result.error.details || "");
      return;
    }

    console.log("[Supabase] saveAppState: состояние сохранено для telegram_id=" + tid);

  } catch (e) {
    console.error("[Supabase] saveAppState exception:", e.name, e.message);
  }
}

/* ── loadAppState: load saved app state from user_state table ── */
async function loadAppState() {
  try {
    if (!initSupabaseClient()) {
      console.warn("[Supabase] loadAppState: клиент не инициализирован.");
      return null;
    }
    // RLS AUTH: SELECT из user_state требует JWT — иначе 0 строк.
    if (!(await ensureAuthenticated())) {
      console.warn("[Supabase] loadAppState: нет авторизации, возвращаем null (используем localStorage).");
      return null;
    }

    var identity = await getVerifiedUserIdentity();
    if (!identity) {
      console.warn("[Supabase] loadAppState: нет пользователя.");
      return null;
    }

    var tid = identity.telegram_id;
    var result = await supabaseClient
      .from("user_state")
      .select("data, updated_at")
      .eq("telegram_id", tid)
      .maybeSingle();

    if (result.error) {
      console.error("[Supabase] loadAppState ошибка:", result.error.message,
        result.error.code, result.error.hint || "");
      return null;
    }

    if (result.data && result.data.data) {
      console.log("[Supabase] loadAppState: состояние загружено для telegram_id=" + tid);
      return {
        data: result.data.data,
        updated_at: result.data.updated_at || null
      };
    }

    console.log("[Supabase] loadAppState: нет сохранённого состояния для telegram_id=" + tid);
    return null;

  } catch (e) {
    console.error("[Supabase] loadAppState exception:", e.name, e.message);
    return null;
  }
}

window.getTelegramIdentity = getTelegramIdentity;
window.getVerifiedUserIdentity = getVerifiedUserIdentity;
window.saveAppState = saveAppState;
window.loadAppState = loadAppState;
window.saveCurrentUser = saveCurrentUser;
window.getMyData = getMyData;

/* ============================================================================
 * DYNAMIC INFLATION RATES (public.inflation_rates)
 * ----------------------------------------------------------------------------
 * Заменяет статический STATS_COUNTRY_MAP[code].inflation на реальные данные
 * из Supabase. Кэширование на уровне модуля (in-memory, без TTL для одиночных
 * вызовов; TTL=1ч для батч-загрузки списка).
 *
 *   getInflationRate(country) → Promise<number>
 *     country = строка точно как в БД (например, "Россия"). Возвращает rate
 *     (десятичный процент, e.g. 7.8) либо 5.0 на любую ошибку.
 *
 *   loadInflationRates({ force }) → Promise<Array<{country, currency, inflation_rate, last_updated}>>
 *     Батч-загрузка всех стран. Используется для построения дропдауна стран
 *     в "Статистике счёта" и для прогрева кэша. Возвращает [] при ошибке.
 *
 * Fallback: INFLATION_FALLBACK = 5.0 (соответствует UX-спеке).
 * ============================================================================ */

var _inflationCache = new Map();       // country (db name) → number
var _inflationListCache = null;        // { ts: number, rows: Array }
var INFLATION_FALLBACK = 5.0;
var INFLATION_LIST_TTL_MS = 60 * 60 * 1000; // 1 час

async function getInflationRate(country) {
  try {
    if (!country) return INFLATION_FALLBACK;
    if (_inflationCache.has(country)) return _inflationCache.get(country);
    if (!initSupabaseClient()) return INFLATION_FALLBACK;

    var res = await supabaseClient
      .from("inflation_rates")
      .select("inflation_rate")
      .eq("country", country)
      .single();

    if (res.error || !res.data) {
      console.warn("[Inflation] Не удалось получить ставку для:", country,
        res.error && (res.error.code || res.error.message));
      return INFLATION_FALLBACK;
    }
    var rate = Number(res.data.inflation_rate);
    if (!isFinite(rate)) return INFLATION_FALLBACK;
    _inflationCache.set(country, rate);
    return rate;
  } catch (e) {
    console.error("[Inflation] Ошибка getInflationRate:", e);
    return INFLATION_FALLBACK;
  }
}

async function loadInflationRates(opts) {
  var force = !!(opts && opts.force);
  try {
    var now = Date.now();
    if (!force && _inflationListCache &&
        (now - _inflationListCache.ts < INFLATION_LIST_TTL_MS)) {
      return _inflationListCache.rows;
    }
    if (!initSupabaseClient()) return [];

    var res = await supabaseClient
      .from("inflation_rates")
      .select("country, currency, inflation_rate, last_updated")
      .order("country", { ascending: true });

    if (res.error || !res.data) {
      console.warn("[Inflation] Не удалось загрузить список:",
        res.error && (res.error.code || res.error.message));
      return [];
    }
    var rows = res.data;
    _inflationListCache = { ts: now, rows: rows };
    rows.forEach(function (row) {
      if (row && row.country != null && row.inflation_rate != null) {
        _inflationCache.set(row.country, Number(row.inflation_rate));
      }
    });
    console.log("[Inflation] Загружено стран:", rows.length);
    return rows;
  } catch (e) {
    console.error("[Inflation] Ошибка loadInflationRates:", e);
    return [];
  }
}

window.getInflationRate = getInflationRate;
window.loadInflationRates = loadInflationRates;

/* ============================================================================
 * PREMIUM ACCESS CONTROL + ADMIN ONLY: community stats block
 * ----------------------------------------------------------------------------
 * Единый фетчер user-level access-флагов из таблицы users одним запросом:
 *   - is_premium            — разблокирует 5 премиум-функций
 *   - show_community_stats  — админский флаг: показ блока «Статистика
 *                             сообщества» в профиле (включён вручную только
 *                             для владельца / 1-2 администраторов)
 *
 * Возвращает объект { isPremium: boolean, showCommunityStats: boolean }
 * либо null, если не удалось прочитать (нет клиента / нет identity /
 * ошибка SELECT / нет строки в users — например, до saveCurrentUser).
 *
 * Если колонка show_community_stats ещё не создана в БД (миграция не
 * прокатана), запрос вернёт ошибку — в этом случае возвращаем null,
 * клиент молча оставляет локальное значение.
 * ============================================================================ */
async function fetchUserAccessFlags() {
  try {
    if (!initSupabaseClient()) return null;
    // RLS AUTH: SELECT из users требует JWT с claim telegram_id, иначе 0 строк.
    if (!(await ensureAuthenticated())) {
      console.warn("[AccessFlags] нет авторизации, возвращаем null.");
      return null;
    }
    var identity = await getVerifiedUserIdentity();
    if (!identity) return null;

    // SUBSCRIPTION MODEL: тянем premium_until + auto_renew одним запросом.
    // Если колонок ещё нет в БД (миграция не применена), select упадёт —
    // возвращаем null и клиент молча сохраняет локальное состояние.
    var res = await supabaseClient
      .from("users")
      .select("is_premium, premium_until, auto_renew, show_community_stats")
      .eq("telegram_id", identity.telegram_id)
      .maybeSingle();

    if (res.error) {
      console.warn("[AccessFlags] fetchUserAccessFlags ошибка:",
        res.error.message, res.error.code || "");
      return null;
    }
    if (!res.data) return null;
    return {
      isPremium:          res.data.is_premium === true,
      premiumUntil:       res.data.premium_until || null,
      autoRenew:          res.data.auto_renew === true,
      showCommunityStats: res.data.show_community_stats === true
    };
  } catch (e) {
    console.warn("[AccessFlags] fetchUserAccessFlags exception:", e && e.message);
    return null;
  }
}

window.fetchUserAccessFlags = fetchUserAccessFlags;

/* ============================================================================
 * TELEGRAM STARS — клиентские помощники для Premium-оплаты
 * ----------------------------------------------------------------------------
 * Две функции:
 *   1. createStarsInvoice() — дёргает Edge Function create-stars-invoice
 *      и возвращает { invoice_url, payload, amount } или null при ошибке.
 *      Передаёт init_data (raw initData строка Telegram WebApp) для
 *      серверной верификации HMAC.
 *
 *   2. setUserPremium(value) — оптимистично проставляет users.is_premium=true
 *      ПОСЛЕ успешной оплаты (на случай, если bot webhook задерживается
 *      или не настроен). Серверная истина — за webhook'ом, но клиент тоже
 *      пишет в БД для немедленного UI-feedback.
 * ============================================================================ */
async function createStarsInvoice(autoRenew) {
  // SUBSCRIPTION MODEL: invoice на 30 дней Premium.
  //   autoRenew=true  → Edge Function добавит subscription_period=2592000
  //                     в createInvoiceLink. Telegram сам списывает 150⭐
  //                     каждые 30 дней, юзер отменяет через Telegram Settings.
  //   autoRenew=false → одноразовая оплата. После 30 дней — DM expired-notice.
  // Дефолт false на случай, если параметр не передан явно.
  var ar = autoRenew === true;
  try {
    var identity = await getVerifiedUserIdentity();
    if (!identity || !identity.telegram_id) {
      console.warn("[Stars] createStarsInvoice: нет identity");
      return null;
    }

    var initData = "";
    try {
      var w = window.Telegram && window.Telegram.WebApp;
      initData = (w && w.initData) || "";
    } catch (_e) { /* ignore */ }

    var url = SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/create-stars-invoice";
    // RLS AUTH: Edge Function проверяет init_data сама (HMAC), но мы всё
    // равно шлём наш кастомный JWT в Authorization — это позволит в будущем
    // снять флаг --no-verify-jwt и переложить часть валидации на Supabase.
    var stInvAuth = await _currentAuthToken();
    var res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + stInvAuth
      },
      body: JSON.stringify({
        telegram_id: identity.telegram_id,
        init_data: initData,
        auto_renew: ar
      })
    });

    if (!res.ok) {
      var errText = await res.text().catch(function () { return ""; });
      console.error("[Stars] createStarsInvoice HTTP " + res.status + ":", errText);
      return null;
    }

    var data = await res.json();
    if (!data || !data.invoice_url) {
      console.error("[Stars] createStarsInvoice: пустой invoice_url", data);
      return null;
    }
    return data;
  } catch (e) {
    console.error("[Stars] createStarsInvoice exception:", e && e.message);
    return null;
  }
}

/**
 * SUBSCRIPTION MODEL — определяет язык для серверных DM-сообщений.
 * Приоритет:
 *   1. appState.settings.language (что пользователь явно выбрал в приложении)
 *   2. tg.initDataUnsafe.user.language_code (язык Telegram-клиента)
 *   3. "en" — fallback.
 * Возвращает "ru" или "en" — другие пока не локализованы.
 */
function pickServerLanguage() {
  try {
    var s = (typeof window.getState === "function") ? window.getState() :
      (typeof appState !== "undefined" ? appState : null);
    var fromSettings = s && s.settings && s.settings.language;
    if (typeof fromSettings === "string" && fromSettings) {
      return fromSettings.toLowerCase().indexOf("ru") === 0 ? "ru" : "en";
    }
    var w = window.Telegram && window.Telegram.WebApp;
    var ds = w && w.initDataUnsafe && w.initDataUnsafe.user;
    var fromTg = ds && ds.language_code;
    if (typeof fromTg === "string" && fromTg) {
      return fromTg.toLowerCase().indexOf("ru") === 0 ? "ru" : "en";
    }
  } catch (_e) { /* ignore */ }
  return "en";
}

// SUBSCRIPTION MODEL — единый helper для вызова любого notification-endpoint'а.
// Все они принимают одинаковый { telegram_id, init_data, language } body.
// На backend'е проверяются все условия (дедуп, expiry window) — клиент
// только дёргает endpoint и не доверяет ответу для UI-логики.
async function _callNotificationEndpoint(endpoint, tag) {
  try {
    var identity = await getVerifiedUserIdentity();
    if (!identity || !identity.telegram_id) return null;

    var initData = "";
    try {
      var w = window.Telegram && window.Telegram.WebApp;
      initData = (w && w.initData) || "";
    } catch (_e) { /* ignore */ }
    if (!initData) {
      console.warn("[Stars] " + tag + ": init_data отсутствует — пропускаем");
      return null;
    }

    var url = SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/" + endpoint;
    // RLS AUTH: тот же приём что в createStarsInvoice — шлём наш JWT,
    // чтобы Edge Function мог в будущем читать claims вместо повторной HMAC-проверки.
    var notifAuth = await _currentAuthToken();
    var res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + notifAuth
      },
      body: JSON.stringify({
        telegram_id: identity.telegram_id,
        init_data: initData,
        language: pickServerLanguage()
      })
    });

    var data = await res.json().catch(function () { return null; });
    console.log("[Stars] " + tag + " result:", data);
    return data;
  } catch (e) {
    console.warn("[Stars] " + tag + " exception:", e && e.message);
    return null;
  }
}

// Триггер reminder'а за 3 дня до окончания подписки.
async function triggerRenewalReminder() {
  return _callNotificationEndpoint("send-renewal-reminder", "triggerRenewalReminder");
}

// Триггер «грустного» сообщения о том, что Premium закончился.
// Вызывается клиентом, когда он видит что premium_until < now() и notice ещё
// не был отправлен. Backend дополнительно проверяет premium_expired_notice_at
// для дедупликации — даже если клиент вызовет повторно, сообщение уйдёт один раз.
async function triggerPremiumExpiredNotice() {
  return _callNotificationEndpoint("send-premium-expired-notice", "triggerPremiumExpiredNotice");
}

async function setUserPremium(value) {
  try {
    if (!initSupabaseClient()) return false;
    // RLS AUTH: UPDATE users.is_premium требует JWT с claim telegram_id.
    if (!(await ensureAuthenticated())) {
      console.warn("[Stars] setUserPremium: нет авторизации, пропускаем (webhook всё равно проставит is_premium).");
      return false;
    }
    var identity = await getVerifiedUserIdentity();
    if (!identity) return false;

    var res = await supabaseClient
      .from("users")
      .update({ is_premium: !!value })
      .eq("telegram_id", identity.telegram_id);

    if (res.error) {
      console.error("[Stars] setUserPremium ошибка:",
        res.error.message, res.error.code || "");
      return false;
    }
    console.log("[Stars] users.is_premium=" + !!value + " установлено клиентом");
    return true;
  } catch (e) {
    console.error("[Stars] setUserPremium exception:", e && e.message);
    return false;
  }
}

window.createStarsInvoice = createStarsInvoice;
window.setUserPremium = setUserPremium;
window.triggerRenewalReminder = triggerRenewalReminder;
window.triggerPremiumExpiredNotice = triggerPremiumExpiredNotice;
window.pickServerLanguage = pickServerLanguage;

/**
 * STATISTICS COLLECTION — публичная статистика премиум/не-премиум пользователей.
 * Возвращает { premiumCount, freeCount, total }.
 *
 * RLS NOTE: после включения RLS обычный пользователь видит только СВОЮ строку
 * в users — count(*) вернёт 1/0 вместо реального числа. Поэтому считаем через
 * SECURITY DEFINER RPC public.get_community_stats() (миграция
 * 20260523_community_stats_and_storage.sql), которая обходит RLS и
 * возвращает только агрегаты (никаких PII).
 */
async function getPremiumStats() {
  try {
    if (!initSupabaseClient()) return null;
    if (!(await ensureAuthenticated())) {
      console.warn("[Statistics] getPremiumStats — auth не готов");
      return null;
    }

    var res = await supabaseClient.rpc("get_community_stats");
    if (res.error) {
      console.warn("[Statistics] getPremiumStats RPC ошибка:",
        res.error.message, res.error.code || "");
      return null;
    }
    var data = res.data || {};
    var premium = Number(data.premiumCount) || 0;
    var free    = Number(data.freeCount)    || 0;
    return { premiumCount: premium, freeCount: free, total: premium + free };
  } catch (e) {
    console.warn("[Statistics] getPremiumStats exception:", e && e.message);
    return null;
  }
}

window.getPremiumStats = getPremiumStats;

/**
 * COMMUNITY STATS — расширенная админская статистика для блока «Статистика
 * сообщества» в профиле. Возвращает:
 *   • premiumCount / freeCount / total
 *   • starsEarnedTotal      — SUM(amount) FROM stars_payments
 *   • starsEarnedLastMonth  — SUM(amount) WHERE created_at > now()-30d
 *   • premiumPurchases      — COUNT(*) FROM stars_payments
 *   • newUsers30d           — COUNT(*) FROM users WHERE created_at > now()-30d
 *
 * RLS NOTE: после включения RLS клиент не может агрегировать users/stars_payments
 * напрямую (видит только свою строку). Поэтому используется SECURITY DEFINER
 * RPC public.get_community_stats(), которая обходит RLS и отдаёт только
 * агрегаты (никаких PII утечь не может). Один сетевой запрос вместо шести.
 */
async function getCommunityStats() {
  if (!initSupabaseClient()) return null;
  if (!(await ensureAuthenticated())) {
    console.warn("[CommunityStats] auth не готов");
    return null;
  }

  try {
    var res = await supabaseClient.rpc("get_community_stats");
    if (res.error) {
      console.warn("[CommunityStats] RPC ошибка:",
        res.error.message, res.error.code || "");
      return null;
    }
    var d = res.data || {};
    function num(v) {
      if (v == null) return null;
      var n = Number(v);
      return isNaN(n) ? null : n;
    }
    return {
      premiumCount:         num(d.premiumCount),
      freeCount:            num(d.freeCount),
      total:                num(d.total),
      starsEarnedTotal:     num(d.starsEarnedTotal),
      starsEarnedLastMonth: num(d.starsEarnedLastMonth),
      premiumPurchases:     num(d.premiumPurchases),
      newUsers30d:          num(d.newUsers30d)
    };
  } catch (e) {
    console.warn("[CommunityStats] exception:", e && e.message);
    return null;
  }
}

window.getCommunityStats = getCommunityStats;

window.addEventListener("load", function () {
  console.log("[Supabase] window.load — bootstrap: ensureAuthenticated() → saveCurrentUser");

  // RLS AUTH: пораньше прогреваем сессию (через 200 мс — даём шанс Telegram
  // WebApp проинициализироваться). Это закроет race с другими модулями,
  // которые могут вызвать DB-функции до saveCurrentUser.
  // ensureAuthenticated() кеширует промис, поэтому повторный вызов из
  // других мест бесплатен — все ждут одну и ту же авторизацию.
  setTimeout(function () {
    ensureAuthenticated().then(function (ok) {
      if (!ok) {
        console.warn("[Supabase] ensureAuthenticated вернул false — DB-операции будут пропущены.");
      }
      // saveCurrentUser сам проверит auth, поэтому можно вызывать безопасно
      // даже если авторизация не прошла — он просто молча выйдет.
      return saveCurrentUser();
    }).catch(function (err) {
      console.error("[Supabase] bootstrap ошибка:", err);
    });
  }, 200);
});

// NEW: Media attachment in reports
// Bucket `report-media` должен существовать в Supabase Storage с публичным доступом
// (см. инструкцию в финальном ответе ассистента — INSERT policy + read-anon policy).
//
// Имена файлов санитизируются: только [A-Za-z0-9._-], всё остальное → `_`.
// Путь: reports/{telegramId}/{Date.now()}/{idx}_{safeName}
// .upload() с upsert:false — конфликтов имён не будет благодаря timestamp в пути.
function _sanitizeFileName(name) {
  var s = String(name || "file").replace(/[^\w.\-]+/g, "_");
  // ограничим длину, чтобы не упереться в лимиты Storage path
  if (s.length > 80) s = s.slice(0, 80);
  return s || "file";
}

// PREMIUM PROGRESS ANIMATION (real progress) — XHR-обёртка для аплоада в Storage.
// Supabase JS клиент использует fetch, у которого нет upload progress на стандарте.
// Чтобы получить байтовый прогресс, идём напрямую через XHR в REST endpoint:
//   POST {SUPABASE_URL}/storage/v1/object/{bucket}/{path}
// с anon-ключом в Authorization + apikey + Content-Type + x-upsert: false.
//
// Возвращает Promise<{ data, statusCode? }>. На !2xx — reject с err{statusCode, body, message}.
// onProgress(loaded, total) — частые вызовы (~50–150ms на медленной сети).

// FIX: cancel button during upload — список активных XHR для abort().
// Когда пользователь жмёт "Отмена" во время аплоада, window.cancelReportUpload()
// проходит по списку и вызывает xhr.abort() на каждом → onabort → reject Promise.
var _activeReportXhrs = [];

function _uploadFileViaXHR(url, file, headers, onProgress) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    Object.keys(headers || {}).forEach(function (k) {
      xhr.setRequestHeader(k, headers[k]);
    });

    // Регистрируем XHR в активном списке для возможного abort'а.
    _activeReportXhrs.push(xhr);
    function _unregister() {
      var idx = _activeReportXhrs.indexOf(xhr);
      if (idx >= 0) _activeReportXhrs.splice(idx, 1);
    }

    if (xhr.upload && typeof onProgress === "function") {
      xhr.upload.onprogress = function (evt) {
        if (evt && evt.lengthComputable) {
          try { onProgress(evt.loaded, evt.total); } catch (e) { /* swallow */ }
        }
      };
    }

    xhr.onload = function () {
      _unregister();
      if (xhr.status >= 200 && xhr.status < 300) {
        var parsed;
        try { parsed = JSON.parse(xhr.responseText || "{}"); } catch (e) { parsed = {}; }
        resolve({ data: parsed, statusCode: xhr.status });
      } else {
        var bodyText = xhr.responseText || "";
        var bodyParsed;
        try { bodyParsed = JSON.parse(bodyText); } catch (e) { bodyParsed = bodyText; }
        var msg = (bodyParsed && bodyParsed.message)
          ? bodyParsed.message
          : "upload failed: HTTP " + xhr.status;
        var err = new Error(msg);
        err.statusCode = xhr.status;
        err.body = bodyParsed;
        reject(err);
      }
    };
    xhr.onerror   = function () { _unregister(); reject(new Error("upload network error")); };
    xhr.ontimeout = function () { _unregister(); reject(new Error("upload timeout")); };
    // FIX: cancel button during upload — обработчик abort, без него Promise виснет
    // после xhr.abort(), и Promise.all/await никогда не резолвится.
    xhr.onabort   = function () {
      _unregister();
      var ae = new Error("upload aborted");
      ae.aborted = true;
      reject(ae);
    };
    xhr.timeout = 60000; // 60s per file (25MB на 3G ≈ 60s)

    xhr.send(file);
  });
}

// FIX: cancel button during upload — публичный API для UI слоя (app.js).
// Прерывает все активные XHR-аплоады в текущем `saveReport`. Идемпотентно.
window.cancelReportUpload = function () {
  if (!_activeReportXhrs.length) return;
  console.log('%c[Report] Отмена аплоада, активных XHR:', 'color: #f59e0b', _activeReportXhrs.length);
  // Снапшот, потому что abort() триггерит _unregister() который мутирует массив.
  var snapshot = _activeReportXhrs.slice();
  for (var i = 0; i < snapshot.length; i++) {
    try { snapshot[i].abort(); } catch (e) { /* swallow */ }
  }
  _activeReportXhrs.length = 0;
};

// UPDATED: saveReport — поддерживает media-аплоад с REAL XHR-прогрессом.
// Сигнатура: saveReport(telegramId, message, files, onProgress)
//   • files       — Array<File|Blob>, может быть пустым/undefined
//   • onProgress  — function(p: 0..1), вызывается во время аплоада с агрегированным
//                   значением (cumulative_loaded / total_bytes) по всем файлам.
//                   После окончания всех аплоадов гарантирует p=1.
//                   Если файлов нет — onProgress НЕ вызывается (UI использует fake-progress).
window.saveReport = async (telegramId, message, files, onProgress) => {
  if (!telegramId || !message || message.trim().length < 5) {
    return { ok: false, error: "Недостаточно данных" };
  }

  if (!initSupabaseClient()) {
    return { ok: false, error: "Supabase-клиент не инициализирован" };
  }
  // RLS AUTH: INSERT в reports + чтение users.chat_id + Storage-аплоад в
  // report-media bucket — всё требует JWT с claim telegram_id.
  if (!(await ensureAuthenticated())) {
    return { ok: false, error: "Не удалось авторизоваться. Попробуйте перезапустить приложение." };
  }

  // RLS AUTH: для Storage upload через raw XHR нужен наш кастомный JWT
  // (anon-ключ не пройдёт policy на бакете). Берём актуальный token из сессии.
  var authToken = await _currentAuthToken();

  // NEW: Media attachment in reports — нормализация массива файлов
  var mediaFiles = Array.isArray(files) ? files.filter(Boolean) : [];

  try {
    // Подтягиваем chat_id из таблицы users.
    const { data: userData } = await supabaseClient
      .from('users')
      .select('chat_id')
      .eq('telegram_id', telegramId)
      .single();

    const chatId = userData?.chat_id || telegramId; // fallback

    // PREMIUM PROGRESS ANIMATION (real) — аплоад с агрегированным прогрессом.
    // Сначала считаем totalBytes по всем файлам, потом per-file XHR с onprogress.
    // Каллбэк наружу получает чистый p ∈ [0..1].
    var mediaUrls = [];
    if (mediaFiles.length > 0) {
      var totalBytes = 0;
      for (var ti = 0; ti < mediaFiles.length; ti++) {
        totalBytes += (mediaFiles[ti].size || 0);
      }
      var completedBytes = 0;
      var ts = Date.now();

      // RLS AUTH: Authorization — наш JWT (для прохождения Storage RLS),
      // apikey — anon-ключ (Supabase требует его всегда для маршрутизации запросов).
      var headers = {
        "Authorization": "Bearer " + authToken,
        "apikey":        SUPABASE_ANON_KEY,
        "x-upsert":      "false",
        "Cache-Control": "3600"
      };

      for (var i = 0; i < mediaFiles.length; i++) {
        var f = mediaFiles[i];
        var safeName = _sanitizeFileName(f.name);
        var path = "reports/" + telegramId + "/" + ts + "/" + i + "_" + safeName;
        var contentType = f.type || "application/octet-stream";

        var uploadUrl = SUPABASE_URL.replace(/\/$/, "") +
                        "/storage/v1/object/report-media/" + path;

        var perFileHeaders = Object.assign({ "Content-Type": contentType }, headers);

        try {
          await _uploadFileViaXHR(uploadUrl, f, perFileHeaders, function (loaded /*, total */) {
            if (typeof onProgress === "function" && totalBytes > 0) {
              var cumulative = completedBytes + loaded;
              onProgress(Math.min(1, cumulative / totalBytes));
            }
          });
        } catch (upErr) {
          console.error('[saveReport] upload ошибка для', safeName, upErr);
          var ue = new Error(upErr.message || 'upload failed');
          ue.code = upErr.statusCode || upErr.code;
          ue.details = '[upload:' + safeName + ']';
          ue.hint = (upErr.body && upErr.body.error) || '';
          ue._fileName = safeName;
          throw ue;
        }

        completedBytes += (f.size || 0);

        // Гарантируем, что после каждого файла прогресс отражает суммарную долю
        // (некоторые браузеры могут не дать финальный onprogress перед onload).
        if (typeof onProgress === "function" && totalBytes > 0) {
          onProgress(Math.min(1, completedBytes / totalBytes));
        }

        // Public URL — строим вручную (то же, что вернул бы getPublicUrl
        // на public bucket'е). Дёшево, без сетевого вызова.
        var publicUrl = SUPABASE_URL.replace(/\/$/, "") +
                        "/storage/v1/object/public/report-media/" + path;

        mediaUrls.push(publicUrl);
        console.log('%c[Report] Загружен файл:', 'color: #10b981', safeName, '→', publicUrl);
      }

      // Финальный пуш прогресса до 1.0 после всех файлов.
      if (typeof onProgress === "function") {
        onProgress(1);
      }
    }

    const { data, error } = await supabaseClient
      .from('reports')
      .insert({
        telegram_id: telegramId,
        chat_id: chatId,
        message: message.trim(),
        status: 'new',
        resolved: false,
        notification_sent: false,
        media_urls: mediaUrls
      })
      .select('id')
      .single();

    if (error) throw error;

    console.log(
      '%c[Report] Отчёт сохранён с chat_id:',
      'color: #10b981',
      chatId,
      '| id:', data.id,
      '| media:', mediaUrls.length
    );
    return { ok: true, id: data.id, mediaCount: mediaUrls.length };
  } catch (err) {
    console.error('[saveReport] Полная ошибка Supabase:', err);
    if (err && (err.code || err.details || err.hint)) {
      console.error(
        '[saveReport] code=' + err.code,
        'details=' + (err.details || ''),
        'hint=' + (err.hint || '')
      );
    }
    return {
      ok: false,
      error: err.message || 'Не удалось отправить',
      failedFile: err && err._fileName
    };
  }
};

// =============================================
// Report system ready (reports table + saveReport)
// =============================================

// AUTO: chat_id saving for bot notifications
// Сохраняем chat_id в таблицу users, чтобы backend мог отправлять push
// «твоё сообщение помогло — мы починили» после resolved=true в reports.
//
// Замечания по сравнению с исходным snippet'ом:
//   • supabase.from(...) → supabaseClient.from(...)
//     (window.supabase — это CDN-namespace c .createClient(), у него нет .from()).
//   • tg?.initDataUnsafe... → window.Telegram?.WebApp?.initDataUnsafe...
//     (в этом файле переменная tg не объявлена, был бы ReferenceError).
//   • initSupabaseClient() — идемпотентная защита от вызова до инициализации клиента.
window.saveUserChatId = async (chatId) => {
  const telegramId =
    window.tgUserId ||
    window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

  // AUTO: chat_id saving for bot notifications — entry log для диагностики
  console.log(
    '%c[saveUserChatId] Вызвана с chatId:',
    'color: #10b981; font-weight: bold',
    chatId,
    'telegram_id:',
    telegramId
  );

  if (!telegramId || !chatId) {
    console.warn('[saveUserChatId] Прерывание: telegramId или chatId пустой',
      { telegramId: telegramId, chatId: chatId });
    return;
  }

  if (!initSupabaseClient()) {
    console.warn('[saveUserChatId] Supabase-клиент не инициализирован');
    return;
  }
  // RLS AUTH: upsert в users требует JWT с claim telegram_id.
  if (!(await ensureAuthenticated())) {
    console.warn('[saveUserChatId] нет авторизации, пропускаем.');
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('users')
      .upsert({
        telegram_id: telegramId,
        chat_id: chatId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'telegram_id' })
      .select('telegram_id, chat_id');

    if (error) {
      console.error('[ChatID] Ошибка сохранения:', error);
      if (error.code || error.details || error.hint) {
        console.error(
          '[ChatID] code=' + error.code,
          'details=' + (error.details || ''),
          'hint=' + (error.hint || '')
        );
      }
    } else {
      console.log('%c[ChatID] chat_id сохранён:', 'color: #10b981', chatId, '→ DB:', data);
    }
  } catch (e) {
    console.error('[ChatID] Ошибка:', e);
  }
};

// REMINDERS — стирает reminder_log пользователя при "Начать сначала".
// Вызывается из app.js confirmYes.onclick.
//
// Серверная RPC clear_user_reminder_log(p_telegram_id) проверяет, что вызывающий
// = владелец строк (через claim telegram_id в JWT). service_role обходит.
window.clearUserReminderLog = async () => {
  const telegramId =
    window.tgUserId ||
    window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

  if (!telegramId) {
    console.warn('[clearReminderLog] telegram_id не найден, пропускаем.');
    return { ok: false, reason: 'no_telegram_id' };
  }

  if (!initSupabaseClient()) {
    console.warn('[clearReminderLog] Supabase-клиент не инициализирован');
    return { ok: false, reason: 'no_client' };
  }
  if (!(await ensureAuthenticated())) {
    console.warn('[clearReminderLog] нет авторизации, пропускаем.');
    return { ok: false, reason: 'no_auth' };
  }

  try {
    const { data, error } = await supabaseClient.rpc('clear_user_reminder_log', {
      p_telegram_id: telegramId
    });
    if (error) {
      console.warn('[clearReminderLog] RPC error:', error.message);
      return { ok: false, reason: error.message };
    }
    console.log('[clearReminderLog] cleared rows:', data);
    return { ok: true, deleted: data };
  } catch (e) {
    console.warn('[clearReminderLog] Ошибка:', e);
    return { ok: false, reason: String(e?.message || e) };
  }
};
