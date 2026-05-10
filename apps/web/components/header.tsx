import Link from "next/link";
import { BookOpen } from "lucide-react";
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
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background">
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
        <div className="flex items-center gap-2">
          <Link
            href="https://github.com/makors/slog/blob/main/README.md"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Guide"
            className="flex items-center justify-center size-8 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen size={15} />
          </Link>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
