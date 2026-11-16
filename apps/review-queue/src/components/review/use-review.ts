"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { OrientationResult } from "@/lib/review/orientation-service";
import type { ReviewPayload, SeenResult } from "@/lib/review/prepare";
import type { SessionAction } from "@/lib/review/session-actions";
import type { Session } from "@/lib/session/store";
import { prKey } from "@/lib/pr-ref";
import type { PullRequestRef } from "@/lib/types";
import { fetchOrientation, fetchReview, postSeen, sendSessionAction } from "./api";
import {
  createSerialQueue,
  createTemporaryIds,
  serverIdOfAddedNote,
  settleAnswered,
  settleRefused,
  visibleSession,
  withServerNoteId,
  type OptimisticChange,
  type SessionLedger,
} from "./session-queue";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; review: ReviewPayload };

export type OrientationState = OrientationResult | { status: "loading" };

type ReviewSetters = {
  setLoad: Dispatch<SetStateAction<LoadState>>;
  setLedger: Dispatch<SetStateAction<SessionLedger>>;
  setOrientation: Dispatch<SetStateAction<OrientationState>>;
};

const UNSAVED_NOTE_MESSAGE = "the note it changes was never saved";

function orientationOrError(ref: PullRequestRef, sha: string): Promise<OrientationResult> {
  return fetchOrientation(ref, sha).catch((error: Error) => ({
    status: "error",
    message: error.message,
  }));
}

function useOrientationRetry(
  ref: PullRequestRef,
  load: LoadState,
  setOrientation: (state: OrientationState) => void,
) {
  const readyHeadSha = load.status === "ready" ? load.review.headSha : null;
  return useCallback(() => {
    if (readyHeadSha === null) return;
    setOrientation({ status: "loading" });
    void orientationOrError(ref, readyHeadSha).then(setOrientation);
  }, [ref, readyHeadSha, setOrientation]);
}

function useReviewFetch(
  ref: PullRequestRef,
  { setLoad, setLedger, setOrientation }: ReviewSetters,
  epochRef: MutableRefObject<number>,
) {
  const seenRequests = useRef(new Map<string, Promise<SeenResult>>());

  useEffect(() => {
    let cancelled = false;
    epochRef.current += 1;
    const seenOnce = (sha: string) => {
      const requests = seenRequests.current;
      const key = `${prKey(ref)}@${sha}`;
      if (!requests.has(key)) requests.set(key, postSeen(ref, sha));
      return requests.get(key)!;
    };
    fetchReview(ref)
      .then((review) => seenOnce(review.headSha).then((seen) => ({ review, seen })))
      .then(({ review, seen }) => {
        if (cancelled) return;
        setLoad({
          status: "ready",
          review: { ...review, session: seen.session, reopenedStepIds: seen.reopenedStepIds },
        });
        setLedger({ confirmed: seen.session, appliedSeq: 0, pending: [] });
        return orientationOrError(ref, review.headSha);
      })
      .then((result) => {
        if (!cancelled && result) setOrientation(result);
      })
      .catch((error: Error) => {
        if (!cancelled) setLoad({ status: "error", message: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [ref, setLoad, setLedger, setOrientation, epochRef]);
}

function useSessionActions(
  ref: PullRequestRef,
  { setLoad, setLedger }: ReviewSetters,
  epochRef: MutableRefObject<number>,
) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [queue] = useState(createSerialQueue);
  const [nextTemporaryId] = useState(createTemporaryIds);
  const [serverIds] = useState(() => new Map<number, number>());
  const sequence = useRef(0);

  const act = useCallback(
    (action: SessionAction, optimistic?: OptimisticChange) => {
      const seq = ++sequence.current;
      const epochAtDispatch = epochRef.current;
      const temporaryNoteId = nextTemporaryId();
      const isCurrent = () => epochAtDispatch === epochRef.current;
      setLedger((current) => ({
        ...current,
        pending: [...current.pending, { seq, temporaryNoteId, optimistic }],
      }));
      return queue.run(async () => {
        const sent = withServerNoteId(action, serverIds);
        if (!sent) {
          if (isCurrent()) {
            setLedger((current) => settleRefused(current, seq));
            setActionError(UNSAVED_NOTE_MESSAGE);
          }
          return;
        }
        try {
          const answer = await sendSessionAction(ref, sent);
          if (action.type === "note-add") {
            const serverId = serverIdOfAddedNote(answer, action);
            if (serverId !== null) serverIds.set(temporaryNoteId, serverId);
          }
          if (isCurrent()) {
            setLedger((current) => settleAnswered(current, seq, answer));
            setActionError(null);
          }
        } catch (error) {
          if (isCurrent()) {
            setLedger((current) => settleRefused(current, seq));
            setActionError(error instanceof Error ? error.message : String(error));
          }
        }
      });
    },
    [ref, queue, nextTemporaryId, serverIds, setLedger, epochRef],
  );

  const replaceSession = useCallback(
    (next: Session) => setLedger((current) => ({ ...current, confirmed: next })),
    [setLedger],
  );

  const startOver = useCallback(
    async (keepNotes: boolean) => {
      await act({ type: "start-over", keepNotes });
      setLoad((current) =>
        current.status === "ready"
          ? { status: "ready", review: { ...current.review, reopenedStepIds: [] } }
          : current,
      );
    },
    [act, setLoad],
  );

  return { act, actionError, replaceSession, startOver };
}

export function useReview(ref: PullRequestRef) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [ledger, setLedger] = useState<SessionLedger>({
    confirmed: null,
    appliedSeq: 0,
    pending: [],
  });
  const [orientation, setOrientation] = useState<OrientationState>({ status: "loading" });
  const epochRef = useRef(0);
  const setters = { setLoad, setLedger, setOrientation };
  const session = useMemo(() => visibleSession(ledger), [ledger]);

  useReviewFetch(ref, setters, epochRef);
  const { act, actionError, replaceSession, startOver } = useSessionActions(ref, setters, epochRef);
  const retryOrientation = useOrientationRetry(ref, load, setOrientation);

  return {
    load,
    session,
    setSession: replaceSession,
    orientation,
    retryOrientation,
    act,
    actionError,
    startOver,
  };
}
