import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProjectId, SessionExternalTask, SessionId } from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
let useAppStore: StoryStore;
beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
import type { TaskActionTarget } from '../types';
import { TASK_KIND, taskKeyOf } from './task';

const SESSION = 'session-ledger-export' as SessionId;
const PAYMENTS = 'project-payments-api' as ProjectId;
const STOREFRONT = 'project-storefront-web' as ProjectId;

const row = (overrides: Partial<SessionExternalTask>): SessionExternalTask => ({
  sessionId: SESSION,
  provider: 'github',
  externalId: '42',
  identifier: '#42',
  title: 'Refund rounds down',
  url: 'https://github.com/harborline/payments-api/issues/42',
  createdAt: '2026-10-02T09:00:00.000Z' as IsoDateTime,
  scope: 'session',
  ...overrides,
});

const PAYMENTS_ROW = row({ projectId: PAYMENTS });
const PAYMENTS_BRANCH = row({ projectId: PAYMENTS, scope: 'branch', branch: 'pay/fix-refund' });
const STOREFRONT_ROW = row({ projectId: STOREFRONT, title: 'Cart total off by one' });
const STOREFRONT_BRANCH = row({
  projectId: STOREFRONT,
  scope: 'branch',
  branch: 'sf/fix-cart',
  title: 'Cart total off by one',
});

const targetOf = (overrides: Partial<TaskActionTarget> = {}): TaskActionTarget => ({
  kind: 'task',
  sessionId: SESSION,
  provider: 'github',
  externalId: '42',
  projectId: PAYMENTS,
  branch: null,
  ...overrides,
});

const stateOf = (rows: ReadonlyArray<SessionExternalTask>) => {
  useAppStore.setState({
    sessionExternalTasks: { [SESSION]: rows },
    sessionProjectMounts: {},
  });
  return useAppStore.getState();
};

describe('task kind identity', () => {
  it('resolves facts from the row of the target project only', () => {
    const state = stateOf([STOREFRONT_ROW, STOREFRONT_BRANCH, PAYMENTS_ROW, PAYMENTS_BRANCH]);

    const facts = TASK_KIND.facts({ state, target: targetOf() });

    expect(facts?.row).toBe(PAYMENTS_ROW);
    expect(facts?.branchCount).toBe(1);
    expect(facts?.projectId).toBe(PAYMENTS);
  });

  it('finds no facts for a project that does not hold the task', () => {
    const state = stateOf([STOREFRONT_ROW]);

    expect(TASK_KIND.facts({ state, target: targetOf() })).toBeNull();
  });

  it('keys the same issue number in two projects apart', () => {
    expect(taskKeyOf(targetOf())).not.toBe(taskKeyOf(targetOf({ projectId: STOREFRONT })));
  });
});
