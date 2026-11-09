import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (бывший middleware.ts): на каждом запросе обновляет сессию Supabase.
 * Если access-токен истёк, getClaims() обновит его по refresh-токену, а новые cookies
 * уйдут и в запрос (для серверных компонентов), и в ответ (для браузера).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // заголовки против кэширования ответа с персональными cookies
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Не вставлять код между созданием клиента и getClaims(): это и есть обновление сессии.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // всё, кроме статики и картинок
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
