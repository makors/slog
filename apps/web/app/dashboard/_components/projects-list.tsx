"use client";

import * as React from "react";
import { DropdownMenu } from "radix-ui";
import { ArrowUpRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

import { DeleteProjectDialog } from "./delete-project-dialog";
import { TokensDialog } from "./tokens-dialog";

export interface Project {
  id: string;
  name: string;
  url: string;
  publishedVersion: string | null;
  publishedAt: Date | null;
}

export function ProjectsList({ projects }: { projects: Project[] }) {
  return (
    <ul role="list" className="flex flex-col divide-y divide-border/30">
      {projects.map((project) => (
        <ProjectRow key={project.id} project={project} />
      ))}
    </ul>
  );
}

function ProjectRow({ project }: { project: Project }) {
  return (
    <li className="group/row relative flex items-center gap-5 px-3 py-4 -mx-3 rounded-md transition-colors hover:bg-muted/30">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-sm leading-none font-medium tracking-tight text-foreground">
          {project.name}
        </span>
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "group/link inline-flex w-fit items-center gap-1 rounded-sm",
            "text-[13px] leading-none text-muted-foreground/70",
            "outline-none transition-colors",
            "hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring/40",
          )}
        >
          <span className="truncate">{project.url}</span>
          <ArrowUpRight
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 opacity-60 transition-all duration-150",
              "group-hover/link:opacity-100",
              "group-hover/link:translate-x-px group-hover/link:-translate-y-px",
            )}
          />
        </a>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 text-[13px] tracking-tight tabular-nums">
        {project.publishedVersion ? (
          <>
            <span
              title={`Published ${project.publishedVersion}`}
              className="max-w-28 truncate font-medium text-foreground"
            >
              {project.publishedVersion}
            </span>
            {project.publishedAt ? (
              <span className="text-muted-foreground/60">
                Last published {formatRelative(project.publishedAt)}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground/60">Not published yet</span>
        )}
      </div>

      <ProjectMenu projectId={project.id} projectName={project.name} />
    </li>
  );
}

function ProjectMenu({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [tokensOpen, setTokensOpen] = React.useState(false);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${projectName}`}
            className={cn(
              "flex size-8 items-center justify-center rounded-md",
              "text-muted-foreground/50 outline-none transition-colors",
              "hover:bg-muted hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring/40",
              "data-[state=open]:bg-muted data-[state=open]:text-foreground",
            )}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            collisionPadding={12}
            className={cn(
              "z-50 min-w-48 origin-[var(--radix-dropdown-menu-content-transform-origin)]",
              "overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground",
              "shadow-[0_8px_24px_rgba(0,0,0,0.6)]",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            )}
          >
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                setTokensOpen(true);
              }}
              className={cn(
                "flex cursor-pointer items-center rounded-sm px-2.5 py-1.5",
                "text-[13px] text-foreground outline-none select-none",
                "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
              )}
            >
              Manage tokens
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                setDeleteOpen(true);
              }}
              className={cn(
                "flex cursor-pointer items-center rounded-sm px-2.5 py-1.5",
                "text-[13px] text-destructive outline-none select-none",
                "data-[highlighted]:bg-destructive/15 data-[highlighted]:text-destructive",
              )}
            >
              Delete project
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DeleteProjectDialog
        projectId={projectId}
        projectName={projectName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />

      <TokensDialog
        projectId={projectId}
        projectName={projectName}
        open={tokensOpen}
        onOpenChange={setTokensOpen}
      />
    </>
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
