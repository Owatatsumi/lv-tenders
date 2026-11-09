import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

/**
 * Ссылка из письма подтверждения регистрации.
 * - ?code=…               — PKCE-поток по умолчанию (@supabase/ssr): меняем код на сессию;
 * - ?token_hash=…&type=…  — если шаблон письма в Supabase настроен на token_hash.
 * После успеха — на главную уже авторизованным, при ошибке — на /login с пометкой.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // только относительные пути — без открытых редиректов на чужие сайты
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  return NextResponse.redirect(new URL(ok ? next : "/login?error=confirm", origin));
}
