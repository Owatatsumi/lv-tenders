"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "./locale-provider";
import { VerifyCodeStep } from "./verify-code-step";

const INITIAL: AuthState = { status: "idle" };

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  // «Назад» с шага кода: новый key пересоздаёт форму с чистым состоянием useActionState
  const [attempt, setAttempt] = useState(0);
  return <AuthFormInner key={attempt} mode={mode} onReset={() => setAttempt((n) => n + 1)} />;
}

function AuthFormInner({ mode, onReset }: { mode: "login" | "signup"; onReset: () => void }) {
  const { t } = useLocale();
  const a = t.auth;
  const [state, formAction, pending] = useActionState(mode === "login" ? signIn : signUp, INITIAL);
  // ?error=confirm — сюда возвращает /auth/callback, если ссылка из письма не сработала
  const linkError = useSearchParams().get("error") === "confirm" && state.status === "idle";

  const errorText =
    state.status === "error" ? a.errors[state.code] : linkError ? a.errors.confirm : null;

  // Подсвечиваем только поле, в котором ошибка. Лимит запросов или сбой сервера — не вина полей.
  const code = state.status === "error" ? state.code : null;
  const typedEmail = state.status === "error" ? state.email : "";
  const emailInvalid =
    code === "invalid_email" || code === "user_already_exists" || (code === "missing_fields" && !typedEmail);
  const passwordInvalid = code === "weak_password" || code === "invalid_credentials" || code === "missing_fields";

  return (
    <Card className="w-full max-w-sm bg-card/70 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-xl">
          {state.status === "verify" ? a.verifyTitle : mode === "login" ? a.loginTitle : a.signupTitle}
        </CardTitle>
        {state.status !== "verify" && (
          <CardDescription>{mode === "login" ? a.loginSubtitle : a.signupSubtitle}</CardDescription>
        )}
      </CardHeader>

      {state.status === "verify" ? (
        <VerifyCodeStep email={state.email} reason={state.reason} onBack={onReset} />
      ) : (
        <form action={formAction} noValidate>
          <CardContent className="space-y-4">
            {errorText && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{errorText}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{a.email}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                // React 19 очищает форму после action — возвращаем введённый email
                defaultValue={state.status === "error" ? state.email : undefined}
                aria-invalid={emailInvalid || undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{a.password}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "signup" ? 8 : undefined}
                required
                aria-describedby={mode === "signup" ? "password-hint" : undefined}
                aria-invalid={passwordInvalid || undefined}
              />
              {mode === "signup" && (
                <p id="password-hint" className="text-xs text-muted-foreground">
                  {a.passwordHint}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="mt-4 flex-col gap-3 border-t pt-(--card-spacing) pb-(--card-spacing)">
            <Button type="submit" className="w-full" size="lg" disabled={pending}>
              {pending ? a.pending : mode === "login" ? a.submitLogin : a.submitSignup}
            </Button>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? a.noAccount : a.haveAccount}{" "}
              <Link
                href={mode === "login" ? "/signup" : "/login"}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {mode === "login" ? a.signUp : a.signIn}
              </Link>
            </p>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
