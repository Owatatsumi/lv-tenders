// Типы схемы БД. Позже можно генерировать автоматически:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type Tender = {
  id: string;
  external_id: string;
  title: string;
  customer_name: string | null;
  deadline: string | null;
  url: string;
  description: string | null;
  ai_summary: string | null;
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
