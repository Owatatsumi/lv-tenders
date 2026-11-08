-- Таблица тендеров, собранных с eis.gov.lv / data.gov.lv
create table if not exists public.tenders (
  id            uuid primary key default gen_random_uuid(),
  external_id   text not null unique,          -- ID закупки на eis.gov.lv
  title         text not null,                 -- название закупки (LV)
  customer_name text,                          -- заказчик / гос. учреждение
  deadline      timestamptz,                   -- крайний срок подачи предложений
  url           text not null,                 -- прямая ссылка на закупку
  ai_summary    text,                          -- AI-выжимка для клиентов
  created_at    timestamptz not null default now()
);

-- Частые выборки: актуальные тендеры по сроку и новые поступления
create index if not exists tenders_deadline_idx   on public.tenders (deadline);
create index if not exists tenders_created_at_idx on public.tenders (created_at desc);

-- Row Level Security
alter table public.tenders enable row level security;

-- Чтение: любой авторизованный пользователь
create policy "tenders_select_authenticated"
  on public.tenders
  for select
  to authenticated
  using (true);

-- Запись: только service_role (скрапер / серверные задачи).
-- service_role и так обходит RLS, но явные политики документируют намерение.
create policy "tenders_insert_service_role"
  on public.tenders
  for insert
  to service_role
  with check (true);

create policy "tenders_update_service_role"
  on public.tenders
  for update
  to service_role
  using (true)
  with check (true);

create policy "tenders_delete_service_role"
  on public.tenders
  for delete
  to service_role
  using (true);
