import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const kbdVariants = cva(
  "font-mono leading-none tracking-tight tabular-nums select-none",
  {
    variants: {
      variant: {
        // For use on the page background (dropdown items, list cells).
        subtle: "text-muted-foreground",
        // For use on top of a foreground-colored surface (primary buttons).
        inverse: "text-background/55",
        // Pill-style for inline mentions in copy.
        outline:
          "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border bg-muted/60 px-1 text-foreground/85",
      },
      size: {
        default: "text-[11px]",
        xs: "text-[10px]",
      },
    },
    defaultVariants: { variant: "subtle", size: "default" },
  },
);

function Kbd({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(kbdVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Kbd, kbdVariants };
