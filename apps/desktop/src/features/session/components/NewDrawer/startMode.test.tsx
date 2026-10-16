// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

vi.mock('../../../auto/useAutoTreeLimit', () => ({
  useAutoTreeLimit: () => ({
    usd: 5,
    isFromSession: false,
    isStored: true,
    change: () => undefined,
    persist: async () => undefined,
  }),
}));

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { AgentId, ProviderId, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { brandedId } from '../../../history/testing/brandedId';
import { WritePanel } from '../../../artifacts/components/WritePanel';
import type { AppStore } from '../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';

let useAppStore: StoryStore;
let NewDrawer: typeof import('./index').NewDrawer;

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-harborline' });
const GOAL = 'Find why webhooks retry';

const SESSION: Session = buildStorySession({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Retry payments through ledger-core',
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
});

const connected = (id: ProviderId): AppStore['providers'][number] => ({
  id,
  binary: id,
  capabilities: PROVIDER_CAPABILITIES[id],
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const stored = new Map<string, string>();
const spawnAgent = vi.fn<AppStore['spawnAgent']>();
const reportError = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
  ({ NewDrawer } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stored.clear();
  storySpies.getSetting.mockImplementation(
    async (_db: unknown, key: string) => stored.get(key) ?? null,
  );
  spawnAgent.mockReset();
  spawnAgent.mockResolvedValue(brandedId<AgentId>({ value: 'agent-1' }));
  reportError.mockClear();
  useAppStore.setState({
    workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID })],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    providers: [connected('anthropic')],
    phaseTemplates: { [WORKSPACE_ID]: [] },
    spawnAgent,
    reportError,
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const openAgentTab = (): void => {
  render(
    <AutoReleaseContext.Provider value>
      <ToastProvider>
        <NewDrawer
          sessionId={SESSION_ID}
          payload={{ form: 'agent' }}
          writePanel={WritePanel}
          onClose={vi.fn()}
        />
      </ToastProvider>
    </AutoReleaseContext.Provider>,
  );
};

const typeGoal = (): void => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Describe the work' }), {
    target: { value: GOAL },
  });
};

describe('the Agent tab with Auto always on', () => {
  it('shows the Auto composer and starts at once', async () => {
    openAgentTab();
    await screen.findByRole('textbox', { name: 'Describe the work' });
    typeGoal();

    fireEvent.click(screen.getByRole('button', { name: 'Start Auto' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      initialPrompt: GOAL,
    });
  });

  it('starts Auto even when an old experiment row still says false', async () => {
    stored.set('agents.autoExperiment', 'false');
    openAgentTab();
    await screen.findByRole('textbox', { name: 'Describe the work' });
    typeGoal();

    fireEvent.click(screen.getByRole('button', { name: 'Start Auto' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    expect(reportError).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Open Generalist' })).toBeNull();
  });
});
