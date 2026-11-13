"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parsePullRequestRef, prPath } from "@/lib/pr-ref";

export function OpenPullRequestForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  function open(event: React.FormEvent) {
    event.preventDefault();
    const ref = parsePullRequestRef(text);
    setInvalid(ref === null);
    if (ref) router.push(prPath(ref));
  }

  return (
    <form onSubmit={open} className="grid gap-s-3" aria-labelledby="open-pr-heading">
      <h2 id="open-pr-heading" className="font-display text-2xl font-semibold">
        Open Any PR by URL
      </h2>
      <div className="grid gap-s-2">
        <label htmlFor="pr" className="text-sm text-fg-muted">
          PR link or owner/repo#number
        </label>
        <div className="flex gap-s-2">
          <Input
            id="pr"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="https://github.com/owner/repo/pull/123 or owner/repo#123"
            aria-invalid={invalid}
            aria-describedby="pr-error"
            className="h-11 flex-1 font-mono text-sm"
          />
          <Button type="submit" variant="soft" className="h-11">
            Open <ArrowRight />
          </Button>
        </div>
        <p id="pr-error" aria-live="polite" className="empty:hidden text-sm text-destructive">
          {invalid ? "That doesn't look like a PR link." : null}
        </p>
      </div>
    </form>
  );
}
