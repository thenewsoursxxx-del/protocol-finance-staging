-- ============================================================================
-- 20260603_protect_premium_and_stars_rls.sql
--
-- 1) Запрет клиенту менять premium/admin-поля в users (только service_role).
-- 2) RLS на stars_payments — клиент не видит и не пишет платежи.
--
-- Идемпотентно. Прогнать на prod и staging.
-- ============================================================================

-- ── 1. Trigger: premium-поля только с сервера (Edge Functions / admin) ────
CREATE OR REPLACE FUNCTION public.users_protect_premium_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Edge Functions и миграции ходят с service_role — не блокируем.
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_premium := false;
    NEW.premium_until := NULL;
    NEW.auto_renew := false;
    NEW.show_community_stats := COALESCE(NEW.show_community_stats, false);
    NEW.renewal_reminder_at := NULL;
    NEW.premium_expired_notice_at := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_premium IS DISTINCT FROM OLD.is_premium
       OR NEW.premium_until IS DISTINCT FROM OLD.premium_until
       OR NEW.auto_renew IS DISTINCT FROM OLD.auto_renew
       OR NEW.show_community_stats IS DISTINCT FROM OLD.show_community_stats
       OR NEW.renewal_reminder_at IS DISTINCT FROM OLD.renewal_reminder_at
       OR NEW.premium_expired_notice_at IS DISTINCT FROM OLD.premium_expired_notice_at THEN
      RAISE EXCEPTION 'premium_fields_readonly'
        USING HINT = 'Premium status can only be changed by payment webhook or admin.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_protect_premium_columns ON public.users;
CREATE TRIGGER users_protect_premium_columns
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_protect_premium_columns();

-- ── 2. stars_payments: RLS, без доступа для anon/authenticated ─────────────
ALTER TABLE public.stars_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stars_payments: service_role only" ON public.stars_payments;
CREATE POLICY "stars_payments: service_role only"
ON public.stars_payments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
