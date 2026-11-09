-- Локализованные заголовки: ai_summary теперь
--   {"lv": {"title": "...", "summary": "..."}, "ru": {...}, "en": {...}}
-- Старые выжимки (без заголовков) сбрасываются — summarize.ts сгенерирует их заново.
update public.tenders set ai_summary = null where ai_summary is not null;

alter table public.tenders drop constraint if exists tenders_ai_summary_shape;

alter table public.tenders
  add constraint tenders_ai_summary_shape check (
    ai_summary is null
    or (
      jsonb_typeof(ai_summary) = 'object'
      and jsonb_typeof(ai_summary -> 'lv' -> 'title') = 'string'
      and jsonb_typeof(ai_summary -> 'lv' -> 'summary') = 'string'
      and jsonb_typeof(ai_summary -> 'ru' -> 'title') = 'string'
      and jsonb_typeof(ai_summary -> 'ru' -> 'summary') = 'string'
      and jsonb_typeof(ai_summary -> 'en' -> 'title') = 'string'
      and jsonb_typeof(ai_summary -> 'en' -> 'summary') = 'string'
    )
  );
