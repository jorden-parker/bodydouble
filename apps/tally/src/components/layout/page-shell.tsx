import type { ReactNode } from "react";
import { cn } from "cn";
import { Alert } from "@/components/ui/alert";

type PageShellProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <main id="main" className="app-main">
      <header className="flex flex-none flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="page-title">{title}</h1>
          {description ? <div className="text-muted-foreground">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </header>
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
    </main>
  );
}

type SectionHeadingProps = {
  title: string;
  count?: number;
  level?: 2 | 3;
  className?: string;
};

export function SectionHeading({ title, count, level = 2, className }: SectionHeadingProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <Heading
      className={cn("flex items-center gap-2 font-semibold tracking-tight", "text-base", className)}
    >
      {title}
      {count === undefined ? null : (
        <>
          {" "}
          <span className="sr-only">(</span>
          <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground tabular-nums">
            {count}
          </span>
          <span className="sr-only">)</span>
        </>
      )}
    </Heading>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-line-soft bg-surface p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function ProblemAlert({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive-surface px-4 py-3">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </Alert>
  );
}

export function LoadingNote() {
  return (
    <p aria-live="polite" className="text-sm text-muted-foreground">
      Sharpening pencils…
    </p>
  );
}
