-- Текстовое описание предмета закупки со страницы деталей EIS
-- (поле «Cita informācija» / SubjectDescription_Description).
-- Используется для AI-выжимки и сопоставления с ключевыми словами клиентов.
alter table public.tenders
  add column if not exists description text;
