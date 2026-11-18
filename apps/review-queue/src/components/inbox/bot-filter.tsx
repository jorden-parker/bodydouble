import type { PullRequestAuthorship } from "@/lib/github/gh";
import { buildHref, type QueueQuery } from "./build-href";
import { ChoiceMenu } from "./choice-menu";

export type BotName = Exclude<PullRequestAuthorship, "others">;

const BOT_FILTERS = ["dependabot", "smartling", "both"] as const;

export type BotFilter = (typeof BOT_FILTERS)[number] | null;

const BOT_LABELS: Record<BotName, string> = { dependabot: "Dependabot", smartling: "Smartling" };

const BOT_NAMES = Object.keys(BOT_LABELS) as BotName[];

export function parseBotFilter(value: unknown): BotFilter {
  return BOT_FILTERS.find((filter) => filter === value) ?? null;
}

export function botsShownBy(filter: BotFilter): BotName[] {
  return filter === null || filter === "both" ? BOT_NAMES : [filter];
}

export function describeBotFilter(filter: BotFilter): string {
  return filter === null
    ? "Everything"
    : botsShownBy(filter)
        .map((bot) => BOT_LABELS[bot])
        .join(" and ");
}

export function BotFilterMenu({ chosen, query }: { chosen: BotFilter; query: QueueQuery }) {
  return (
    <ChoiceMenu
      title="Show"
      label="Filter by bot"
      choices={[null, ...BOT_FILTERS].map((filter) => ({
        label: describeBotFilter(filter),
        href: buildHref("/", { ...query, bots: filter ?? undefined }),
        isChosen: filter === chosen,
      }))}
    />
  );
}
