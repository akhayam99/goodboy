// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../../features/workflows/workflows', async () =>
  (await import('../../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../../features/plans/plans', async () =>
  (await import('../../../storyHarness')).plansModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { MountId, MountPullRequestLink } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../storyHarness';
import { at, paymentsApi } from '../../../../features/workspace/testing/sessionColumn';
import { applyAgentTurnState } from '../../sessions/sessionMutators';
import {
  REPLAY_HOSTS,
  REPLAY_TIMES,
  replayAgent,
  replayErrorState,
  replayMountViewOf,
  replaySessionOf,
  replayStageOf,
  seedReplayAgents,
  seedReplayRequests,
  seedReplaySession,
  type ReplayHost,
  type ReplayRequestState,
} from '../testing/attentionReplay.fixtures';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type SceneParams = {
  readonly host: ReplayHost;
  readonly state: ReplayRequestState;
  readonly failedAt: string;
};

const sceneOf = ({ host, state, failedAt }: SceneParams) => {
  const session = seedReplaySession({
    store: useAppStore,
    session: replaySessionOf({ goal: 'Retry webhooks' }),
  });
  seedReplayRequests({
    store: useAppStore,
    session,
    requests: [{ host, project: paymentsApi, state, number: 301 }],
  });
  const mountId = replayMountViewOf({ session, project: paymentsApi }).id;
  useAppStore.setState((current) => ({
    mountGithub: Object.fromEntries(
      Object.entries(current.mountGithub).map(([id, entry]) => [
        id,
        entry.pr === null
          ? entry
          : { ...entry, pr: { ...entry.pr, mergedAt: REPLAY_TIMES.merged } },
      ]),
    ),
    mountRequests: Object.fromEntries(
      Object.entries(current.mountRequests).map(([id, entry]) => [
        id,
        entry.kind === 'gitlab' && entry.mr !== null
          ? { ...entry, mr: { ...entry.mr, mergedAt: REPLAY_TIMES.merged } }
          : entry,
      ]),
    ),
    mountPrLinks: {
      [mountId]: linkOf({ mountId, host, state }),
    },
  }));
  const failed = replayAgent({
    session,
    slug: 'summarize',
    status: 'failed',
    completedAt: failedAt,
  });
  seedReplayAgents({ store: useAppStore, session, agents: [failed] });
  applyAgentTurnState(
    (patch) => useAppStore.setState(patch),
    session.id,
    failed.id,
    replayErrorState({ failedAt }),
    at(failedAt),
  );
  return session;
};

type LinkParams = {
  readonly mountId: MountId;
  readonly host: ReplayHost;
  readonly state: ReplayRequestState;
};

const linkOf = ({ mountId, host, state }: LinkParams): MountPullRequestLink => ({
  id: 'link-retry',
  mountId,
  provider: host,
  host: `${host}.example.test`,
  repoSlug: 'harborline/payments-api',
  prNumber: 301,
  headBranch: 'harborline/retry',
  baseBranch: 'main',
  url: 'https://example.test/301',
  state,
  snapshot: null,
  mergedAt: state === 'merged' ? at(REPLAY_TIMES.merged) : null,
  lastObservedAt: at(REPLAY_TIMES.fetched),
  createdAt: at(REPLAY_TIMES.earlier),
  updatedAt: at(REPLAY_TIMES.fetched),
});

describe.each(REPLAY_HOSTS)('a failure and a %s merge', (host) => {
  it('leaves the board when the failure predates the merge', () => {
    const session = sceneOf({ host, state: 'merged', failedAt: REPLAY_TIMES.failed });

    expect(replayStageOf({ store: useAppStore, session })).toMatchObject({
      stage: 'done',
      attention: null,
    });
  });

  it('stays when the failure came after the merge', () => {
    const session = sceneOf({ host, state: 'merged', failedAt: REPLAY_TIMES.afterMerge });

    expect(replayStageOf({ store: useAppStore, session })).toMatchObject({
      stage: 'attention',
      attention: 'agent-error',
    });
  });

  it('stays while the request is open', () => {
    const session = sceneOf({ host, state: 'open', failedAt: REPLAY_TIMES.failed });

    expect(replayStageOf({ store: useAppStore, session })).toMatchObject({
      attention: 'agent-error',
    });
  });

  it('comes back when the merged request is reopened', () => {
    const session = sceneOf({ host, state: 'merged', failedAt: REPLAY_TIMES.failed });
    expect(replayStageOf({ store: useAppStore, session }).attention).toBeNull();

    seedReplayRequests({
      store: useAppStore,
      session,
      requests: [{ host, project: paymentsApi, state: 'open', number: 301 }],
    });
    useAppStore.setState({ mountPrLinks: {} });

    expect(replayStageOf({ store: useAppStore, session }).attention).toBe('agent-error');
  });
});
