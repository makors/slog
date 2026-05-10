"use client";

import { DropdownMenu } from "radix-ui";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Kbd } from "@/components/ui/kbd";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initial = user.name?.trim()?.charAt(0) || user.email.charAt(0);

  const handleSignOut = () => {
    startTransition(async () => {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/");
            router.refresh(); // clears "weird" state from better auth
          },
        },
      });
    });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            "size-8 overflow-hidden rounded-full ring-1 ring-border outline-none transition",
            "hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/40",
            "data-[state=open]:ring-foreground/40",
          )}
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex size-full items-center justify-center bg-muted text-[12px] font-medium uppercase tracking-tight text-foreground">
              {initial}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          collisionPadding={12}
          onKeyDown={(e) => {
            if (e.key === "s") handleSignOut();
          }}
          className={cn(
            "z-50 min-w-56 origin-[var(--radix-dropdown-menu-content-transform-origin)]",
            "overflow-hidden rounded-md border border-border bg-popover text-popover-foreground",
            "shadow-[0_8px_24px_rgba(0,0,0,0.6)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <div className="flex flex-col gap-1 px-3 py-2.5">
            <span className="truncate text-[13px] leading-none font-medium text-foreground">
              {user.name}
            </span>
            <span className="truncate text-[12px] leading-none text-muted-foreground">
              {user.email}
            </span>
          </div>

          <DropdownMenu.Separator className="h-px bg-border" />

          <div className="p-1">
            <DropdownMenu.Item
              disabled={isPending}
              onSelect={(event) => {
                event.preventDefault();
                handleSignOut();
              }}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between rounded-sm px-2.5 py-1.5",
                "text-[13px] text-foreground outline-none select-none",
                "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
              )}
            >
              <span>Sign out</span>
              <Kbd>{isPending ? "…" : "s"}</Kbd>
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
