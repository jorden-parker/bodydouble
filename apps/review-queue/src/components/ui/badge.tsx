import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const badgeVariants = cva(
  "group/badge inline-flex min-h-6 w-fit max-w-full shrink-0 items-center justify-center gap-1 rounded-sm border border-transparent px-2 py-0.5 text-label font-medium tabular-nums whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-surface-2 text-fg",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border-line text-fg-muted",
        ghost: "text-fg-muted hover:bg-surface-2",
        link: "text-fg underline-offset-4 hover:underline",
        blue: "bg-tint-blue text-ink-blue",
        pink: "bg-tint-pink text-ink-pink",
        amber: "bg-tint-amber text-ink-amber",
        mint: "bg-tint-mint text-ink-mint",
        coral: "bg-tint-coral text-ink-coral",
        violet: "bg-tint-violet text-ink-violet",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge };
