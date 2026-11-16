import { PathLabel } from "@/components/common/path-label";
import type { TargetChip } from "./target-chip";

export function TargetChipView({ chip }: { chip: TargetChip }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs">
      {chip.path && <PathLabel path={chip.path} className="min-w-0 truncate text-xs" />}
      <span className="whitespace-nowrap text-muted-foreground">{chip.text}</span>
    </span>
  );
}
