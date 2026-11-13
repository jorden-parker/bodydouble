import type { CSSProperties } from "react";
import { cn } from "cn";
import { Otter } from "./otter";

type StreamStep = { label: string };

type StreamProps = {
  steps: StreamStep[];
  currentIndex: number;
  label: string;
  variant?: "labels" | "small";
  className?: string;
};

function percentAlong(index: number, count: number): string {
  if (count < 2) {
    return "0%";
  }
  return `${Number(((index / (count - 1)) * 100).toFixed(2))}%`;
}

export function Stream({ steps, currentIndex, label, variant = "labels", className }: StreamProps) {
  const isSmall = variant === "small";
  const progressStyle = {
    "--progress": percentAlong(currentIndex, steps.length),
  } as CSSProperties;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuenow={currentIndex + 1}
      aria-valuetext={steps[currentIndex]?.label}
      className={cn("stream", isSmall ? "stream--small" : "stream--labels", className)}
      style={progressStyle}
    >
      <div className="stream__water" aria-hidden="true">
        <div className="stream__flow" />
      </div>
      <ol className="stream__stops">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={cn(
              "stream__stop",
              index < currentIndex && "is-done",
              index === currentIndex && "is-current",
            )}
            style={{ "--at": percentAlong(index, steps.length) } as CSSProperties}
          >
            {!isSmall && <span>{step.label}</span>}
          </li>
        ))}
      </ol>
      <span className="stream__rider">
        <Otter size={isSmall ? "medium" : "large"} className="animate-bob" />
      </span>
    </div>
  );
}
