import { DashboardApp } from "@/components/dashboard-app";
import { getAuthorizedWorkspaceSnapshot } from "@/lib/dal";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await getAuthorizedWorkspaceSnapshot();
  if (!snapshot) redirect("/login");
  return <DashboardApp initialSnapshot={snapshot} />;
}
