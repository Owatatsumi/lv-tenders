"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

/** Коды ошибок, которые форма переводит на язык интерфейса (см. dictionary.auth.errors). */
export type AuthErrorCode =
  | "missing_fields"
  | "invalid_email"
  | "weak_password"
  | "invalid_credentials"
  | "user_already_exists"
  | "invalid_code"
  | "rate_limited"
  | "unknown";

export type AuthState =
  | { status: "idle" }
  | { status: "error"; code: AuthErrorCode }
  /** Шаг ввода одноразового кода из письма (регистрация или вход в неподтверждённый аккаунт). */
  | { status: "verify"; email: string; reason: "signup" | "unconfirmed" };

export type VerifyState =
  | { status: "idle" }
  | { status: "error"; code: AuthErrorCode }
  | { status: "resent" };

const MIN_PASSWORD_LENGTH = 8;

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

function mapSupabaseError(code: string | undefined, status: number | undefined): AuthErrorCode {
  switch (code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "user_already_exists":
    case "email_exists":
      return "user_already_exists";
    case "weak_password":
      return "weak_password";
    case "email_address_invalid":
    case "validation_failed":
      return "invalid_email";
    case "otp_expired":
    case "otp_disabled":
      return "invalid_code";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rate_limited";
  }
  return status === 429 ? "rate_limited" : "unknown";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { status: "error", code: "missing_fields" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error?.code === "email_not_confirmed") {
    // Аккаунт создан, но email не подтверждён — шлём свежий код и переходим к его вводу.
    // Ошибку отправки (например, лимит «раз в минуту») не показываем: пользователь может
    // ввести код из предыдущего письма или нажать «Отправить ещё раз».
    await supabase.auth.resend({ type: "signup", email });
    return { status: "verify", email, reason: "unconfirmed" };
  }
  if (error) return { status: "error", code: mapSupabaseError(error.code, error.status) };

  redirect("/");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { status: "error", code: "missing_fields" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "error", code: "invalid_email" };
  if (password.length < MIN_PASSWORD_LENGTH) return { status: "error", code: "weak_password" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { status: "error", code: mapSupabaseError(error.code, error.status) };

  // При включённом подтверждении email Supabase не сообщает, что адрес занят (защита от перебора),
  // а возвращает пользователя без identities.
  if (data.user && data.user.identities?.length === 0) {
    return { status: "error", code: "user_already_exists" };
  }

  // Подтверждение email выключено в проекте — сессия уже есть, сразу на главную.
  if (data.session) redirect("/");

  return { status: "verify", email, reason: "signup" };
}

/** Проверка одноразового кода из письма: успех → сессия в cookies → на главную. */
export async function verifyCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\s+/g, "");
  if (!email || !/^\d{6,10}$/.test(token)) return { status: "error", code: "invalid_code" };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { status: "error", code: mapSupabaseError(error.code, error.status) };

  redirect("/");
}

/** Повторная отправка кода (Supabase ограничивает частоту — по умолчанию раз в 60 секунд). */
export async function resendCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { status: "error", code: "missing_fields" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) return { status: "error", code: mapSupabaseError(error.code, error.status) };
  return { status: "resent" };
}
