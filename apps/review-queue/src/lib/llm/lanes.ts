export type Lane = "interactive" | "background";

export class TurnPreempted extends Error {
  constructor() {
    super("Preempted by an interactive model turn");
    this.name = "TurnPreempted";
  }
}

export type LaneTurn = { signal: AbortSignal; release: () => void };

type Waiter = { lane: Lane; grant: (turn: LaneTurn) => void };
type Running = { lane: Lane; preemption: AbortController };
type LaneState = { running: Running | null; queues: Record<Lane, Waiter[]> };

const globals = globalThis as { reviewQueueLanes?: LaneState };

function laneState(): LaneState {
  globals.reviewQueueLanes ??= { running: null, queues: { interactive: [], background: [] } };
  return globals.reviewQueueLanes;
}

function dispatch(state: LaneState): void {
  if (state.running) return;
  const waiter = state.queues.interactive.shift() ?? state.queues.background.shift();
  if (!waiter) return;
  const running: Running = { lane: waiter.lane, preemption: new AbortController() };
  state.running = running;
  waiter.grant({
    signal: running.preemption.signal,
    release: () => {
      if (state.running !== running) return;
      state.running = null;
      dispatch(state);
    },
  });
}

export function takeLane(lane: Lane, signal?: AbortSignal): Promise<LaneTurn> {
  const state = laneState();
  return new Promise<LaneTurn>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const waiter: Waiter = {
      lane,
      grant: (turn) => {
        signal?.removeEventListener("abort", leaveQueue);
        resolve(turn);
      },
    };
    function leaveQueue() {
      state.queues[lane] = state.queues[lane].filter((queued) => queued !== waiter);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", leaveQueue, { once: true });
    state.queues[lane].push(waiter);
    if (lane === "interactive" && state.running?.lane === "background") {
      state.running.preemption.abort(new TurnPreempted());
    }
    dispatch(state);
  });
}

export function readLaneStatus(): { running: Lane | null; queued: Record<Lane, number> } {
  const state = laneState();
  return {
    running: state.running?.lane ?? null,
    queued: {
      interactive: state.queues.interactive.length,
      background: state.queues.background.length,
    },
  };
}
