import { headers } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Header } from "@/components/header";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage slog projects and publish developer-focused changelogs.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <Header user={session.user} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
