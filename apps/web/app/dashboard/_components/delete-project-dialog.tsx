"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { deleteProject } from "@/lib/project-actions";
import { cn } from "@/lib/utils";

interface DeleteProjectDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteProjectDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: DeleteProjectDialogProps) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isMatch = value === projectName;

  React.useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setValue("");
      setError(null);
      setIsPending(false);
    }
    onOpenChange(nextOpen);
  }

  async function handleDelete() {
    if (!isMatch || isPending) return;
    setIsPending(true);
    setError(null);

    try {
      const result = await deleteProject(projectId);
      if ("error" in result) {
        setError(result.error);
        setIsPending(false);
        return;
      }
      handleOpenChange(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setIsPending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && isMatch && !isPending) {
      e.preventDefault();
      void handleDelete();
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <Dialog.Content
          onKeyDown={handleKeyDown}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-border bg-popover shadow-[0_16px_48px_rgba(0,0,0,0.7)]",
            "outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1.5">
              <Dialog.Title className="text-sm font-semibold leading-snug tracking-tight text-foreground">
                Delete &ldquo;{projectName}&rdquo;
              </Dialog.Title>
              <Dialog.Description className="text-xs leading-relaxed text-muted-foreground">
                This will permanently delete the project, its tokens, and its
                published changelog. This action cannot be undone.
              </Dialog.Description>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="confirm-name"
                className="text-xs font-medium tracking-tight text-muted-foreground"
              >
                Type{" "}
                <span className="font-mono text-foreground">{projectName}</span>{" "}
                to confirm
              </label>
              <input
                ref={inputRef}
                id="confirm-name"
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2",
                  "text-xs text-foreground placeholder:text-muted-foreground/40",
                  "outline-none transition-[border-color,box-shadow]",
                  "focus:border-ring focus:ring-3 focus:ring-ring/20",
                  error
                    ? "border-destructive ring-3 ring-destructive/20"
                    : "border-border",
                )}
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border/60 px-6 py-4">
            <Dialog.Close asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isPending}
              >
                Cancel
                <Kbd variant="outline" className="ml-auto">
                  Esc
                </Kbd>
              </Button>
            </Dialog.Close>

            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              disabled={!isMatch || isPending}
              onClick={() => void handleDelete()}
            >
              {isPending ? "Deleting…" : "Delete project"}
              <Kbd
                variant="outline"
                className={cn(
                  "ml-auto transition-opacity",
                  isMatch && !isPending ? "opacity-100" : "opacity-40",
                )}
              >
                ↵
              </Kbd>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
