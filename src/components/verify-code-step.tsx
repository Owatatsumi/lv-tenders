"use client";

import { AlertCircle, CheckCircle2, MailCheck } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { resendCode, verifyCode, type VerifyState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useLocale } from "./locale-provider";

/** Длина кода — как в Supabase: Authentication → Providers → Email → Email OTP Length. */
const OTP_LENGTH = Number(process.env.NEXT_PUBLIC_SUPABASE_OTP_LENGTH ?? 6);
/** Supabase разрешает повторную отправку не чаще раза в 60 секунд. */
const RESEND_COOLDOWN_S = 60;
const IDLE: VerifyState = { status: "idle" };

export function VerifyCodeStep({
  email,
  reason,
  onBack,
}: {
  email: string;
  reason: "signup" | "unconfirmed";
  onBack: () => void;
}) {
  const { t } = useLocale();
  const a = t.auth;
  const formRef = useRef<HTMLFormElement>(null);
  const [code, setCode] = useState("");
  const [verifyState, verifyAction, verifying] = useActionState(verifyCode, IDLE);
  const [resendState, resendAction, resending] = useActionState(resendCode, IDLE);
  // код только что отправлен (при регистрации или входе) — сразу ждём минуту
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const error = verifyState.status === "error" ? verifyState : resendState.status === "error" ? resendState : null;

  return (
    <>
      <form ref={formRef} action={verifyAction}>
        <input type="hidden" name="email" value={email} />
        <CardContent className="space-y-4">
          <div role="status" className="flex gap-3 rounded-lg bg-primary/10 p-3 text-sm">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p className="text-muted-foreground">
              {reason === "signup" ? a.verifySent(email) : a.verifyUnconfirmed(email)}
            </p>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{a.errors[error.code]}</span>
            </div>
          )}
          {resendState.status === "resent" && !error && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" aria-hidden />
              {a.resent}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="token">{a.code}</Label>
            <InputOTP
              id="token"
              name="token"
              maxLength={OTP_LENGTH}
              value={code}
              onChange={setCode}
              // как только введена последняя цифра — отправляем форму сами
              onComplete={() => formRef.current?.requestSubmit()}
              inputMode="numeric"
              pattern="^[0-9]+$"
              autoComplete="one-time-code"
              autoFocus
              disabled={verifying}
              containerClassName="justify-center"
            >
              <InputOTPGroup>
                {Array.from({ length: OTP_LENGTH }, (_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-11 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        </CardContent>

        <CardFooter className="mt-4 flex-col gap-3 border-t pt-(--card-spacing) pb-(--card-spacing)">
          <Button type="submit" className="w-full" size="lg" disabled={verifying || code.length < OTP_LENGTH}>
            {verifying ? a.pending : a.submitCode}
          </Button>
        </CardFooter>
      </form>

      <div className="flex items-center justify-between gap-2 px-(--card-spacing) pb-(--card-spacing) text-sm">
        <Button variant="ghost" size="sm" onClick={onBack}>
          {a.back}
        </Button>
        <form
          action={(fd) => {
            setCooldown(RESEND_COOLDOWN_S);
            resendAction(fd);
          }}
        >
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="link" size="sm" disabled={resending || cooldown > 0}>
            {cooldown > 0 ? `${a.resend} (${cooldown})` : a.resend}
          </Button>
        </form>
      </div>
    </>
  );
}
