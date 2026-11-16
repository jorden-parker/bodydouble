import type { ReactNode } from "react";
import { Otter } from "@/components/neon/otter";

type EmptyStateProps = { children: ReactNode };

export function EmptyState({ children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line-soft bg-surface p-8 text-center text-sm text-fg-muted">
      <Otter isFloating />
      <p className="max-w-prose text-balance">{children}</p>
    </div>
  );
}
