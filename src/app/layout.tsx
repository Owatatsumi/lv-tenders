import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BackgroundGlow } from "@/components/background-glow";
import { LocaleProvider } from "@/components/locale-provider";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// latin-ext — латышские ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž; cyrillic — русская версия интерфейса
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

export const metadata: Metadata = {
  title: "LV Tenders — Latvijas publiskie iepirkumi",
  description: "Jaunākie Latvijas publiskie iepirkumi ar AI kopsavilkumu latviešu, krievu un angļu valodā.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes ставит класс темы на <html> до гидрации
    <html
      lang="lv"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="scanlines min-h-full flex flex-col font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {/* язык в layout — не сбрасывается при переходах между страницами */}
          <LocaleProvider>
            {/* overflow-clip, а не overflow-hidden: обрезает свечение (без горизонтального скролла),
                но не создаёт область прокрутки — иначе перестанет работать sticky-шапка */}
            <div className="relative isolate flex flex-1 flex-col overflow-clip">
              <BackgroundGlow />
              <SiteHeader />
              {children}
            </div>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
