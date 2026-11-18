import { CalendarPlus, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "./time";

const ICONS = { created: CalendarPlus, updated: History };

export function DateBadge({
  kind,
  iso,
  now,
}: {
  kind: "created" | "updated";
  iso: string;
  now: number;
}) {
  const Icon = ICONS[kind];
  return (
    <Badge variant="outline" asChild>
      <time dateTime={iso}>
        <Icon aria-hidden="true" />
        {`${kind} ${relativeTime(iso, now)}`}
      </time>
    </Badge>
  );
}
