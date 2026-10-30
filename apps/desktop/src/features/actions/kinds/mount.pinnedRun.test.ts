// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type ProjectId, type WorkflowRunId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { pinnedRunsOf } from '../../../store/slices/workflows/runMount/pinnedRunsOf';
import {
  FIXTURE_NOW,
  RUN,
  SESSION,
  agentFixture,
  runFixture,
  sessionFixture,
} from '../../../__tests__/helpers/actionFixtures';
import { resolveActions } from '../resolveActions';
import { toMenuEntries } from '../toMenuEntries';
import type { ActionEnv } from '../types';
import { MOUNT_KIND } from './mount';
import type { MountFacts } from './mountFacts';

const MOUNT_ID = brandId<MountId>({ value: 'mount-refactor' });
const RUN_TITLE = 'Speed up the ledger export';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const facts = (overrides: Partial<MountFacts>): MountFacts => ({
  sessionId: SESSION,
  mountId: MOUNT_ID,
  projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
  label: 'ak/refactor-ledger',
  branch: 'ak/refactor-ledger',
  baseBranch: 'main',
  mountBaseBranch: null,
  worktreePath: '/work/ledger-core',
  keptPath: '/work/ledger-core',
  isRepo: true,
  isClosed: false,
  isBranchGone: false,
  canRestoreBranch: false,
  pr: null,
  requestLabel: null,
  requestNumber: null,
  requestProvider: null,
  createProvider: null,
  ahead: 0,
  unpushed: 0,
  behind: 0,
  dirty: 0,
  isDiverged: false,
  onlyOnline: null,
  isRebasing: false,
  rebaseConflict: null,
  autoBlockedReason: null,
  comments: 0,
  canStartTurnsHere: false,
  isScribeWriting: false,
  blockers: [],
  pinnedRunIds: [],
  pinnedRunLabel: null,
  editors: [],
  ...overrides,
});

const PINNED = {
  pinnedRunIds: [RUN],
  pinnedRunLabel: RUN_TITLE,
} satisfies Partial<MountFacts>;

const closeOf = ({ overrides }: { readonly overrides: Partial<MountFacts> }) =>
  resolveActions({ definitions: MOUNT_KIND.actions, facts: facts(overrides) }).find(
    (action) => action.id === 'mount.close',
  );

describe('detaching a branch an unfinished run still writes to', () => {
  it('names the run and offers Stop run first or Detach anyway', () => {
    const confirm = closeOf({ overrides: PINNED })?.confirm;

    expect(confirm?.description).toContain(`The run "${RUN_TITLE}" still writes to this branch.`);
    expect(confirm?.confirmLabel).toBe('Detach anyway');
    expect(confirm?.altActionId).toBe('mount.stopPinnedRun');
    expect(confirm?.altLabel).toBe('Stop run first');
  });

  it('turns the alternative into the Stop run first button of the menu confirm', () => {
    const actions = resolveActions({ definitions: MOUNT_KIND.actions, facts: facts(PINNED) });

    const entries = toMenuEntries({ actions, env, run: async () => undefined });
    const close = entries.find((entry) => entry.kind === 'item' && entry.key === 'mount.close');

    expect(close?.kind === 'item' ? close.confirm?.alt?.label : null).toBe('Stop run first');
  });

  it('keeps the plain close confirm when no run uses the branch', () => {
    const confirm = closeOf({ overrides: {} })?.confirm;

    expect(confirm?.confirmLabel).toBe('Close branch');
    expect(confirm?.altActionId).toBeUndefined();
    expect(
      resolveActions({ definitions: MOUNT_KIND.actions, facts: facts({}) }).some(
        (action) => action.id === 'mount.stopPinnedRun',
      ),
    ).toBe(false);
  });

  it('counts a second run in the same sentence', () => {
    const confirm = closeOf({
      overrides: {
        pinnedRunIds: [RUN, brandId<WorkflowRunId>({ value: 'run-second' })],
        pinnedRunLabel: RUN_TITLE,
      },
    })?.confirm;

    expect(confirm?.description).toContain(`"${RUN_TITLE}" and 1 more still write to this branch.`);
  });

  it('stops every run that uses the branch when Stop run first is pressed', async () => {
    const stopWorkflowRunNow = vi.fn(async () => undefined);
    useAppStore.setState({ stopWorkflowRunNow });
    const stop = MOUNT_KIND.actions.find((action) => action.id === 'mount.stopPinnedRun');

    await stop?.run({
      facts: facts({
        pinnedRunIds: [RUN, brandId<WorkflowRunId>({ value: 'run-second' })],
      }),
      env,
      choice: null,
    });

    expect(stopWorkflowRunNow).toHaveBeenCalledTimes(2);
    expect(stopWorkflowRunNow).toHaveBeenCalledWith(SESSION, RUN);
  });
});

describe('which runs count as using a branch', () => {
  const seed = ({ isStopped }: { readonly isStopped: boolean }) => {
    useAppStore.setState({
      sessions: [
        sessionFixture({
          workflowRuns: [
            runFixture({
              title: RUN_TITLE,
              executionMode: 'dynamic',
              ...(isStopped && {
                orchestrationStop: { kind: 'operator' as const, message: 'You stopped this run.' },
              }),
            }),
          ],
        }),
      ],
      sessionPhaseRuns: {
        [SESSION]: [
          agentFixture({
            id: brandId<ReturnType<typeof agentFixture>['id']>({ value: 'agent-pinned' }),
            workflowRunId: RUN,
            status: 'completed',
            mountId: MOUNT_ID,
            startedAt: FIXTURE_NOW,
          }),
        ],
      },
    });
  };

  it('lists an open run whose step was pinned to the branch, with its title', () => {
    seed({ isStopped: false });

    expect(
      pinnedRunsOf({ state: useAppStore.getState(), sessionId: SESSION, mountId: MOUNT_ID }),
    ).toEqual([{ runId: RUN, label: RUN_TITLE }]);
  });

  it('drops the run once it was stopped, so the guard disappears after Stop run first', () => {
    seed({ isStopped: true });

    expect(
      pinnedRunsOf({ state: useAppStore.getState(), sessionId: SESSION, mountId: MOUNT_ID }),
    ).toEqual([]);
  });
});
