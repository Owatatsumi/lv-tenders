"use client";

import type { User } from "@supabase/supabase-js";
import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import { useLocale } from "./locale-provider";

/**
 * Кнопки «Войти / Регистрация» или аватар + «Выйти».
 * Сессия читается из cookies в браузере и обновляется подпиской onAuthStateChange.
 * Это только отображение: доступ к выжимкам проверяется на сервере.
 */
export function AuthStatus() {
  const { t } = useLocale();
  const router = useRouter();
  // undefined — ещё не знаем (показываем скелетон), null — гость
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    // getUser() сверяется с Supabase Auth (а не просто читает cookie): удалённый пользователь
    // или отозванная сессия не покажутся в шапке как «вошёл».
    supabase.auth.getUser().then(({ data, error }) => setUser(error ? null : data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    setUser(null);
    router.refresh(); // перерисовать серверные компоненты — выжимки снова скрываются
  }

  if (user === undefined) return <Skeleton className="h-8 w-8 rounded-full sm:w-36" />;

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/login"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "h-8" })}
          aria-label={t.auth.signIn}
        >
          <LogIn aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">{t.auth.signIn}</span>
        </Link>
        {/* cn (tailwind-merge): иначе inline-flex из buttonVariants перебивает hidden на телефоне */}
        <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "hidden h-8 sm:inline-flex")}>
          {t.auth.signUp}
        </Link>
      </div>
    );
  }

  const email = user.email ?? "";
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        title={email}
        aria-label={`${t.auth.account}: ${email}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold uppercase text-primary-foreground"
      >
        {email.charAt(0) || "?"}
      </span>
      <span className="hidden max-w-40 truncate text-sm text-muted-foreground lg:inline">{email}</span>
      <Button variant="ghost" size="sm" className="h-8" onClick={signOut} aria-label={t.auth.signOut}>
        <LogOut aria-hidden />
        <span className="hidden sm:inline">{t.auth.signOut}</span>
      </Button>
    </div>
  );
}
