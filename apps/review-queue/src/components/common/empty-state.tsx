import type { ReactNode } from "react";

type EmptyStateProps = { emoji: string; children: ReactNode };

export function EmptyState({ emoji, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line-soft bg-surface p-8 text-center text-sm text-fg-muted">
      <span aria-hidden className="text-2xl leading-none">
        {emoji}
      </span>
      <p className="max-w-prose text-balance">{children}</p>
    </div>
  );
}
