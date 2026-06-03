-- ============================================================================
-- staging_base_schema.sql
--
-- НАЗНАЧЕНИЕ: создать на ЧИСТОМ staging-проекте Supabase базовые таблицы,
-- которых НЕТ в папке supabase/migrations/ (они были созданы в дашборде
-- прода вручную): users, user_state, reports, inflation_rates.
--
-- КАК ПРИМЕНЯТЬ (в браузере, без CLI и без Docker):
--   1. Открой STAGING-проект в Supabase → SQL Editor → New query.
--   2. Вставь ВЕСЬ этот файл → Run. Должно выполниться без ошибок.
--   3. После этого по очереди прогони файлы из supabase/migrations/ в порядке
--      по датам (см. инструкцию в чате).
--   4. Включи Custom Access Token Hook в Authentication → Hooks.
--
-- Файл идемпотентный: IF NOT EXISTS / DROP POLICY IF EXISTS — можно гонять
-- повторно без побочных эффектов.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. USERS — профиль пользователя Telegram
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  telegram_id   bigint      PRIMARY KEY,
  username      text,
  first_name    text,
  last_name     text,
  chat_id       bigint,
  is_premium    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- Премиум-поля (premium_until, auto_renew, renewal_reminder_at,
-- premium_expired_notice_at) добавит миграция 20260519_premium_subscription.sql.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT                       ON public.users TO anon;

-- Сносим старые политики, чтобы пересоздать чисто.
DROP POLICY IF EXISTS "Users can view own profile"       ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile"     ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"     ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;

CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT TO authenticated
USING (
  telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint
);

CREATE POLICY "Users can insert own profile"
ON public.users FOR INSERT TO authenticated
WITH CHECK (
  telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint
);

CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE TO authenticated
USING (
  telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint
)
WITH CHECK (
  telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint
);

CREATE POLICY "Service role can manage all users"
ON public.users FOR ALL TO service_role
USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. USER_STATE — сериализованное состояние приложения (одна строка на юзера)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_state (
  telegram_id bigint      PRIMARY KEY,
  data        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_state ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_state TO authenticated;
-- RLS-политики на user_state создаёт миграция 20260523_fix_user_state_rls.sql.


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REPORTS — сообщения «Сообщить о проблеме»
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_id       bigint      NOT NULL,
  chat_id           bigint,
  message           text        NOT NULL,
  status            text        NOT NULL DEFAULT 'new',
  resolved          boolean     NOT NULL DEFAULT false,
  notification_sent boolean     NOT NULL DEFAULT false,
  media_urls        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
-- RLS-политики на reports создаёт миграция 20260523_fix_reports_rls.sql.


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INFLATION_RATES — справочник инфляции по странам (публичные данные)
-- ─────────────────────────────────────────────────────────────────────────────
-- На staging таблица будет пустой — приложение само подставит фолбэк 5.0%,
-- это нормально для тестов. При желании можно скопировать строки с прода позже.
CREATE TABLE IF NOT EXISTS public.inflation_rates (
  country        text        PRIMARY KEY,
  currency       text,
  inflation_rate numeric,
  last_updated   timestamptz
);

ALTER TABLE public.inflation_rates ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.inflation_rates TO anon, authenticated;

DROP POLICY IF EXISTS "inflation_rates: read all" ON public.inflation_rates;
CREATE POLICY "inflation_rates: read all"
ON public.inflation_rates FOR SELECT TO anon, authenticated
USING (true);


-- ============================================================================
-- ПРОВЕРКА (выполнить после Run):
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public'
--     AND table_name IN ('users','user_state','reports','inflation_rates');
-- Должно вернуть 4 строки.
-- ============================================================================
