"use client";

import { usePathname } from "next/navigation";

interface BreadcrumbSegment {
  label: string;
}

const BREADCRUMBS: Record<string, BreadcrumbSegment[]> = {
  "/dashboard": [{ label: "Dashboard" }],
  "/dashboard/new": [{ label: "New project" }],
};

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const segments = BREADCRUMBS[pathname] ?? [];

  return segments.map((seg) => (
    <span key={seg.label} className="flex items-center gap-3.5">
      <span
        aria-hidden
        className="text-[17px] leading-none text-muted-foreground/35 select-none"
      >
        /
      </span>
      <span className="text-[15px] leading-none font-medium tracking-tight text-foreground/70">
        {seg.label}
      </span>
    </span>
  ));
}
