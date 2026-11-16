import * as React from "react";
import { cn } from "cn";

const CARD_CLASS =
  "flex min-w-0 flex-col gap-4 rounded-xl border border-line-soft bg-card p-4 text-sm text-card-foreground sm:p-6";

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(CARD_CLASS, "data-[size=sm]:p-4", className)}
      {...props}
    />
  );
}

export { Card, CARD_CLASS };
