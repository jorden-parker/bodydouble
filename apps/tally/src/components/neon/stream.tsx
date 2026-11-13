import type { CSSProperties } from "react";
import { cn } from "cn";
import { TallyMark } from "@/components/neon/tally-mark";

type StreamStep = { label: string };

type StreamProps = {
  steps: StreamStep[];
  current: number;
  variant?: "labels" | "small";
  label: string;
  className?: string;
};

export function Stream({ steps, current, variant = "labels", label, className }: StreamProps) {
  if (steps.length === 0) return null;
  const lastIndex = steps.length - 1;
  const currentIndex = Math.min(Math.max(current, 0), lastIndex);
  const progress = (currentIndex / Math.max(lastIndex, 1)) * 100;
  const style = { "--progress": `${progress}%` } as CSSProperties;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuenow={currentIndex + 1}
      aria-valuetext={steps[currentIndex].label}
      className={cn(
        "stream stream--tally",
        variant === "small" ? "stream--small" : "stream--labels",
        className,
      )}
      style={style}
    >
      <div className="stream__water">
        <div className="stream__flow" />
      </div>
      <ol className="stream__stops">
        {steps.map((step, index) => (
          <li
            key={`${index}-${step.label}`}
            className={cn(
              "stream__stop",
              index < currentIndex && "is-done",
              index === currentIndex && "is-current",
            )}
            style={{ "--at": `${(index / Math.max(lastIndex, 1)) * 100}%` } as CSSProperties}
          >
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      <span className="stream__rider" aria-hidden="true">
        <TallyMark size="medium" />
      </span>
    </div>
  );
}
