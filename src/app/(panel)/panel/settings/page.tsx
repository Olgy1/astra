import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { AccountSettings } from "./account-settings";

export const metadata: Metadata = { title: "Paramètres du compte" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/panel/settings");

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center gap-3">
        <Link href="/panel" className="text-content-muted hover:text-content-primary" aria-label="Retour">
          <svg viewBox="0 0 24 24" className="size-5 fill-current"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
        </Link>
        <h1 className="text-xl font-semibold">Paramètres du compte</h1>
      </header>

      <AccountSettings
        user={{
          username: user.username,
          email: user.email,
          emailVerified: user.emailVerified,
          twoFactorEnabled: user.twoFactorEnabled,
          discordLinked: Boolean(user.discordId),
        }}
      />
    </main>
  );
}
