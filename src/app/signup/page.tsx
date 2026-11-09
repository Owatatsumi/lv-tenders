import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Reģistrācija — LV Tenders" };

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
