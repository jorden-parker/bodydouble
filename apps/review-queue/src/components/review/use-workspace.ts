"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DefinitionWithCode } from "@/lib/review/peek-code";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { AssistAction, AssistTarget } from "@/lib/assist-protocol";
import type { Session } from "@/lib/session/store";
import { fetchHead } from "./api";
import { isPinned, peekedSymbol } from "./context-symbols";
import { useContextSymbols } from "./use-context-symbols";
import type { NoteTag, PullRequestRef, Step, SymbolPosition } from "@/lib/types";
import { displayHotspots } from "./display-hotspots";
import { firstNoteLine } from "./hunk-index";
import { runnableHunkMove } from "./hunk-move";
import { locationKind, nextOpenStep, type LineTarget } from "./locate";
import { scrollToElement } from "./scroll-motion";
import type { ShortcutAction } from "./shortcut-keys";
import { useAssist } from "./use-assist";
import { useJumps } from "./use-jumps";
import { type LineSelection, useLineSelection } from "./use-line-selection";
import { useExchanges } from "./use-exchanges";
import { usePeek } from "./use-peek";
import { useReturnDetection } from "./use-return-detection";
import type { OrientationState, useReview } from "./use-review";
import { useSessionEdits } from "./use-session-edits";
import { useShortcuts } from "./use-shortcuts";
import { type Act, useStepNavigation } from "./use-step-navigation";
import { useCompanion } from "./use-companion";
import { exchangeToContinue } from "./assist-thread";
import type { DisplayHotspot } from "./hotspot-list";
import { useConversation } from "./use-conversation";
import { useLinkedIssues } from "./use-linked-issues";
import { useFileLoader } from "./use-file-lines";
import { focusCurrentStop } from "./change-map-list";

type Dialog = "resume" | "pause" | "help" | "start-over" | null;
type Page = "brief" | "step" | "wrap";

const STALE_SESSION_MS = 30 * 60 * 1000;

export function shouldGreet(review: ReviewPayload, now = Date.now()): boolean {
  const { session } = review;
  if (session.pause || review.reopenedStepIds.length > 0) return true;
  const hasProgress = session.doneSteps.length + session.notes.length > 0;
  const stale =
    session.updatedAt !== null && now - Date.parse(session.updatedAt) > STALE_SESSION_MS;
  return hasProgress && stale;
}

function initialPage(session: Session): Page {
  return session.doneSteps.length === 0 && session.currentStepId === null ? "brief" : "step";
}

function explainSelection(startAsk: StartAsk, selection: LineSelection | null) {
  if (selection) startAsk({ kind: "lines", range: selection.range }, "explain");
}

type StartAsk = (target: AssistTarget, action: AssistAction, question?: string | null) => void;

function useContextTabPeek(peek: Peek, showContext: () => void): Peek {
  const { peek: state, close, showDefinitions, showReferences } = peek;
  return useMemo(
    () => ({
      peek: state,
      close,
      showDefinitions: (position: SymbolPosition) => {
        showContext();
        showDefinitions(position);
      },
      showReferences: (position: SymbolPosition) => {
        showContext();
        showReferences(position);
      },
    }),
    [state, close, showDefinitions, showReferences, showContext],
  );
}

type Peek = ReturnType<typeof usePeek>;

type ShortcutDeps = {
  review: ReviewPayload;
  ui: ReturnType<typeof useWorkspaceUi>;
  navigation: ReturnType<typeof useStepNavigation>;
  peek: ReturnType<typeof usePeek>;
  jumps: ReturnType<typeof useJumps>;
  pins: ReturnType<typeof usePeekPin>;
  startAsk: StartAsk;
  selection: LineSelection | null;
};

function shortcutHandlers({
  review,
  ui,
  navigation,
  peek,
  jumps,
  pins,
  startAsk,
  selection,
}: ShortcutDeps): Record<ShortcutAction, () => void> {
  const hovered = ui.getHovered();
  const closePanels = () => {
    ui.setComposer(null);
    peek.close();
    ui.setDialog(null);
    ui.closePalette();
    ui.closeOverlays();
  };
  return {
    "next-hunk": () => navigation.moveHunk(1),
    "previous-hunk": () => navigation.moveHunk(-1),
    "next-step": () => navigation.moveStep(1),
    "previous-step": () => navigation.moveStep(-1),
    "done-and-next": navigation.doneAndNext,
    "peek-definition": () => hovered && jumps.peekName(hovered),
    "peek-references": () => hovered && peek.showReferences(hovered),
    "pin-symbol": pins.togglePeekPin,
    "open-context": () => ui.showContextView("symbols"),
    "open-outline": () => ui.showContextView("outline"),
    "open-files": () => ui.showContextView("files"),
    "open-hotspots": ui.focusHotspots,
    "open-github": () => ui.showContextView("github"),
    "open-map": ui.focusMap,
    "toggle-left-panel": () => ui.toggleSide("left"),
    "toggle-right-panel": () => ui.toggleSide("right"),
    "toggle-panel": ui.toggleBoth,
    back: jumps.back,
    note: () => ui.setComposer(firstNoteLine(review.files, navigation.activeHunkId)),
    "ask-model": () => explainSelection(startAsk, selection),
    park: ui.focusParking,
    "toggle-all": () => navigation.setShowAll((value) => !value),
    pause: () => ui.setDialog("pause"),
    close: closePanels,
    help: () => ui.setDialog("help"),
  };
}

function usePeekPin(
  peek: ReturnType<typeof usePeek>,
  session: Session,
  context: ReturnType<typeof useContextSymbols>,
  stepId: string | null,
) {
  const symbol = peekedSymbol(peek.peek, stepId);
  const peekPinned = symbol !== null && isPinned(session.contextSymbols, symbol);
  const togglePeekPin = () => {
    if (symbol) context.setPinned(symbol, !peekPinned);
  };
  return { peekPinned, togglePeekPin };
}

function useRememberedPeek(
  ref: PullRequestRef,
  headSha: string,
  session: Session,
  act: ReturnType<typeof useReview>["act"],
  currentStep: { id: string } | null | undefined,
) {
  const stepId = currentStep?.id ?? null;
  const context = useContextSymbols(act, stepId);
  const { recordSeen } = context;
  const peek = usePeek(
    ref,
    headSha,
    useCallback(
      (position: SymbolPosition, definitions: DefinitionWithCode[]) => {
        if (definitions[0]) recordSeen(definitions[0], position);
      },
      [recordSeen],
    ),
  );
  const pins = usePeekPin(peek, session, context, stepId);
  return { peek, context, pins };
}

function useAssistAndPeek(
  ref: PullRequestRef,
  review: ReviewPayload,
  session: Session,
  controls: ReturnType<typeof useReview>,
  ui: ReturnType<typeof useWorkspaceUi>,
  currentStep: { id: string } | null | undefined,
) {
  const loadFile = useFileLoader(ref, review.headSha);
  const exchangeStore = useExchanges(controls.act);
  const { showTab, showContextView } = ui;
  const showAsk = useCallback(() => showTab("ask"), [showTab]);
  const assist = useAssist(ref, review.headSha, session.assistThreads, exchangeStore);
  const { start, followUp, exchanges } = assist;
  const [askTarget, setAskTarget] = useState<AssistTarget | null>(null);
  const startAsk: StartAsk = useCallback(
    (target, action, question = null) => {
      showAsk();
      if (target.kind !== "check") setAskTarget(target);
      start(target, action, question);
    },
    [showAsk, start],
  );
  const askAbout = useCallback(
    (target: AssistTarget, question: string) => {
      showAsk();
      if (target.kind !== "check") setAskTarget(target);
      const continuing = exchangeToContinue(exchanges, target, review.headSha);
      if (continuing) followUp(continuing, question);
      else start(target, "ask", question);
    },
    [showAsk, exchanges, followUp, start, review.headSha],
  );
  const askFile = useCallback(
    (path: string, action: AssistAction) => {
      if (action !== "ask") startAsk({ kind: "file", path }, action);
      else {
        showAsk();
        setAskTarget({ kind: "file", path });
      }
    },
    [showAsk, startAsk],
  );
  const remembered = useRememberedPeek(ref, review.headSha, session, controls.act, currentStep);
  const showContextSymbols = useCallback(() => showContextView("symbols"), [showContextView]);
  const peek = useContextTabPeek(remembered.peek, showContextSymbols);
  return {
    loadFile,
    assist,
    startAsk,
    askAbout,
    askFile,
    askTarget,
    setAskTarget,
    remembered,
    peek,
  };
}

function usePalette() {
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  return { isPaletteOpen, openPalette, closePalette };
}

function useFocusTargets(companion: ReturnType<typeof useCompanion>) {
  const parkingInput = useRef<HTMLInputElement>(null);
  const mapList = useRef<HTMLDivElement>(null);
  const { showTab, showContextView, setSideOpen } = companion;
  const focusParking = useCallback(() => {
    showTab("notes");
    setTimeout(() => parkingInput.current?.focus(), 0);
  }, [showTab]);
  const focusMap = useCallback(() => {
    showContextView("map");
    setTimeout(() => focusCurrentStop(mapList.current), 0);
  }, [showContextView]);
  const focusHotspots = useCallback(() => {
    setSideOpen("left", true);
    setTimeout(() => document.getElementById("path-hotspots")?.focus(), 0);
  }, [setSideOpen]);
  return { parkingInput, mapList, focusParking, focusMap, focusHotspots };
}

function useWorkspaceUi(review: ReviewPayload, session: Session) {
  const [dialog, setDialog] = useState<Dialog>(() => (shouldGreet(review) ? "resume" : null));
  const [page, setPage] = useState<Page>(() => initialPage(session));
  const { isPaletteOpen, openPalette, closePalette } = usePalette();
  const companion = useCompanion();
  const conversation = useConversation(review.pr.ref);
  const [composer, setComposer] = useState<LineTarget | null>(null);
  const [breakDue, setBreakDue] = useState(false);
  const [posted, setPosted] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [newHead, setNewHead] = useState<string | null>(null);
  const hovered = useRef<SymbolPosition | null>(null);
  const { parkingInput, mapList, focusParking, focusMap, focusHotspots } =
    useFocusTargets(companion);
  const setHovered = useCallback((position: SymbolPosition | null) => {
    hovered.current = position;
  }, []);
  const getHovered = useCallback(() => hovered.current, []);
  const { showTab, showContextView, setSideOpen, closeOverlays, toggleSide, toggleBoth } =
    companion;
  const showStep = useCallback(() => {
    setPage("step");
    setShowChanges(false);
  }, []);
  return {
    dialog,
    setDialog,
    page,
    setPage,
    showStep,
    isPaletteOpen,
    openPalette,
    closePalette,
    regionOpen: companion.regionOpen,
    setSideOpen,
    toggleSide,
    toggleBoth,
    closeOverlays,
    companionTab: companion.tab,
    showTab,
    contextView: companion.contextView,
    showContextView,
    ...conversation,
    composer,
    setComposer,
    breakDue,
    setBreakDue,
    posted,
    setPosted,
    showChanges,
    setShowChanges,
    newHead,
    setNewHead,
    getHovered,
    setHovered,
    parkingInput,
    focusParking,
    mapList,
    focusMap,
    focusHotspots,
  };
}

function fetchNewHead(
  ref: PullRequestRef,
  currentSha: string,
  reportNewHead: (sha: string) => void,
) {
  fetchHead(ref)
    .then(({ headSha }) => {
      if (headSha !== currentSha) reportNewHead(headSha);
    })
    .catch(() => undefined);
}

function useOpenFile() {
  const [openFile, setOpenFile] = useState<LineTarget | null>(null);
  const closeFile = useCallback(() => setOpenFile(null), []);
  return { openFile, setOpenFile, closeFile };
}

function useClosingFileAction<Args extends unknown[], Result>(
  action: (...args: Args) => Result,
  closeFile: () => void,
  showStep: () => void,
) {
  return useCallback(
    (...args: Args) => {
      closeFile();
      showStep();
      return action(...args);
    },
    [action, closeFile, showStep],
  );
}

function useFileAwareNavigation(
  review: ReviewPayload,
  session: Session,
  act: Act,
  showStep: () => void,
) {
  const stepNavigation = useStepNavigation(review, session, act);
  const openFileState = useOpenFile();
  const { openFile, setOpenFile, closeFile } = openFileState;
  const pendingHunkMove = useRef(0);
  const stepMoveHunk = stepNavigation.moveHunk;

  useEffect(() => {
    const move = runnableHunkMove(pendingHunkMove.current, openFile !== null);
    if (move === null) return;
    pendingHunkMove.current = 0;
    stepMoveHunk(move);
  }, [openFile, stepMoveHunk]);

  const moveHunk = useCallback(
    (offset: number) => {
      if (openFile === null) stepMoveHunk(offset);
      else {
        pendingHunkMove.current += offset;
        closeFile();
      }
    },
    [openFile, closeFile, stepMoveHunk],
  );
  const selectStep = useClosingFileAction(stepNavigation.selectStep, closeFile, showStep);
  const goTo = useClosingFileAction(stepNavigation.goTo, closeFile, showStep);
  const moveStep = useClosingFileAction(stepNavigation.moveStep, closeFile, showStep);
  const doneAndNext = useClosingFileAction(stepNavigation.doneAndNext, closeFile, showStep);
  const navigation = { ...stepNavigation, selectStep, goTo, moveStep, doneAndNext, moveHunk };
  const openLocation = useMemo(
    () => locationOpener(review.files, goTo, setOpenFile),
    [review.files, goTo, setOpenFile],
  );
  return { navigation, openFileState, openLocation };
}

function locationOpener(
  files: Parameters<typeof locationKind>[0],
  goTo: (target: LineTarget) => void,
  showFile: (target: LineTarget) => void,
): (target: LineTarget) => void {
  return (target) => (locationKind(files, target) === "diff" ? goTo(target) : showFile(target));
}

function resumeStepId(
  reopenedStepIds: string[],
  currentStepId: string | undefined,
  nextStepId: string | undefined,
): string | undefined {
  return reopenedStepIds[0] ?? currentStepId ?? nextStepId;
}

function acceptsShortcuts(dialog: Dialog, isPaletteOpen: boolean): boolean {
  return (dialog === null || dialog === "help") && !isPaletteOpen;
}

type PageActionsInput = {
  ui: ReturnType<typeof useWorkspaceUi>;
  navigation: { selectStep: (stepId: string) => void; goTo: (target: LineTarget) => void };
  closeFile: () => void;
  act: Act;
  nextStep: Step | null;
  hotspots: DisplayHotspot[];
  checkedHotspots: string[];
};

function usePageActions({
  ui,
  navigation,
  closeFile,
  act,
  nextStep,
  hotspots,
  checkedHotspots,
}: PageActionsInput) {
  const { setDialog, setPage } = ui;
  const goToBrief = useCallback(() => {
    closeFile();
    setPage("brief");
  }, [closeFile, setPage]);

  const goToWrap = useCallback(() => {
    closeFile();
    setDialog(null);
    setPage("wrap");
  }, [closeFile, setDialog, setPage]);

  const goToOpenWork = useCallback(() => {
    if (nextStep) navigation.selectStep(nextStep.id);
    else {
      const open = hotspots.find((hotspot) => !checkedHotspots.includes(hotspot.id));
      if (open) navigation.goTo({ path: open.path, line: open.line ?? 1 });
    }
  }, [nextStep, navigation, hotspots, checkedHotspots]);

  const setStepOrder = useCallback(
    (stepIds: string[] | null) =>
      act({ type: "step-order", stepIds }, (current) => ({
        ...current,
        stepOrder: stepIds,
      })),
    [act],
  );

  return { goToBrief, goToWrap, goToOpenWork, setStepOrder };
}

type ResumeActionsInput = {
  edits: ReturnType<typeof useSessionEdits>;
  ui: { setDialog: (dialog: Dialog) => void; setShowChanges: (isShown: boolean) => void };
  navigation: { currentStep: Step | null | undefined; selectStep: (stepId: string) => void };
  nextStep: Step | null;
  reopenedStepIds: string[];
  act: Act;
};

function useResumeActions({
  edits,
  ui,
  navigation,
  nextStep,
  reopenedStepIds,
  act,
}: ResumeActionsInput) {
  const { setDialog, setShowChanges } = ui;
  const resume = useCallback(() => {
    edits.resume();
    setDialog(null);
    const target = resumeStepId(reopenedStepIds, navigation.currentStep?.id, nextStep?.id);
    if (target) navigation.selectStep(target);
  }, [edits, navigation, nextStep, reopenedStepIds, setDialog]);

  const catchUp = () => {
    act({ type: "catch-up" });
    setShowChanges(false);
    const target = resumeStepId(reopenedStepIds, navigation.currentStep?.id, nextStep?.id);
    if (target) navigation.selectStep(target);
  };

  const showChangesFromResume = () => {
    setDialog(null);
    setShowChanges(true);
  };

  return { resume, catchUp, showChangesFromResume };
}

function useSessionFlows(
  controls: ReturnType<typeof useReview>,
  edits: ReturnType<typeof useSessionEdits>,
  ui: {
    setDialog: (dialog: Dialog) => void;
    setPage: (page: Page) => void;
    setPosted: (isPosted: boolean) => void;
    refreshConversation: () => Promise<void>;
  },
) {
  const { setDialog, setPage, setPosted, refreshConversation } = ui;
  return {
    replyToThread: async (commentId: number, body: string) => {
      try {
        return await edits.postReply(commentId, body);
      } finally {
        await refreshConversation();
      }
    },
    startOver: async (keepNotes: boolean) => {
      setDialog(null);
      await controls.startOver(keepNotes);
      setPage("brief");
      scrollToElement("step-top", "step");
    },
    pause: (note: string) => {
      edits.pause(note);
      setDialog(null);
    },
    submit: async (...args: Parameters<typeof edits.submit>) => {
      await edits.submit(...args);
      setPosted(true);
    },
  };
}

function useWorkspaceSurface(
  ref: PullRequestRef,
  review: ReviewPayload,
  session: Session,
  controls: ReturnType<typeof useReview>,
  ui: ReturnType<typeof useWorkspaceUi>,
) {
  const { navigation, openFileState, openLocation } = useFileAwareNavigation(
    review,
    session,
    controls.act,
    ui.showStep,
  );
  const assistPeek = useAssistAndPeek(ref, review, session, controls, ui, navigation.currentStep);
  const selection = useLineSelection();
  const jumps = useJumps(session, controls.act, openLocation, assistPeek.peek);
  return { navigation, openFileState, openLocation, assistPeek, selection, jumps };
}

function useWorkspaceEdits(
  ref: PullRequestRef,
  review: ReviewPayload,
  session: Session,
  controls: ReturnType<typeof useReview>,
  ui: ReturnType<typeof useWorkspaceUi>,
) {
  const edits = useSessionEdits(ref, review.headSha, session, controls.act, controls.setSession);
  const { saveNote: persistNote } = edits;
  const { setComposer } = ui;
  const saveNote = useCallback(
    (target: LineTarget | null, tag: NoteTag, body: string) => {
      persistNote(target, tag, body);
      setComposer(null);
    },
    [persistNote, setComposer],
  );
  const sessionFlows = useSessionFlows(controls, edits, ui);
  return { edits, saveNote, sessionFlows };
}

function useReturnPrompt(
  ref: PullRequestRef,
  review: ReviewPayload,
  ui: ReturnType<typeof useWorkspaceUi>,
) {
  const { setDialog, setNewHead } = ui;
  const checkForNewHead = useCallback(
    () => fetchNewHead(ref, review.headSha, setNewHead),
    [ref, review.headSha, setNewHead],
  );
  useReturnDetection(
    useCallback(() => {
      setDialog((current) => current ?? "resume");
      checkForNewHead();
    }, [setDialog, checkForNewHead]),
  );
}

function useWorkspaceShortcuts(
  review: ReviewPayload,
  ui: ReturnType<typeof useWorkspaceUi>,
  surface: ReturnType<typeof useWorkspaceSurface>,
) {
  const { navigation, jumps, selection, assistPeek } = surface;
  const { pins } = assistPeek.remembered;
  const onShortcut = (action: ShortcutAction) =>
    shortcutHandlers({
      review,
      ui,
      navigation,
      peek: assistPeek.peek,
      jumps,
      pins,
      startAsk: assistPeek.startAsk,
      selection,
    })[action]();
  useShortcuts(onShortcut, acceptsShortcuts(ui.dialog, ui.isPaletteOpen));
}

export function useWorkspace(
  ref: PullRequestRef,
  review: ReviewPayload,
  session: Session,
  orientation: OrientationState,
  controls: ReturnType<typeof useReview>,
) {
  const ui = useWorkspaceUi(review, session);
  const linkedIssues = useLinkedIssues(ref);
  const surface = useWorkspaceSurface(ref, review, session, controls, ui);
  const { navigation, openFileState, openLocation, assistPeek, selection, jumps } = surface;
  const {
    loadFile,
    assist,
    startAsk,
    askAbout,
    askFile,
    askTarget,
    setAskTarget,
    remembered,
    peek,
  } = assistPeek;
  const { context, pins } = remembered;
  const { edits, saveNote, sessionFlows } = useWorkspaceEdits(ref, review, session, controls, ui);
  const hotspots = useMemo(
    () => displayHotspots(review.hotspots, orientation),
    [review.hotspots, orientation],
  );
  const files = useMemo(
    () => new Map(review.files.map((file) => [file.path, file])),
    [review.files],
  );
  const nextStep = nextOpenStep(review.steps, session.doneSteps, null);
  const { closeFile } = openFileState;

  useReturnPrompt(ref, review, ui);

  const { resume, catchUp, showChangesFromResume } = useResumeActions({
    edits,
    ui,
    navigation,
    nextStep,
    reopenedStepIds: review.reopenedStepIds,
    act: controls.act,
  });

  const { goToBrief, goToWrap, goToOpenWork, setStepOrder } = usePageActions({
    ui,
    navigation,
    closeFile,
    act: controls.act,
    nextStep,
    hotspots,
    checkedHotspots: session.checkedHotspots,
  });

  useWorkspaceShortcuts(review, ui, surface);

  return {
    pullRequest: ref,
    loadFile,
    ...ui,
    ...navigation,
    aiEnabled: orientation.status !== "disabled",
    ...jumps,
    ...openFileState,
    openLocation,
    ...edits,
    ...pins,
    setSymbolPinned: context.setPinned,
    peek,
    assist,
    startAsk,
    askAbout,
    askFile,
    askTarget,
    setAskTarget,
    selection,
    hotspots,
    files,
    linkedIssues,
    nextStep,
    resume,
    catchUp,
    showChangesFromResume,
    goToBrief,
    goToWrap,
    setStepOrder,
    goToOpenWork,
    saveNote,
    ...sessionFlows,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
