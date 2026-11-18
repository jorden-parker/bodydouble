import Link from "next/link";
import { Button } from "@/components/ui/button";

export function buildHref(basePath: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, value);
  }
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function ChoiceLinks({
  label,
  choices,
}: {
  label: string;
  choices: { label: string; href: string; isChosen: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {choices.map((choice) => (
        <Button key={choice.href} variant={choice.isChosen ? "soft" : "ghost"} size="sm" asChild>
          <Link href={choice.href} aria-current={choice.isChosen ? "true" : undefined}>
            {choice.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
