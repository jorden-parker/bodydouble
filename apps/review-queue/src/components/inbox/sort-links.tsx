import { buildHref, ChoiceLinks } from "./choice-links";
import { QUEUE_SORTS, type QueueSort } from "./queue";

const SORT_LABELS: Record<QueueSort, string> = {
  recommended: "Recommended",
  oldest: "Oldest first",
  newest: "Newest first",
  smallest: "Smallest first",
  updated: "Recently updated",
};

export function sortParameterOf(sort: QueueSort): string | undefined {
  return sort === "recommended" ? undefined : sort;
}

export function SortLinks({
  sort,
  repository,
  hasEntriesToOrder,
}: {
  sort: QueueSort;
  repository: string | undefined;
  hasEntriesToOrder: boolean;
}) {
  if (!hasEntriesToOrder && sort === "recommended") return null;
  return (
    <ChoiceLinks
      label="Sort pull requests"
      choices={QUEUE_SORTS.map((option) => ({
        label: SORT_LABELS[option],
        href: buildHref("/", { repository, sort: sortParameterOf(option) }),
        isChosen: option === sort,
      }))}
    />
  );
}
