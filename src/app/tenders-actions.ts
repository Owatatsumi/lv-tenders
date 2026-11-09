"use server";

import { getCurrentUserId } from "@/lib/supabase-server";
import { PAGE_SIZE, searchTenders, type TenderPage } from "@/lib/tenders";

/**
 * «Загрузить ещё»: следующая страница результатов.
 * Server action — публичный эндпоинт, поэтому авторизацию проверяем здесь заново:
 * гость получит те же урезанные данные (без текста сводок), что и на первой странице.
 */
export async function loadMoreTenders(query: string, offset: number): Promise<TenderPage> {
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
  const authenticated = (await getCurrentUserId()) !== null;
  return searchTenders({ authenticated, query, offset: safeOffset, limit: PAGE_SIZE });
}
