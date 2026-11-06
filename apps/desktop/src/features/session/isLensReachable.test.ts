// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type IsoDateTime,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { isLensReachable } from './isLensReachable';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const AT = brandId<IsoDateTime>({ value: '2026-09-28T10:00:00.000Z' });

const LINEAR: IntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-linear' }),
  workspaceId: WS,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-linear' }),
  createdAt: AT,
  updatedAt: AT,
  provider: 'linear',
  config: { workspaceUrlKey: 'harborline', viewerUserId: 'user-1', viewerName: 'Northwind' },
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = {
  readonly isArchived: boolean;
};

const seed = ({ isArchived }: SeedParams) => {
  store.setState({
    sessions: [
      aSession({
        id: SESSION,
        workspaceId: WS,
        ...(isArchived && { archivedAt: AT }),
      }),
    ],
    sessionBranches: { [SESSION]: 'ak/ledger-core-retries' },
    workspaceIntegrations: {
      [WS]: [LINEAR],
    },
  });
};

beforeEach(async () => {
  await resetStoryStore();
});

describe('isLensReachable', () => {
  it('reaches a connected provider chord on a live session', () => {
    seed({ isArchived: false });
    expect(isLensReachable({ state: store.getState(), sessionId: SESSION, lens: 'linear' })).toBe(
      true,
    );
  });

  it('does not reach the provider chord on an archived session, where Link work is gone', () => {
    seed({ isArchived: true });
    const state = store.getState();
    expect(isLensReachable({ state, sessionId: SESSION, lens: 'linear' })).toBe(false);
    expect(isLensReachable({ state, sessionId: SESSION, lens: 'review' })).toBe(true);
  });
});
