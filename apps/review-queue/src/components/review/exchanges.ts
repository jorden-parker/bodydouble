import type { AssistThread } from "@/lib/assist-protocol";
import type { Session } from "@/lib/session/store";

export function withoutExchange(session: Session, id: string): Session {
  return {
    ...session,
    assistThreads: session.assistThreads.filter((exchange) => exchange.id !== id),
  };
}

export function withExchange(session: Session, thread: AssistThread, updatedAt: string): Session {
  const saved = { ...thread, updatedAt };
  const isSaved = session.assistThreads.some((exchange) => exchange.id === thread.id);
  const assistThreads = isSaved
    ? session.assistThreads.map((exchange) => (exchange.id === thread.id ? saved : exchange))
    : [...session.assistThreads, saved];
  return { ...session, assistThreads };
}
