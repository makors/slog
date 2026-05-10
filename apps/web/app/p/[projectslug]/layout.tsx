import Link from "next/link";
import { notFound } from "next/navigation";

import { isProjectSlug } from "@/lib/project-slug";
import { getCachedPublicProject } from "@/lib/public-changelog";

import { ProjectHeader } from "./_components/project-header";

export const dynamic = "force-static";
export const revalidate = false;

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ projectslug: string }>;
  children: React.ReactNode;
}) {
  const { projectslug } = await params;
  if (!isProjectSlug(projectslug)) notFound();

  const row = await getCachedPublicProject(projectslug);

  if (!row) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <ProjectHeader
        name={row.name}
        displayName={row.displayName}
      />
      <div className="flex-1">{children}</div>
      <footer className="mt-12 border-t border-border/40">
        <div className="mx-auto w-full max-w-4xl px-6 py-6">
          <p className="text-xs text-muted-foreground/60">
            generated with{" "}
            <Link
              href="https://github.com/makors/slog"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/40"
            >
              slog
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
