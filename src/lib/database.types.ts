// Типы схемы БД. Позже можно генерировать автоматически:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type Tender = {
  id: string;
  external_id: string;
  title: string;
  customer_name: string | null;
  deadline: string | null;
  url: string;
  ai_summary: string | null;
  created_at: string;
};

export type TenderInsert = Omit<Tender, "id" | "created_at" | "customer_name" | "deadline" | "ai_summary"> &
  Partial<Pick<Tender, "id" | "created_at" | "customer_name" | "deadline" | "ai_summary">>;

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
