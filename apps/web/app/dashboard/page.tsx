import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";

import { CliPreview } from "@/components/cli-preview";
import { CreateChangelogButton } from "@/components/create-changelog-button";
import { CreateProjectButton } from "@/components/create-project-button";
import { Card } from "@/components/ui/card";
import { project } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  // The dashboard layout redirects unauthenticated requests, so session is non-null here.
  const userId = session!.user.id;

  const projects = await db
    .select({
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(eq(project.ownerUserId, userId))
    .orderBy(desc(project.createdAt));

  if (projects.length === 0) {
    return <EmptyState />;
  }

  return <ProjectsView projects={projects} />;
}

function EmptyState() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 pt-14 pb-20">
      <CliPreview />

      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="text-[15px] font-medium tracking-tight text-foreground">
            Ready to start shipping?
          </h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Connect a Git repo to start publishing changelogs.
          </p>
        </div>

        <CreateProjectButton />
      </div>
    </section>
  );
}

function ProjectsView({
  projects,
}: {
  projects: { id: string; name: string; createdAt: Date }[];
}) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[15px] font-medium tracking-tight text-foreground">
            Projects
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {projects.length === 1
              ? "1 project wired up"
              : `${projects.length} projects wired up`}
          </p>
        </div>
        <CreateChangelogButton />
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {projects.map((p) => (
            <li
              key={p.id}
              className={cn(
                "group flex items-center justify-between gap-4 px-4 py-3.5",
                "transition-colors hover:bg-muted/40",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full bg-foreground/40 transition-colors group-hover:bg-foreground/70"
                />
                <span className="truncate text-[13.5px] font-medium tracking-tight text-foreground">
                  {p.name}
                </span>
              </div>
              <span className="shrink-0 font-mono text-[11px] tracking-tight text-muted-foreground/80 tabular-nums">
                {formatRelative(p.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.round(hour / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.round(day / 7);
  if (week < 5) return `${week}w ago`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}mo ago`;
  const year = Math.round(day / 365);
  return `${year}y ago`;
}
