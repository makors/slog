import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-lg border text-card-foreground transition-colors",
  {
    variants: {
      tone: {
        default: "border-border bg-card/30",
        elevated:
          "border-border bg-card/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        dashed: "border-dashed border-border/70 bg-transparent",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

function Card({
  className,
  tone,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof cardVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="card"
      data-tone={tone ?? "default"}
      className={cn(cardVariants({ tone }), className)}
      {...props}
    />
  );
}

export { Card, cardVariants };
