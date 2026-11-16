"use client";

import { useState } from "react";
import { MarkdownField } from "@/components/common/markdown-field";
import { Button } from "@/components/ui/button";
import type { NoteTag } from "@/lib/types";
import { splitConventionalPrefix, unwrappedDraft } from "@/lib/review/conventional-comment";
import { NoteTagPicker } from "./note-composer";

export function CommentDraft({
  draft,
  commentLine,
  onSave,
}: {
  draft: string;
  commentLine: number | null;
  onSave: (tag: NoteTag, body: string) => void;
}) {
  const parsed = splitConventionalPrefix(unwrappedDraft(draft));
  const [tag, setTag] = useState<NoteTag>(parsed.tag ?? { kind: "question", decorations: [] });
  const [body, setBody] = useState(parsed.body);
  const [saved, setSaved] = useState(false);
  const save = () => {
    onSave(tag, body.trim());
    setSaved(true);
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <NoteTagPicker tag={tag} onChange={setTag} />
      <MarkdownField
        aria-label="Comment draft"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
      />
      <Button size="sm" className="self-end" disabled={saved || !body.trim()} onClick={save}>
        {saved
          ? "Saved to your notes"
          : commentLine === null
            ? "Save as summary note"
            : `Save as note on L${commentLine}`}
      </Button>
    </div>
  );
}
