// Типы схемы БД. Позже можно генерировать автоматически:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

/** Поддерживаемые языки интерфейса и выжимок. */
export const LOCALES = ["lv", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Локализованная версия тендера для одного языка. */
export type LocalizedTender = {
  /** Название закупки: в lv — оригинал из EIS, в ru/en — перевод. */
  title: string;
  /** 3 пункта, разделённых "\n": "• Būtība: …\n• Budžets un termiņi: …\n• Prasības pretendentam: …" */
  summary: string;
};

/** AI-выжимка тендера (колонка ai_summary, jsonb): {"lv": {...}, "ru": {...}, "en": {...}}. */
export type AiSummary = Record<Locale, LocalizedTender>;

export type Tender = {
  id: string;
  external_id: string;
  title: string;
  customer_name: string | null;
  deadline: string | null;
  url: string;
  description: string | null;
  ai_summary: AiSummary | null;
  created_at: string;
};

type OptionalOnInsert = "id" | "created_at" | "customer_name" | "deadline" | "description" | "ai_summary";

export type TenderInsert = Omit<Tender, OptionalOnInsert> & Partial<Pick<Tender, OptionalOnInsert>>;

export type Database = {
  public: {
    Tables: {
      tenders: {
        Row: Tender;
        Insert: TenderInsert;
        Update: Partial<Tender>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
