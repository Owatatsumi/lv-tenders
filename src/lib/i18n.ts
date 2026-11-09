import type { Locale } from "./database.types";

export const DEFAULT_LOCALE: Locale = "lv";

export const LOCALE_LABELS: Record<Locale, string> = { lv: "LV", ru: "RU", en: "EN" };

/** Тексты интерфейса. Заказчик остаётся на латышском (как в EIS), название переводится AI. */
const lv = {
  appName: "LV Tenders",
  tagline: "Jaunākie publiskie iepirkumi ar AI kopsavilkumu",
  latest: "Jaunākie iepirkumi",
  count: (n: number) => `${n} iepirkumi`,
  customer: "Pasūtītājs",
  originalTitle: "Oriģinālais nosaukums",
  deadline: "Iesniegšanas termiņš",
  noDeadline: "Termiņš nav norādīts",
  summaryPending: "AI kopsavilkums vēl tiek gatavots.",
  summaryLabels: ["Būtība", "Budžets un termiņi", "Prasības pretendentam"] as [string, string, string],
  paywall: "Autorizējieties, lai lasītu AI analīzi un prasības",
  paywallCta: "Reģistrēties bez maksas",
  openInEis: "Atvērt EIS",
  empty: "Pagaidām nav neviena iepirkuma.",
  error: "Neizdevās ielādēt iepirkumus. Mēģiniet vēlāk.",
  language: "Valoda",
  theme: "Tēma",
  themes: { light: "Gaišā tēma", dark: "Tumšā tēma", system: "Sistēmas tēma" },
  auth: {
    signIn: "Ienākt",
    signUp: "Reģistrācija",
    signOut: "Iziet",
    account: "Konts",
    loginTitle: "Ienākt kontā",
    loginSubtitle: "Lai lasītu AI kopsavilkumus un prasības pretendentiem.",
    signupTitle: "Izveidot kontu",
    signupSubtitle: "Bezmaksas piekļuve AI analīzei par katru iepirkumu.",
    email: "E-pasts",
    password: "Parole",
    passwordHint: "Vismaz 8 rakstzīmes",
    submitLogin: "Ienākt",
    submitSignup: "Izveidot kontu",
    pending: "Lūdzu, uzgaidiet…",
    noAccount: "Nav konta?",
    haveAccount: "Jau ir konts?",
    verifyTitle: "Ievadiet kodu no e-pasta",
    verifySent: (email: string) => `Nosūtījām vienreizējo kodu uz ${email}.`,
    verifyUnconfirmed: (email: string) => `E-pasts vēl nav apstiprināts. Nosūtījām jaunu kodu uz ${email}.`,
    code: "Apstiprinājuma kods",
    submitCode: "Apstiprināt",
    resend: "Nosūtīt kodu vēlreiz",
    resent: "Jauns kods nosūtīts.",
    back: "Atpakaļ",
    errors: {
      missing_fields: "Ievadiet e-pastu un paroli.",
      invalid_email: "Nepareizs e-pasta formāts.",
      weak_password: "Parole ir pārāk vāja: vismaz 8 rakstzīmes.",
      invalid_credentials: "Nepareizs e-pasts vai parole.",
      invalid_code: "Kods ir nepareizs vai novecojis. Pārbaudiet vai pieprasiet jaunu.",
      user_already_exists: "Konts ar šo e-pastu jau eksistē. Mēģiniet ienākt.",
      rate_limited: "Pārāk daudz mēģinājumu. Pamēģiniet pēc brīža.",
      confirm: "Apstiprinājuma saite ir nederīga vai novecojusi.",
      unknown: "Kaut kas nogāja greizi. Mēģiniet vēlreiz.",
    },
  },
};

export type Dictionary = typeof lv;

export const dictionary: Record<Locale, Dictionary> = {
  lv,
  ru: {
    appName: "LV Tenders",
    tagline: "Свежие госзакупки Латвии с AI-сводкой",
    latest: "Последние закупки",
    count: (n: number) => `Закупок: ${n}`,
    customer: "Заказчик",
    originalTitle: "Оригинальное название",
    deadline: "Срок подачи",
    noDeadline: "Срок не указан",
    summaryPending: "AI-сводка ещё готовится.",
    summaryLabels: ["Суть", "Бюджет и сроки", "Требования к участнику"],
    paywall: "Авторизуйтесь, чтобы прочитать AI-анализ и требования",
    paywallCta: "Зарегистрироваться бесплатно",
    openInEis: "Открыть в EIS",
    empty: "Пока нет ни одной закупки.",
    error: "Не удалось загрузить закупки. Попробуйте позже.",
    language: "Язык",
    theme: "Тема",
    themes: { light: "Светлая тема", dark: "Тёмная тема", system: "Как в системе" },
    auth: {
      signIn: "Войти",
      signUp: "Регистрация",
      signOut: "Выйти",
      account: "Аккаунт",
      loginTitle: "Вход в аккаунт",
      loginSubtitle: "Чтобы читать AI-сводки и требования к участникам.",
      signupTitle: "Создать аккаунт",
      signupSubtitle: "Бесплатный доступ к AI-анализу каждой закупки.",
      email: "Email",
      password: "Пароль",
      passwordHint: "Минимум 8 символов",
      submitLogin: "Войти",
      submitSignup: "Создать аккаунт",
      pending: "Подождите…",
      noAccount: "Нет аккаунта?",
      haveAccount: "Уже есть аккаунт?",
      verifyTitle: "Введите код из письма",
      verifySent: (email: string) => `Мы отправили одноразовый код на ${email}.`,
      verifyUnconfirmed: (email: string) => `Email ещё не подтверждён. Мы отправили новый код на ${email}.`,
      code: "Код подтверждения",
      submitCode: "Подтвердить",
      resend: "Отправить код ещё раз",
      resent: "Новый код отправлен.",
      back: "Назад",
      errors: {
        missing_fields: "Введите email и пароль.",
        invalid_email: "Неверный формат email.",
        weak_password: "Слишком простой пароль: минимум 8 символов.",
        invalid_credentials: "Неверный email или пароль.",
        invalid_code: "Код неверный или устарел. Проверьте его или запросите новый.",
        user_already_exists: "Аккаунт с этим email уже существует. Попробуйте войти.",
        rate_limited: "Слишком много попыток. Попробуйте чуть позже.",
        confirm: "Ссылка подтверждения недействительна или устарела.",
        unknown: "Что-то пошло не так. Попробуйте ещё раз.",
      },
    },
  },
  en: {
    appName: "LV Tenders",
    tagline: "Latest Latvian public tenders with AI summaries",
    latest: "Latest tenders",
    count: (n: number) => `${n} tenders`,
    customer: "Contracting authority",
    originalTitle: "Original title",
    deadline: "Submission deadline",
    noDeadline: "No deadline specified",
    summaryPending: "AI summary is being prepared.",
    summaryLabels: ["Summary", "Budget and deadlines", "Bidder requirements"],
    paywall: "Sign in to read the AI analysis and requirements",
    paywallCta: "Sign up for free",
    openInEis: "Open in EIS",
    empty: "No tenders yet.",
    error: "Could not load tenders. Please try again later.",
    language: "Language",
    theme: "Theme",
    themes: { light: "Light theme", dark: "Dark theme", system: "System theme" },
    auth: {
      signIn: "Sign in",
      signUp: "Sign up",
      signOut: "Sign out",
      account: "Account",
      loginTitle: "Sign in to your account",
      loginSubtitle: "To read AI summaries and bidder requirements.",
      signupTitle: "Create an account",
      signupSubtitle: "Free access to the AI analysis of every tender.",
      email: "Email",
      password: "Password",
      passwordHint: "At least 8 characters",
      submitLogin: "Sign in",
      submitSignup: "Create account",
      pending: "Please wait…",
      noAccount: "No account yet?",
      haveAccount: "Already have an account?",
      verifyTitle: "Enter the code from your email",
      verifySent: (email: string) => `We sent a one-time code to ${email}.`,
      verifyUnconfirmed: (email: string) => `Your email is not confirmed yet. We sent a new code to ${email}.`,
      code: "Verification code",
      submitCode: "Verify",
      resend: "Resend code",
      resent: "A new code has been sent.",
      back: "Back",
      errors: {
        missing_fields: "Enter your email and password.",
        invalid_email: "Invalid email format.",
        weak_password: "Password is too weak: at least 8 characters.",
        invalid_credentials: "Wrong email or password.",
        invalid_code: "The code is wrong or has expired. Check it or request a new one.",
        user_already_exists: "An account with this email already exists. Try signing in.",
        rate_limited: "Too many attempts. Please try again shortly.",
        confirm: "The confirmation link is invalid or has expired.",
        unknown: "Something went wrong. Please try again.",
      },
    },
  },
};

/**
 * Дедлайн по рижскому времени: "24.11.2026 09:00".
 * Числовой формат собираем из частей вручную — одинаковый результат на сервере (Node)
 * и в браузере, без расхождений при гидрации.
 */
export function formatDeadline(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}

/** "• Būtība: текст" → { label: "Būtība", text: "текст" } */
export function parseSummaryLines(summary: string): { label: string | null; text: string }[] {
  return summary
    .split("\n")
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([^:]{1,40}):\s*(.+)$/);
      return m ? { label: m[1], text: m[2] } : { label: null, text: line };
    });
}
