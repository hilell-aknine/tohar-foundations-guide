-- ============================================================
-- מודל היסודות השיווקיים — סכמת בסיס
-- פרויקט: llhgjyskcuedommznwqg (הפרויקט הייעודי של טוהר)
--
-- עיקרון אבטחה: RLS deny-all על הכול.
-- anon לא קורא ולא כותב ישירות. כל גישה עוברת דרך Edge Functions
-- שרצות עם service_role ומוודאות את הקלט.
-- ============================================================

-- ─────────── התקדמות ותשובות ───────────
create table if not exists public.guide_sessions (
  sid            uuid primary key,
  step           smallint     not null default 0 check (step >= 0 and step <= 40),
  scores         smallint[]   not null default '{}',
  answers        jsonb        not null default '{}'::jsonb,
  answered_count smallint     generated always as (
                   (select count(*) from jsonb_each_text(answers) as t(k,v) where length(btrim(v)) > 0)
                 ) stored,
  weakest        text,
  avg_score      numeric(3,1),
  name           text,
  phone          text,
  email          text,
  is_lead        boolean      not null default false,
  user_agent     text,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);

comment on table public.guide_sessions is 'מפגש אחד של בעלת עסק במדריך היסודות. sid נוצר בדפדפן שלה.';

create index if not exists guide_sessions_updated_idx on public.guide_sessions (updated_at desc);
create index if not exists guide_sessions_lead_idx    on public.guide_sessions (is_lead, created_at desc) where is_lead;

-- ─────────── שיחות עם המורה ───────────
  id          bigserial primary key,
  sid         uuid not null references public.guide_sessions(sid) on delete cascade,
  step_type   text,
  foundation  smallint,
  question    text not null,
  reply       text,
  tokens_in   integer,
  tokens_out  integer,
  created_at  timestamptz not null default now()
);

-- ─────────── updated_at ───────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists guide_sessions_touch on public.guide_sessions;
create trigger guide_sessions_touch
  before update on public.guide_sessions
  for each row execute function public.touch_updated_at();

-- ─────────── RLS: deny-all ───────────
alter table public.guide_sessions   enable row level security;

-- ללא אף policy = אף אחד לא נוגע חוץ מ-service_role (שעוקף RLS).
-- זה מכוון. אל תוסיף כאן policy ל-anon.

revoke all on public.guide_sessions   from anon, authenticated;

-- ─────────── תצוגת לידים לטוהר ───────────
create or replace view public.guide_leads as
select sid, name, phone, email, weakest, avg_score, answered_count, step, created_at, updated_at
from public.guide_sessions
where is_lead
order by created_at desc;

revoke all on public.guide_leads from anon, authenticated;
