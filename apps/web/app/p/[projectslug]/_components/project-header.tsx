interface ProjectHeaderProps {
  name: string;
  displayName: string | null;
}

export function ProjectHeader({ name, displayName }: ProjectHeaderProps) {
  const label = displayName?.trim() || name;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-4xl items-center px-6">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold tracking-tight text-foreground">
            {label}
          </span>
          <span className="text-base font-normal text-muted-foreground/50" aria-hidden>
            /
          </span>
          <span className="text-base font-normal text-muted-foreground">
            Changelog
          </span>
        </div>
      </div>
    </header>
  );
}
