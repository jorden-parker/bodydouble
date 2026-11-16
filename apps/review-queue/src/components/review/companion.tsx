"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import { AskPanel } from "./ask-panel";
import { ContextTab } from "./companion-context";
import { NotesPanel } from "./notes-panel";
import type { CompanionTab } from "./use-companion";
import type { Workspace } from "./use-workspace";

type CompanionProps = {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
};

function AskTab({ review, workspace }: CompanionProps) {
  return <AskPanel review={review} workspace={workspace} />;
}

function NotesTab({ session, workspace }: CompanionProps) {
  return (
    <NotesPanel
      notes={session.notes}
      parkingRef={workspace.parkingInput}
      onPark={(body) => workspace.saveNote(null, { kind: "parked", decorations: [] }, body)}
      onOpen={(note) => note.path && workspace.goTo({ path: note.path, line: note.line ?? 1 })}
      onEdit={workspace.editNote}
      onDelete={workspace.deleteNote}
    />
  );
}

function tabLabel(label: string, count: number | null): string {
  return count === null || count === 0 ? label : `${label} · ${count}`;
}

export function Companion(props: CompanionProps) {
  const { session, workspace } = props;
  return (
    <Tabs
      value={workspace.companionTab}
      onValueChange={(value) => workspace.showTab(value as CompanionTab)}
      className="min-h-0 min-w-0 flex-1 gap-4"
    >
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value="ask" className="whitespace-nowrap">
          Ask
        </TabsTrigger>
        <TabsTrigger value="notes" className="whitespace-nowrap">
          {tabLabel("Notes", session.notes.length)}
        </TabsTrigger>
        <TabsTrigger value="context" className="whitespace-nowrap">
          Context
        </TabsTrigger>
      </TabsList>
      <TabsContent value="ask" className="flex min-h-0 flex-1 flex-col">
        <AskTab {...props} />
      </TabsContent>
      <TabsContent value="notes" className="min-h-0 overflow-y-auto">
        <NotesTab {...props} />
      </TabsContent>
      <TabsContent value="context" className="min-h-0 overflow-y-auto">
        <ContextTab {...props} />
      </TabsContent>
    </Tabs>
  );
}
