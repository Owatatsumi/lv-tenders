"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "./locale-provider";

type ThemeOption = "light" | "dark" | "system";

const OPTIONS: { value: ThemeOption; icon: LucideIcon }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

/** true только в браузере после гидрации: на сервере выбранная тема неизвестна. */
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Настройки отображения: глобальная тема через next-themes (`setTheme` меняет класс на <html>
 * и сохраняет выбор), без локального стейта.
 */
export function Preferences() {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const mounted = useMounted();

  return (
    <div role="group" aria-label={t.theme} className="flex shrink-0 items-center gap-0.5 rounded-lg border bg-background/50 p-0.5">
      {OPTIONS.map(({ value, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <Button
            key={value}
            size="icon-sm"
            variant={active ? "default" : "ghost"}
            aria-pressed={active}
            aria-label={t.themes[value]}
            title={t.themes[value]}
            onClick={() => setTheme(value)}
            className="size-7"
          >
            <Icon aria-hidden />
          </Button>
        );
      })}
    </div>
  );
}
