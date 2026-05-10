import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";

import { CliPreview } from "@/components/cli-preview";
import { CreateProjectButton } from "@/components/create-project-button";
import { project, projectRelease } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectPublicUrl } from "@/lib/public-url";

import { ProjectsList, type Project } from "./_components/projects-list";
import { WhatsNextPeek } from "./_components/whats-next-peek";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login?callbackURL=/dashboard");
  }

  const userId = session.user.id;

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(eq(project.ownerUserId, userId))
    .orderBy(desc(project.createdAt));

  if (rows.length === 0) {
    return <EmptyState />;
  }

  const releases = await db
    .select({
      projectId: projectRelease.projectId,
      version: projectRelease.version,
      publishedAt: projectRelease.publishedAt,
    })
    .from(projectRelease)
    .where(inArray(projectRelease.projectId, rows.map((p) => p.id)))
    .orderBy(desc(projectRelease.publishedAt));

  const latestReleaseByProjectId = new Map<
    string,
    { version: string; publishedAt: Date }
  >();
  for (const release of releases) {
    if (!latestReleaseByProjectId.has(release.projectId)) {
      latestReleaseByProjectId.set(release.projectId, {
        version: release.version,
        publishedAt: release.publishedAt,
      });
    }
  }

  const projects: Project[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    url: projectPublicUrl(p.id),
    publishedVersion: latestReleaseByProjectId.get(p.id)?.version ?? null,
    publishedAt: latestReleaseByProjectId.get(p.id)?.publishedAt ?? null,
  }));

  return <ProjectsView projects={projects} />;
}

function ProjectsView({ projects }: { projects: Project[] }) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-6 pt-14">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl leading-none font-medium tracking-tight text-foreground">
          Your changelogs
        </h1>
        <CreateProjectButton />
      </header>

      <ProjectsList projects={projects} />

      <WhatsNextPeek />
    </section>
  );
}

function EmptyState() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-9 px-6 pt-16 pb-20">
      <CliPreview />

      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-base font-medium tracking-tight text-foreground">
            Ready to start shipping?
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Connect a Git repo to start publishing changelogs.
          </p>
        </div>

        <CreateProjectButton />
      </div>
    </section>
  );
}
