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
    <form onSubmit={open} className="grid gap-3" aria-labelledby="open-pr-heading">
      <h2 id="open-pr-heading" className="text-heading">
        Open any PR by URL
      </h2>
      <div className="grid gap-2">
        <label htmlFor="pr" className="text-sm text-fg-muted">
          PR link or owner/repo#number
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="pr"
            name="pullRequest"
            autoComplete="off"
            spellCheck={false}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="https://github.com/owner/repo/pull/123 or owner/repo#123"
            aria-invalid={invalid}
            aria-describedby="pr-error"
            className="flex-1 font-mono"
          />
          <Button type="submit" variant="soft">
            Open <ArrowRight />
          </Button>
        </div>
        <p id="pr-error" aria-live="polite" className="empty:hidden text-label text-destructive">
          {invalid ? "That doesn't look like a PR link." : null}
        </p>
      </div>
    </form>
  );
}
