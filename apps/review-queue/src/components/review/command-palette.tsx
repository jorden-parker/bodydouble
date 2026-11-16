"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { AppDialog } from "@/components/common/app-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Input } from "@/components/ui/input";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Workspace } from "./use-workspace";

type PaletteItem = { key: string; group: string; label: string; run: () => void };

export function usePaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);
}

function paletteItems(review: ReviewPayload, workspace: Workspace): PaletteItem[] {
  const steps: PaletteItem[] = review.steps.map((step, index) => ({
    key: step.id,
    group: "Go to",
    label: `Step ${index + 1}: ${step.title}`,
    run: () => workspace.selectStep(step.id),
  }));
  return [
    { key: "brief", group: "Go to", label: "Brief", run: workspace.goToBrief },
    ...steps,
    { key: "wrap", group: "Go to", label: "Wrap up", run: workspace.goToWrap },
    {
      key: "files",
      group: "Open",
      label: "Files in this PR",
      run: () => workspace.showContextView("files"),
    },
    {
      key: "outline",
      group: "Open",
      label: "Outline of this step",
      run: () => workspace.showContextView("outline"),
    },
    { key: "map", group: "Open", label: "Map: how the changes fit", run: workspace.focusMap },
    {
      key: "github",
      group: "Open",
      label: "GitHub threads",
      run: () => workspace.showContextView("github"),
    },
    {
      key: "hotspots",
      group: "Open",
      label: "Hotspots in this step",
      run: workspace.focusHotspots,
    },
    {
      key: "shortcuts",
      group: "Open",
      label: "Keyboard shortcuts",
      run: () => workspace.setDialog("help"),
    },
    {
      key: "start-over",
      group: "Session",
      label: "Start over",
      run: () => workspace.setDialog("start-over"),
    },
  ];
}

function focusNeighbour(event: KeyboardEvent<HTMLButtonElement>, step: 1 | -1) {
  const buttons = Array.from(
    event.currentTarget.closest("ul")?.querySelectorAll<HTMLButtonElement>("button") ?? [],
  );
  const position = buttons.indexOf(event.currentTarget) + step;
  event.preventDefault();
  if (position < 0) event.currentTarget.closest("[role=dialog]")?.querySelector("input")?.focus();
  else buttons[position]?.focus();
}

export function CommandPalette({
  review,
  workspace,
}: {
  review: ReviewPayload;
  workspace: Workspace;
}) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const needle = query.trim().toLowerCase();
  const matches = paletteItems(review, workspace).filter((paletteItem) =>
    paletteItem.label.toLowerCase().includes(needle),
  );
  const choose = (paletteItem: PaletteItem) => {
    workspace.closePalette();
    paletteItem.run();
  };
  return (
    <AppDialog title="Command palette" onClose={workspace.closePalette} wide>
      <Input
        autoFocus
        aria-label="Search commands"
        placeholder="Jump to a step, or open files, outline, map, GitHub"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            listRef.current?.querySelector("button")?.focus();
          }
        }}
      />
      <ul
        ref={listRef}
        aria-label="Commands"
        className="flex max-h-96 flex-col gap-0.5 overflow-y-auto"
      >
        {matches.map((paletteItem) => (
          <li key={paletteItem.key}>
            <button
              type="button"
              onClick={() => choose(paletteItem)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") focusNeighbour(event, 1);
                if (event.key === "ArrowUp") focusNeighbour(event, -1);
              }}
              className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className="min-w-0 truncate">{paletteItem.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{paletteItem.group}</span>
            </button>
          </li>
        ))}
      </ul>
      {matches.length === 0 && <EmptyState>No command matches “{query.trim()}”.</EmptyState>}
    </AppDialog>
  );
}
