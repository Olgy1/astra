import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { AdminNav } from "./admin-nav";

/**
 * Layout du panel admin.
 *
 * La garde est double : le middleware redirige les non-connectés, ce layout
 * relit la base et refuse les membres. Un membre qui forgerait un lien
 * /admin/* atterrirait ici, pas sur la page.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/panel");

  return (
    <div className="flex min-h-dvh">
      <AdminNav username={user.username} />
      <main className="min-w-0 flex-1 px-6 pb-24 pt-8 sm:px-8 lg:px-12 lg:pb-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
