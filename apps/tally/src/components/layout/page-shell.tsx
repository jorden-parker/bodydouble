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
    <main className="app-main">
      <header className="flex flex-none flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {description ? <div className="text-muted-foreground">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
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
      className={cn(
        "flex items-center gap-2 font-semibold tracking-tight",
        level === 2 ? "text-xl" : "text-base",
        className,
      )}
    >
      {title}
      {count === undefined ? null : (
        <>
          {" "}
          <span className="sr-only">(</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
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
    <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function ProblemAlert({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <Alert
      variant="destructive"
      className="max-w-2xl border-destructive/30 bg-destructive-surface px-4 py-3"
    >
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </Alert>
  );
}

export function LoadingNote() {
  return (
    <p aria-live="polite" className="font-hand text-2xl text-muted-foreground">
      Sharpening pencils…
    </p>
  );
}
