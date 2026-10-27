import { brandId, type Agent, type AgentId, type ResolveAttempt } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { openFixComments } from '../../../../../store/slices/resolve/openFixComments';
import { sceneClock } from '../../sceneClock';
import { SESSION_ID } from '../resolveSeed';
import { BULK_LAUNCH_THREAD_IDS, seedBulkScene } from '../bulkSeed';

const clock = sceneClock({ anchor: '2026-10-10T09:40:00.000Z' });
const startedAt = clock.iso({ at: '2026-10-10T09:36:00.000Z' });
const RESOLVER_ID = brandId<AgentId>({ value: 'agent-fix-comments-1' });

export type FixCommentsPhase = 'list' | 'selected' | 'running';

type Params = {
  readonly phase: FixCommentsPhase;
};

const runningResolver = (): Agent => ({
  id: RESOLVER_ID,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Fix comments · 3 comments',
  status: 'running',
  kind: 'resolver',
  sourceKind: 'review_comment',
  sourceThreadIds: BULK_LAUNCH_THREAD_IDS.slice(0, 3),
  startedAt,
  modelOverride: 'claude-sonnet-5-5',
  providerOverride: 'anthropic',
  effort: 'medium',
});

const attemptOf = (): ResolveAttempt => ({
  id: 'attempt-fix-comments-1',
  sessionId: SESSION_ID,
  agentId: RESOLVER_ID,
  prNumber: null,
  threadIds: BULK_LAUNCH_THREAD_IDS.slice(0, 3),
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  instructions: null,
  phase: 'running',
  mountTarget: null,
  startedAt: Date.parse(startedAt),
  endedAt: null,
  error: null,
  createdAt: Date.parse(startedAt),
  batchId: 'batch-fix-comments-1',
  launchId: 'launch-fix-comments-1',
  copyPath: null,
  launchChoice: {
    mode: 'apply',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: 'medium',
    commitStyle: 'new',
    hint: null,
  },
});

export const fixCommentsSeed = ({ phase }: Params): void => {
  seedBulkScene({ stage: 'launch' });
  if (phase === 'running') {
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION_ID]: [runningResolver()] },
      sessionResolveAttempts: { [SESSION_ID]: [attemptOf()] },
    });
  }
  const state = useAppStore.getState();
  openFixComments({
    openDrawer: state.openDrawer,
    sessionId: SESSION_ID,
    mountId: null,
    threadIds: phase === 'selected' ? BULK_LAUNCH_THREAD_IDS.slice(0, 3) : [],
  });
};
