"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * next-themes вставляет inline-<script>, который ставит класс темы на <html> до первой отрисовки
 * (без «вспышки» светлой темы). Скрипт должен выполниться только из HTML с сервера.
 * На клиенте React 19 ругается на <script> внутри компонента («Encountered a script tag…»),
 * поэтому при клиентском рендере помечаем его как неисполняемые данные — поведение не меняется.
 */
const scriptProps =
  typeof window === "undefined" ? undefined : ({ type: "application/json" } as const);

/** Глобальная тема: next-themes ставит класс `dark` на <html> и помнит выбор в localStorage. */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider scriptProps={scriptProps} {...props} />;
}
