import type { AgentId, IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';
import type { SendTurnInput, SendTurnResult } from '../../../../../store/slices/turn/types';
import type { DirectorStore } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';
import { startAgentTurn } from './startAgentTurn';
import { finishAgentTurn } from './finishAgentTurn';

const THINK_MS = 1200;
const SENTENCE_MS = 1300;
const DONE_MS = 1500;

type Params = {
  readonly store: DirectorStore;
  readonly reply: string;
  readonly now: () => IsoDateTime;
};

type AgentParams = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly requested: AgentId | undefined;
};

const agentOf = ({ store, sessionId, requested }: AgentParams): AgentId | null => {
  if (requested !== undefined) {
    return requested;
  }
  const state = store.getState();
  const selected = state.selectedAgentId[sessionId];
  if (selected !== null && selected !== undefined) {
    return selected;
  }
  return state.sessionPhaseRuns[sessionId]?.[0]?.id ?? null;
};

type SplitParams = {
  readonly text: string;
};

const sentencesOf = ({ text }: SplitParams): ReadonlyArray<string> =>
  text
    .split('. ')
    .map(
      (part, index, parts) =>
        `${index === 0 ? '' : ' '}${part}${index < parts.length - 1 ? '.' : ''}`,
    );

type StreamParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
};

export const createSimulatedSend = ({ store, reply, now }: Params) => {
  let turns = 0;
  const stream = ({ sessionId, agentId, runId }: StreamParams): void => {
    const sentences = sentencesOf({ text: reply });
    sentences.forEach((delta, index) => {
      setTimeout(
        () => {
          appendTurnEvents({
            store,
            agentId,
            events: [{ kind: 'assistant_text', runId, delta, at: now() }],
          });
        },
        THINK_MS + index * SENTENCE_MS,
      );
    });
    setTimeout(
      () => {
        const at = now();
        appendTurnEvents({ store, agentId, events: [{ kind: 'done', runId, at }] });
        finishAgentTurn({ store, sessionId, agentId, at, isViewed: true });
      },
      THINK_MS + sentences.length * SENTENCE_MS + DONE_MS,
    );
  };
  return async ({
    sessionId,
    agentId: requested,
    content,
    onStarted,
  }: SendTurnInput): Promise<SendTurnResult> => {
    const agentId = agentOf({ store, sessionId, requested });
    if (agentId === null) {
      return { blockedOverBudget: false };
    }
    turns += 1;
    const runId = `demo-run-${agentId}-${turns}` as ProviderRunId;
    const at = now();
    appendTurnEvents({
      store,
      agentId,
      events: [{ kind: 'user_text', runId, text: content, at }],
    });
    store.setState((current) => ({
      agentDraft: Object.fromEntries(
        Object.entries(current.agentDraft).filter(([id]) => id !== agentId),
      ),
    }));
    startAgentTurn({ store, sessionId, agentId, runId, at });
    onStarted?.();
    stream({ sessionId, agentId, runId });
    return { blockedOverBudget: false };
  };
};
