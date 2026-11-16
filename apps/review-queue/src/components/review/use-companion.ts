"use client";

import { useCallback, useState } from "react";
import type { PanelSide } from "./panel-width";

export type CompanionTab = "ask" | "notes" | "context";
export type CompanionSection = "symbols" | "outline" | "files" | "map" | "github";
export type RegionOpen = Record<PanelSide, boolean>;

const NARROW_QUERY = "(max-width: 63.99rem)";

function isNarrow(): boolean {
  return window.matchMedia?.(NARROW_QUERY).matches ?? false;
}

function withSideOpen(current: RegionOpen, side: PanelSide, isOpen: boolean): RegionOpen {
  const other: PanelSide = side === "left" ? "right" : "left";
  const closesOther = isOpen && isNarrow();
  return { ...current, [side]: isOpen, [other]: closesOther ? false : current[other] };
}

export function useCompanion() {
  const [open, setOpen] = useState<RegionOpen>(() =>
    isNarrow() ? { left: false, right: false } : { left: true, right: true },
  );
  const [tab, setTab] = useState<CompanionTab>("ask");
  const [contextView, setContextView] = useState<CompanionSection>("symbols");

  const setSideOpen = useCallback((side: PanelSide, isOpen: boolean) => {
    setOpen((current) => withSideOpen(current, side, isOpen));
  }, []);

  const toggleSide = useCallback(
    (side: PanelSide) => setOpen((current) => withSideOpen(current, side, !current[side])),
    [],
  );

  const toggleBoth = useCallback(
    () =>
      setOpen((current) =>
        current.left || current.right ? { left: false, right: false } : { left: true, right: true },
      ),
    [],
  );

  const showTab = useCallback(
    (nextTab: CompanionTab) => {
      setTab(nextTab);
      setSideOpen("right", true);
    },
    [setSideOpen],
  );

  const showContextView = useCallback(
    (view: CompanionSection) => {
      setContextView(view);
      setTab("context");
      setSideOpen("right", true);
    },
    [setSideOpen],
  );

  const closeOverlays = useCallback(() => {
    if (isNarrow()) setOpen({ left: false, right: false });
  }, []);

  return {
    regionOpen: open,
    setSideOpen,
    toggleSide,
    toggleBoth,
    closeOverlays,
    tab,
    showTab,
    contextView,
    showContextView,
  };
}
