import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[120px]"
      />

      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center text-lg">
          <Wordmark />
        </Link>

        {children}
      </div>
    </main>
  );
}
