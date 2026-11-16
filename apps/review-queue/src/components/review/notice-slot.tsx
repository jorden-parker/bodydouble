"use client";

import type { ReactNode } from "react";
import { Callout } from "@/components/common/callout";
import { Otter } from "@/components/neon/otter";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/plural";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Workspace } from "./use-workspace";

export type Notice = { key: string; node: ReactNode };

type NoticeInputs = {
  actionError: string | null;
  workspace: Workspace;
  state: ReviewPayload["pr"]["state"];
};

const CLOSED_NOTICES = {
  merged: "This PR is already merged. Anything you post now is a comment on shipped code.",
  closed: "This PR was closed without merging. Check with the author before you spend time on it.",
};

function BreakPill({ workspace }: { workspace: Workspace }) {
  return (
    <Callout
      role="status"
      className="animate-step-enter flex flex-wrap items-center justify-between gap-3"
    >
      <span className="flex min-w-0 items-center gap-2 text-pretty">
        <Otter size="small" />
        25 min in. Otter says stretch.
      </span>
      <span className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => workspace.setDialog("pause")}>
          Pause with a note
        </Button>
        <Button size="sm" variant="ghost" onClick={() => workspace.setBreakDue(false)}>
          Keep going
        </Button>
      </span>
    </Callout>
  );
}

function PushNotice({ headSha, onDismiss }: { headSha: string; onDismiss: () => void }) {
  return (
    <Callout role="status" className="flex flex-wrap items-center justify-between gap-3">
      <span className="min-w-0 text-pretty">
        New commits were pushed ({headSha.slice(0, 7)}). Reload to re-check what changed.
      </span>
      <span className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => location.reload()}>
          Reload
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </span>
    </Callout>
  );
}

export function noticesOf({ actionError, workspace, state }: NoticeInputs): Notice[] {
  const notices: Notice[] = [];
  if (actionError) {
    notices.push({
      key: "error",
      node: (
        <Callout tone="error" role="alert" className="text-pretty">
          Couldn&apos;t save: {actionError}
        </Callout>
      ),
    });
  }
  if (workspace.newHead) {
    const headSha = workspace.newHead;
    notices.push({
      key: "push",
      node: <PushNotice headSha={headSha} onDismiss={() => workspace.setNewHead(null)} />,
    });
  }
  if (state !== "open") {
    notices.push({
      key: "closed",
      node: <Callout className="text-pretty">{CLOSED_NOTICES[state]}</Callout>,
    });
  }
  if (workspace.breakDue) {
    notices.push({ key: "break", node: <BreakPill workspace={workspace} /> });
  }
  return notices;
}

export function NoticeSlot({ notices }: { notices: Notice[] }) {
  const [first, ...rest] = notices;
  if (!first) return null;
  return (
    <div className="flex flex-col gap-2">
      {first.node}
      {rest.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {plural(rest.length, "more notice")} waiting behind this one.
        </p>
      )}
    </div>
  );
}
