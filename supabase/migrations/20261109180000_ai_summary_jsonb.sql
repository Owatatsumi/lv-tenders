-- Мультиязычные AI-выжимки: ai_summary text → jsonb вида {"lv": "...", "ru": "...", "en": "..."}.
-- Старые текстовые выжимки (только LV) сбрасываются в NULL — summarize.ts сгенерирует их заново.
-- (Эквивалент DROP COLUMN + ADD COLUMN, но колонка остаётся на своём месте.)
alter table public.tenders
  alter column ai_summary type jsonb using null;

-- Защита от битых данных: либо NULL, либо объект со всеми тремя языками-строками.
alter table public.tenders
  add constraint tenders_ai_summary_shape check (
    ai_summary is null
    or (
      jsonb_typeof(ai_summary) = 'object'
      and jsonb_typeof(ai_summary -> 'lv') = 'string'
      and jsonb_typeof(ai_summary -> 'ru') = 'string'
      and jsonb_typeof(ai_summary -> 'en') = 'string'
    )
  );
