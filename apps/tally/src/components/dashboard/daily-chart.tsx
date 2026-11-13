"use client";

import { useState, type CSSProperties } from "react";
import type { DailyPoint } from "@/lib/metrics/summary";
import { formatDay } from "./format";

const PLOT_UNITS = 100;
const COLUMN_WIDTH = 20;
const BAR_WIDTH = 7;
const BAR_GAP = 2;
const BAR_RADIUS = 1.5;
const MIN_SCALE = 4;
const LABEL_EVERY = 7;
const EDGE_ZONE_PERCENT = 25;
const SCRIBBLE_PATH =
  "M7 2.5C10.5 2 12.6 4.6 12 7.8 11.4 11 8.2 12.4 5.4 11.6 2.6 10.8 1.5 7.6 2.8 5 3.9 2.9 6.2 2.1 8.4 2.9";

type DailyChartProps = { points: DailyPoint[] };

type SeriesBarProps = { x: number; value: number; scale: number; className: string };

function SeriesBar({ x, value, scale, className }: SeriesBarProps) {
  if (value === 0) return null;
  const height = (value / scale) * PLOT_UNITS;
  return (
    <rect
      x={x}
      y={PLOT_UNITS - height}
      width={BAR_WIDTH}
      height={height}
      rx={BAR_RADIUS}
      className={className}
    />
  );
}

function describe(point: DailyPoint): string {
  return `${formatDay(point.day)}: ${point.reviewed} reviewed, ${point.created} created`;
}

function ScribbleSwatch({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      aria-hidden="true"
      className={`size-4 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
    >
      <path d={SCRIBBLE_PATH} fill="currentColor" fillOpacity={0.35} />
    </svg>
  );
}

function Legend() {
  return (
    <ul aria-label="Legend" className="flex gap-5 text-sm">
      <li className="flex items-center gap-2">
        <ScribbleSwatch className="text-neon-pink" />
        Reviewed
      </li>
      <li className="flex items-center gap-2">
        <ScribbleSwatch className="text-neon-amber" />
        Created
      </li>
    </ul>
  );
}

function TableView({ points }: DailyChartProps) {
  return (
    <details className="text-sm">
      <summary className="w-fit cursor-pointer rounded-md text-muted-foreground hover:text-foreground">
        View as table
      </summary>
      <table className="mt-3 w-full max-w-md text-left [&_td]:py-1 [&_th]:py-1">
        <thead className="border-b text-muted-foreground">
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Reviewed</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.day}>
              <th scope="row" className="font-normal">
                {formatDay(point.day)}
              </th>
              <td>{point.reviewed}</td>
              <td>{point.created}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

type TooltipPlacement = { style: CSSProperties; className: string };

function tooltipPlacement(centrePercent: number): TooltipPlacement {
  if (centrePercent < EDGE_ZONE_PERCENT) return { style: { left: 0 }, className: "" };
  if (centrePercent > 100 - EDGE_ZONE_PERCENT) return { style: { right: 0 }, className: "" };
  return { style: { left: `${centrePercent}%` }, className: "-translate-x-1/2" };
}

function columnPercent(index: number, count: number): number {
  return (index / count) * 100;
}

function Tooltip({ point, index, count }: { point: DailyPoint; index: number; count: number }) {
  const { style, className } = tooltipPlacement(columnPercent(index + 0.5, count));
  return (
    <div
      role="tooltip"
      style={style}
      className={`pointer-events-none absolute top-0 z-10 flex flex-col rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md ${className}`}
    >
      <strong className="font-hand text-xl leading-none">{formatDay(point.day)}</strong>
      <span>{point.reviewed} reviewed</span>
      <span>{point.created} created</span>
    </div>
  );
}

function dayLabelStyle(index: number, count: number): CSSProperties {
  const isLast = index === count - 1 && index > 0;
  return {
    left: `${columnPercent(index, count)}%`,
    transform: isLast ? "translateX(-100%)" : undefined,
  };
}

export function DailyChart({ points }: DailyChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const scale = Math.max(MIN_SCALE, ...points.flatMap((point) => [point.reviewed, point.created]));
  const plotWidth = points.length * COLUMN_WIDTH;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Legend />
      <div className="grid min-h-40 flex-1 grid-cols-[auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-3">
        <div
          aria-hidden="true"
          className="flex flex-col justify-between py-0.5 text-right font-mono text-xs leading-none text-muted-foreground"
        >
          <span>{scale}</span>
          <span>0</span>
        </div>
        <div className="relative min-h-0">
          <svg
            role="group"
            aria-label="Bars of PRs reviewed and created per day over the last four weeks"
            viewBox={`0 0 ${plotWidth} ${PLOT_UNITS}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            <line
              x1={0}
              x2={plotWidth}
              y1={0}
              y2={0}
              vectorEffect="non-scaling-stroke"
              className="stroke-border"
            />
            <line
              x1={0}
              x2={plotWidth}
              y1={PLOT_UNITS / 2}
              y2={PLOT_UNITS / 2}
              vectorEffect="non-scaling-stroke"
              className="stroke-border"
            />
            <line
              x1={0}
              x2={plotWidth}
              y1={PLOT_UNITS}
              y2={PLOT_UNITS}
              vectorEffect="non-scaling-stroke"
              className="stroke-border"
            />
            {points.map((point, index) => {
              const left = index * COLUMN_WIDTH;
              const barsStart = left + (COLUMN_WIDTH - (2 * BAR_WIDTH + BAR_GAP)) / 2;
              return (
                <g key={point.day}>
                  <SeriesBar
                    x={barsStart}
                    value={point.reviewed}
                    scale={scale}
                    className="fill-neon-pink"
                  />
                  <SeriesBar
                    x={barsStart + BAR_WIDTH + BAR_GAP}
                    value={point.created}
                    scale={scale}
                    className="fill-neon-amber"
                  />
                  <rect
                    role="img"
                    aria-label={describe(point)}
                    data-testid={`day-${point.day}`}
                    tabIndex={0}
                    x={left}
                    y={0}
                    width={COLUMN_WIDTH}
                    height={PLOT_UNITS}
                    fill="transparent"
                    onMouseEnter={() => setActive(index)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  />
                </g>
              );
            })}
          </svg>
          {active === null ? null : (
            <Tooltip point={points[active]} index={active} count={points.length} />
          )}
        </div>
        <div
          aria-hidden="true"
          className="relative col-start-2 h-6 font-hand text-lg text-muted-foreground"
        >
          {points.map((point, index) =>
            index % LABEL_EVERY === 0 ? (
              <span
                key={point.day}
                className="absolute top-0 whitespace-nowrap"
                style={dayLabelStyle(index, points.length)}
              >
                {formatDay(point.day)}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <TableView points={points} />
    </div>
  );
}
