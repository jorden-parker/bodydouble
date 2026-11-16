import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_ROW_COUNT = 3;

export function InboxSkeleton() {
  return (
    <div
      role="status"
      className="flex min-w-0 flex-col gap-3"
      aria-label="Asking GitHub what needs your review"
    >
      <Skeleton className="h-5 w-40" />
      <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }, (_, index) => (
          <li key={index} className="flex items-center gap-4 px-4 py-3">
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-1/3" />
            </span>
            <Skeleton className="h-6 w-24 rounded-sm" />
          </li>
        ))}
      </ul>
    </div>
  );
}
