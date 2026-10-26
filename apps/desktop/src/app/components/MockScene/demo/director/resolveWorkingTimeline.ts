import type { AgentId, ProviderRunId, ResolveAttempt, SessionId } from '@goodboy/types';
import type { DemoTimeline, TimelineParams } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';
import { eventCue } from './eventCue';
import { finishAgentTurn } from './finishAgentTurn';
import { installResolveActions } from './installResolveActions';
import { patchAgent } from './patchAgent';
import { patchResolveThreads } from './patchResolveThreads';
import { RESOLVE_REPLY_DRAFT } from './resolveReplyDraft';

const SUMMARY =
  'Capped the retry loop, added the exhaustion metric, fixed the typo and moved the retry constant into config.';

type Target = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly attempt: ResolveAttempt;
};

const targetOf = ({ state }: TimelineParams): Target | null => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return null;
  }
  const attempt = (state.sessionResolveAttempts[sessionId] ?? []).find(
    (entry) => entry.phase === 'running',
  );
  if (attempt === undefined) {
    return null;
  }
  const turn = state.agentTurnState[attempt.agentId];
  if (turn?.kind !== 'running') {
    return null;
  }
  return { sessionId, agentId: attempt.agentId, runId: turn.runId, attempt };
};

type ShaParams = {
  readonly index: number;
};

const shaOf = ({ index }: ShaParams): string =>
  `${(index + 1).toString(16)}c4e2a9f07d1b8365e0f4a2c9d7b1e3f5a8c0d2e`.slice(0, 40);

export const resolveWorkingTimeline = ({ state }: TimelineParams): DemoTimeline => {
  const target = targetOf({ state });
  if (target === null) {
    return { setup: installResolveActions, prepare: () => undefined, cues: [] };
  }
  const { sessionId, agentId, runId, attempt } = target;
  return {
    setup: installResolveActions,
    prepare: () => undefined,
    cues: [
      eventCue({
        atMs: 1400,
        agentId,
        events: ({ at }) => [
          { kind: 'file_edit', runId, path: 'src/webhooks/config.ts', editType: 'modify', at },
          { kind: 'file_edit', runId, path: 'src/webhooks/retryPolicy.ts', editType: 'modify', at },
        ],
      }),
      eventCue({
        atMs: 2800,
        agentId,
        events: ({ at }) => [{ kind: 'assistant_text', runId, delta: `\n\n${SUMMARY}`, at }],
      }),
      {
        atMs: 4200,
        apply: ({ store, at }) => {
          appendTurnEvents({ store, agentId, events: [{ kind: 'done', runId, at }] });
          const now = Date.now();
          const threadIds = attempt.threadIds;
          patchResolveThreads({
            store,
            sessionId,
            threadIds,
            patch: ({ thread }) => ({
              ...thread,
              state: 'fixed',
              stage: 'proposed',
              disposition: 'fix',
              replyDraft: thread.replyDraft ?? RESOLVE_REPLY_DRAFT,
              commitShas: [shaOf({ index: threadIds.indexOf(thread.threadId) })],
              updatedAt: now,
            }),
          });
          store.setState((current) => ({
            sessionResolveAttempts: {
              ...current.sessionResolveAttempts,
              [sessionId]: (current.sessionResolveAttempts[sessionId] ?? []).map((entry) =>
                entry.id === attempt.id ? { ...entry, phase: 'finished', endedAt: now } : entry,
              ),
            },
          }));
          patchAgent({ store, sessionId, agentId, patch: { outputSummary: SUMMARY } });
          finishAgentTurn({ store, sessionId, agentId, at, isViewed: true });
        },
      },
    ],
  };
};
