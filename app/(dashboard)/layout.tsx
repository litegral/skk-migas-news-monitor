import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSidebarCollapsed } from "@/lib/actions/sidebar";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  // Read sidebar state from cookie (server-side)
  const sidebarCollapsed = await getSidebarCollapsed();

  return (
    <DashboardShell initialCollapsed={sidebarCollapsed}>
      {children}
    </DashboardShell>
  );
}
