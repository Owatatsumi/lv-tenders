import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Ienākt — LV Tenders" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
      {/* AuthForm читает ?error=… через useSearchParams — это данные запроса, нужен Suspense */}
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
