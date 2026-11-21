import type { AgentId } from '@goodboy/types';
import { CHECK_STATE } from '../../../../../store/slices/notifications/errorRecovery';
import { useAppStore } from '../../../../../store';
import { WATCH } from './WATCH';
import type { WakeCandidate } from './wakeImplementerOf';
import { wakeImplementerOf } from './wakeImplementerOf';
import type { WatchFact } from './watchFacts';

type Params = {
  readonly fact: WatchFact;
  readonly agents: ReadonlyArray<WakeCandidate>;
  readonly wakes: Map<string, number>;
  readonly pending: Set<string>;
};

type FactParams = {
  readonly fact: WatchFact;
};

const wakeKeyOf = ({ fact }: FactParams): string => `${fact.mountId}|${fact.prNumber}`;

const wakeMessageOf = ({ fact }: FactParams): string =>
  `The checks failed on #${fact.prNumber}. Read the failing check logs, find the cause and fix it in this worktree. Don't push: tell me when the fix is ready.`;

export const wakeOnFailure = async ({ fact, agents, wakes, pending }: Params): Promise<void> => {
  const key = wakeKeyOf({ fact });
  const count = wakes.get(key) ?? 0;
  if (count >= WATCH.maxWakes || pending.has(key)) {
    return;
  }
  const agentId: AgentId | null = wakeImplementerOf({ agents, mountId: fact.mountId });
  if (agentId === null) {
    return;
  }
  const state = useAppStore.getState();
  const turn = {
    id: `pr-watch:${key}:${fact.headSha}:${count + 1}`,
    agentId,
    content: wakeMessageOf({ fact }),
    attachments: [],
    override: undefined,
  };
  pending.add(key);
  try {
    const isSaved = await state.enqueueAgentMessage({ turn });
    const isQueued = (useAppStore.getState().agentQueue[agentId] ?? []).some(
      (item) => item.id === turn.id,
    );
    if (!isSaved && !isQueued) {
      await state.reportError({
        recovery: CHECK_STATE,
        title: "Couldn't wake the Implementer on the failed checks",
        error: new Error("The message wasn't saved to the queue."),
        sessionId: fact.sessionId,
      });
      return;
    }
    wakes.set(key, count + 1);
    await state.drainAgentQueue({ sessionId: fact.sessionId, agentId });
  } catch (error) {
    await state.reportError({
      recovery: CHECK_STATE,
      title: "Couldn't wake the Implementer on the failed checks",
      error,
      sessionId: fact.sessionId,
    });
  } finally {
    pending.delete(key);
  }
};
