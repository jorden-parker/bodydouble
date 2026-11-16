"use client";

import { useEffect, useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ChangePartsResult } from "@/lib/review/change-parts-service";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import { ChangeMapList } from "./change-map-list";
import { ContextList } from "./context-list";
import { ConversationPanel } from "./conversation-panel";
import { fetchChangeParts } from "./api";
import { FileBrowserPane } from "./file-browser-pane";
import { mapSections } from "./map-rows";
import { PeekPanel } from "./peek-panel";
import type { CompanionSection } from "./use-companion";
import type { Workspace } from "./use-workspace";
import { WorkspaceOutline } from "./workspace-outline";

const VIEW_REGION: Record<CompanionSection, string> = {
  symbols: "Context",
  outline: "Outline",
  files: "Files",
  map: "Map",
  github: "GitHub",
};

const CONTEXT_VIEWS: { value: CompanionSection; label: string }[] = [
  { value: "symbols", label: "Symbols" },
  { value: "outline", label: "Outline" },
  { value: "files", label: "Files" },
  { value: "map", label: "Map" },
  { value: "github", label: "GitHub" },
];

type ChangePartsState = { status: "loading" } | ChangePartsResult;

function useChangeParts(review: ReviewPayload, enabled: boolean): ChangePartsState {
  const [state, setState] = useState<ChangePartsState>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = async () => {
      try {
        const result = await fetchChangeParts(review.pr.ref, review.headSha);
        if (live) setState(result);
      } catch (error) {
        if (live) setState({ status: "error", message: String(error) });
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [review.pr.ref, review.headSha, enabled]);
  return state;
}

function partsByNode(
  state: ChangePartsState,
): ReadonlyMap<string, { part: string; weight: string }> | undefined {
  if (state.status !== "ready") return undefined;
  return new Map(state.parts.parts.map((part) => [part.id, part]));
}

function PartsStatus({ state, enabled }: { state: ChangePartsState; enabled: boolean }) {
  if (state.status === "ready") {
    return (
      <span className="block text-pretty text-sm text-muted-foreground">
        The model&apos;s guess, unverified. The PR author can sway it.
      </span>
    );
  }
  if (state.status === "loading" && enabled) {
    return (
      <p role="status" className="text-pretty text-sm text-muted-foreground">
        Asking the model how the changes fit…
      </p>
    );
  }
  return null;
}

function MapView({ review, session, workspace }: ViewProps) {
  const parts = useChangeParts(review, workspace.aiEnabled);
  const sections = useMemo(
    () => mapSections(review.changeMap, session.doneSteps, workspace.activeHunkId),
    [review.changeMap, session.doneSteps, workspace.activeHunkId],
  );
  const partsOfNode = useMemo(() => partsByNode(parts), [parts]);
  return (
    <>
      <PartsStatus state={parts} enabled={workspace.aiEnabled} />
      <ChangeMapList
        sections={sections}
        onOpen={(node) => workspace.goTo({ path: node.path, line: node.line })}
        parts={partsOfNode}
        listRef={workspace.mapList}
      />
    </>
  );
}

function WorkspacePeek({ workspace }: { workspace: Workspace }) {
  const { peek } = workspace.peek;
  if (!peek) return null;
  return (
    <PeekPanel
      peek={peek}
      inPullRequest={(path) => workspace.files.has(path)}
      onIdentifier={workspace.peekName}
      onGoTo={workspace.goToFromPeek}
      pinned={workspace.peekPinned}
      onTogglePin={workspace.togglePeekPin}
      onTab={(tab) => {
        if (tab === "references") workspace.peek.showReferences(peek.position);
        else workspace.peek.showDefinitions(peek.position);
      }}
      onClose={workspace.peek.close}
      loadFile={workspace.loadFile}
    />
  );
}

type ViewProps = {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
};

function SymbolsView({ session, workspace }: ViewProps) {
  if (workspace.peek.peek) return <WorkspacePeek workspace={workspace} />;
  return (
    <ContextList
      symbols={session.contextSymbols}
      stepId={workspace.currentStep?.id ?? null}
      jumps={session.jumps}
      onOpen={(symbol) => workspace.peekName(symbol.origin)}
      onTogglePin={(symbol) => workspace.setSymbolPinned(symbol, !symbol.pinned)}
      onBack={workspace.back}
      onClearTrail={workspace.clearJumps}
    />
  );
}

function OutlineView({ review, workspace }: ViewProps) {
  return (
    <WorkspaceOutline
      pullRequest={workspace.pullRequest}
      headSha={review.headSha}
      step={workspace.currentStep ?? null}
      files={workspace.files}
      onGoTo={workspace.goTo}
      onPeek={workspace.peekName}
    />
  );
}

function FilesView({ review, workspace }: ViewProps) {
  return (
    <FileBrowserPane
      pullRequest={workspace.pullRequest}
      headSha={review.headSha}
      inPullRequest={(path) => workspace.files.has(path)}
      onOpen={workspace.openLocation}
    />
  );
}

function GitHubView({ session, workspace }: ViewProps) {
  return (
    <ConversationPanel
      conversation={workspace.conversation}
      error={workspace.conversationError}
      threads={workspace.threads}
      receipts={session.submissions}
      replyReceipts={session.replyReceipts}
      onOpen={workspace.goTo}
      onReply={workspace.replyToThread}
    />
  );
}

const VIEW_BODIES: Record<CompanionSection, (props: ViewProps) => React.ReactNode> = {
  symbols: (props) => <SymbolsView {...props} />,
  outline: (props) => <OutlineView {...props} />,
  files: (props) => <FilesView {...props} />,
  map: (props) => <MapView {...props} />,
  github: (props) => <GitHubView {...props} />,
};

export function ContextTab(props: ViewProps) {
  const { workspace } = props;
  const view = workspace.contextView;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={view}
        aria-label="Context view"
        onValueChange={(next) => {
          if (next) workspace.showContextView(next as CompanionSection);
        }}
        className="flex-wrap justify-start"
      >
        {CONTEXT_VIEWS.map((view) => (
          <ToggleGroupItem key={view.value} value={view.value} className="whitespace-nowrap">
            {view.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <section aria-label={VIEW_REGION[view]} className="flex min-w-0 flex-col gap-4">
        {VIEW_BODIES[view](props)}
      </section>
    </div>
  );
}
