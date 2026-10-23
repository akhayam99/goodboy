import type { AgentId, IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';
import type { SendTurnInput, SendTurnResult } from '../../../../../store/slices/turn/types';
import type { DirectorStore } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';
import { startAgentTurn } from './startAgentTurn';
import { finishAgentTurn } from './finishAgentTurn';
import type { ReplyRuns } from './createReplyRuns';

const THINK_MS = 1200;
const SENTENCE_MS = 1300;
const DONE_MS = 1500;

type Params = {
  readonly store: DirectorStore;
  readonly reply: string;
  readonly now: () => IsoDateTime;
  readonly shouldClearDraft: boolean;
  readonly runs: ReplyRuns;
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

type StartParams = StreamParams & {
  readonly content: string;
};

export const createSimulatedSend = ({ store, reply, now, shouldClearDraft, runs }: Params) => {
  const stream = ({ sessionId, agentId, runId }: StreamParams): void => {
    const sentences = sentencesOf({ text: reply });
    sentences.forEach((delta, index) => {
      runs.later({
        agentId,
        runId,
        delayMs: THINK_MS + index * SENTENCE_MS,
        run: () => {
          appendTurnEvents({
            store,
            agentId,
            events: [{ kind: 'assistant_text', runId, delta, at: now() }],
          });
        },
      });
    });
    runs.later({
      agentId,
      runId,
      delayMs: THINK_MS + sentences.length * SENTENCE_MS + DONE_MS,
      run: () => {
        const at = now();
        appendTurnEvents({ store, agentId, events: [{ kind: 'done', runId, at }] });
        runs.finish({
          agentId,
          runId,
          onIdle: () => finishAgentTurn({ store, sessionId, agentId, at, isViewed: true }),
        });
      },
    });
  };
  const start = ({ sessionId, agentId, runId, content }: StartParams): void => {
    const at = now();
    appendTurnEvents({
      store,
      agentId,
      events: [{ kind: 'user_text', runId, text: content, at }],
    });
    startAgentTurn({ store, sessionId, agentId, runId, at });
    stream({ sessionId, agentId, runId });
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
    const runId = runs.nextRunId({ agentId });
    if (shouldClearDraft) {
      store.setState((current) => ({
        agentDraft: Object.fromEntries(
          Object.entries(current.agentDraft).filter(([id]) => id !== agentId),
        ),
      }));
    }
    runs.enqueue({
      agentId,
      runId,
      start: () => start({ sessionId, agentId, runId, content }),
    });
    onStarted?.();
    return { blockedOverBudget: false };
  };
};
