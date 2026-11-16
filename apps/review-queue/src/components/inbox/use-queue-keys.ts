"use client";

import { type RefObject, useEffect } from "react";
import { nextRowIndex, queueKeyAction } from "./queue-keys";

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return (
    !!element &&
    (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
  );
}

function visibleRows(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-queue-row]")].filter(
    (row) => row.closest("details:not([open])") === null,
  );
}

function focusedRowIndex(rows: HTMLElement[]): number {
  return rows.findIndex((row) => row.contains(document.activeElement));
}

function moveFocus(rows: HTMLElement[], step: number): void {
  const target = rows[nextRowIndex(focusedRowIndex(rows), rows.length, step)];
  target?.querySelector<HTMLElement>("[data-queue-open]")?.focus();
  target?.scrollIntoView({ block: "nearest" });
}

function runAction(root: HTMLElement, action: string): void {
  if (action === "refresh") {
    root.querySelector<HTMLButtonElement>("[data-queue-refresh]")?.click();
    return;
  }
  const rows = visibleRows(root);
  if (action === "next" || action === "previous") {
    moveFocus(rows, action === "next" ? 1 : -1);
    return;
  }
  const focused = rows[focusedRowIndex(rows)];
  focused?.querySelector<HTMLButtonElement>(`[data-queue-action="${action}"]`)?.click();
}

export function useQueueKeys(container: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const root = container.current;
      const action = queueKeyAction({
        key: event.key,
        hasModifier: event.metaKey || event.ctrlKey || event.altKey,
        isTyping: isTyping(event.target),
      });
      if (!root || !action) return;
      event.preventDefault();
      runAction(root, action);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [container]);
}
