import Link from "next/link";
import { Suspense } from "react";

import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { UserMenu } from "@/components/user-menu";

interface HeaderProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
      <div className="flex h-16 items-center justify-between px-5">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard"
            className="text-[19px] leading-none font-medium tracking-normal text-foreground"
          >
            slog
          </Link>
          <Suspense fallback={null}>
            <DashboardBreadcrumbs />
          </Suspense>
        </div>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
