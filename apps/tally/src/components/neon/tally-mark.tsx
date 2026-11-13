import { useId } from "react";
import { cn } from "cn";

type TallyMarkSize = "small" | "medium" | "large";

const PIXELS_BY_SIZE: Record<TallyMarkSize, number> = { small: 24, medium: 36, large: 48 };

export function TallyMark({
  size = "medium",
  className,
}: {
  size?: TallyMarkSize;
  className?: string;
}) {
  const gradientId = `tally-grad-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const pixels = PIXELS_BY_SIZE[size];
  return (
    <svg
      viewBox="0 0 64 64"
      width={pixels}
      height={pixels}
      aria-hidden="true"
      focusable="false"
      className={cn("tally-mark", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--neon-pink)" }} />
          <stop offset="1" style={{ stopColor: "var(--neon-amber)" }} />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="18"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.5"
      />
      <g stroke={`url(#${gradientId})`} strokeWidth="4.5" strokeLinecap="round" fill="none">
        <path d="M18 18v28M26 17v29M34 18v28M42 17v29" />
        <path d="M12 40L50 22" />
      </g>
      <circle cx="50" cy="22" r="3" className="fill-neon-amber" />
    </svg>
  );
}
