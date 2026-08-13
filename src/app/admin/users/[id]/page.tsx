import type { Metadata } from "next";
import { UserDetailView } from "./user-detail-view";

export const metadata: Metadata = { title: "Administration — Utilisateur" };

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6">
      <UserDetailView userId={id} />
    </div>
  );
}
