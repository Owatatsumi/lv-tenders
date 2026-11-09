import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    <html
      lang="lv"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
