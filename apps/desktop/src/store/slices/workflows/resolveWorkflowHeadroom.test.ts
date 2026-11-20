// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WORKFLOW_RULES,
  brandId,
  type IsoDateTime,
  type OverrideSettings,
  type ProviderLimits,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { EMPTY_OVERRIDES, aSession } from '@goodboy/types/testing';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());

import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';
import { resolveWorkflowHeadroom } from './resolveWorkflowHeadroom';

const HARBORLINE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'ws-northwind' });
const SESSION = aSession({ workspaceId: HARBORLINE });

const OUT_LIMITS: ProviderLimits = {
  providerId: 'anthropic',
  plan: 'max',
  status: 'ok',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'ok',
      usedFraction: 1,
      resetsAt: brandId<IsoDateTime>({ value: new Date(Date.now() + 3_600_000).toISOString() }),
    },
  ],
  observedAt: brandId<IsoDateTime>({ value: new Date().toISOString() }),
};

const KEEP_GOING = {
  ...EMPTY_OVERRIDES,
  providerPool: [{ id: 'anthropic', state: 'on', keepAfterLimit: true }],
} satisfies OverrideSettings;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [SESSION],
    providers: [],
    providerLimits: { anthropic: OUT_LIMITS },
  });
});

type ReadParams = {
  readonly sessionId: SessionId;
};

const read = ({ sessionId }: ReadParams) =>
  resolveWorkflowHeadroom({
    get: useAppStore.getState,
    sessionId,
    rules: DEFAULT_WORKFLOW_RULES,
  });

describe('resolveWorkflowHeadroom', () => {
  it('reads the provider pool of the session workspace, not the one on screen', async () => {
    useAppStore.setState({
      currentWorkspaceId: NORTHWIND,
      workspaceOverrides: { [HARBORLINE]: KEEP_GOING, [NORTHWIND]: EMPTY_OVERRIDES },
    });

    const headroom = await read({ sessionId: SESSION.id });

    expect(headroom?.anthropic).toBe('tight');
  });

  it('never borrows the pool of the workspace on screen for a session it cannot find', async () => {
    useAppStore.setState({
      currentWorkspaceId: NORTHWIND,
      workspaceOverrides: { [NORTHWIND]: KEEP_GOING },
    });

    const headroom = await read({ sessionId: brandId<SessionId>({ value: 'session-gone' }) });

    expect(headroom?.anthropic).toBe('out');
  });
});
