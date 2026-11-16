"use client";

import type { PanelSide } from "./panel-width";
import { PANEL_WIDTH } from "./panel-width";
import type { usePanelWidth } from "./use-panel-width";

type PanelSizing = ReturnType<typeof usePanelWidth>;

const HANDLE_EDGE: Record<PanelSide, string> = {
  left: "-right-1",
  right: "-left-1",
};

export function PanelResizeHandle({ sizing, side }: { sizing: PanelSizing; side: PanelSide }) {
  const { width, dragging, maxWidth, handlers } = sizing;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Resize path" : "Resize companion"}
      aria-valuenow={width}
      aria-valuemin={PANEL_WIDTH.min}
      aria-valuemax={maxWidth}
      tabIndex={0}
      title="Drag to resize. Double-click to fit the content"
      data-dragging={dragging || undefined}
      className={`group/resize absolute inset-y-0 ${HANDLE_EDGE[side]} z-10 flex w-2 cursor-col-resize touch-none justify-center`}
      {...handlers}
    >
      <span className="h-full w-px bg-transparent transition-colors duration-calm group-hover/resize:bg-primary/60 group-focus-visible/resize:bg-primary group-data-dragging/resize:bg-primary" />
      <span className="absolute top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-border opacity-0 transition-opacity duration-calm group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100 group-data-dragging/resize:bg-primary group-data-dragging/resize:opacity-100" />
    </div>
  );
}
