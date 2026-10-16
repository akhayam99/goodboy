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
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';

let useAppStore: StoryStore;
let CreateAgentPopover: typeof import('./index').CreateAgentPopover;

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-harborline' });

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

beforeAll(async () => {
  useAppStore = await importStore();
  ({ CreateAgentPopover } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stored.clear();
  storySpies.getSetting.mockImplementation(
    async (_db: unknown, key: string) => stored.get(key) ?? null,
  );
  spawnAgent.mockReset();
  spawnAgent.mockResolvedValue(brandedId<AgentId>({ value: 'agent-1' }));
  useAppStore.setState({
    workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID })],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    providers: [connected('anthropic')],
    spawnAgent,
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly isReleased: boolean;
};

const mount = ({ isReleased }: MountParams): void => {
  render(
    <AutoReleaseContext.Provider value={isReleased}>
      <CreateAgentPopover sessionId={SESSION_ID} />
    </AutoReleaseContext.Provider>,
  );
};

describe('Start agent with Auto always available', () => {
  const expectRoles = async (): Promise<void> => {
    fireEvent.click(screen.getByRole('button', { name: 'Start agent' }));
    expect(await screen.findByRole('button', { name: 'Start Generalist' })).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Describe the work' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start Auto' })).toBeNull();
  };

  it('opens the role grid while Auto is released, and starts the picked role', async () => {
    mount({ isReleased: true });
    await expectRoles();

    fireEvent.click(screen.getByRole('button', { name: 'Start Generalist' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    expect(spawnAgent.mock.calls[0]?.[1]).not.toMatchObject({ kindOverride: 'auto' });
  });

  it('opens the role grid whatever an old experiment row says', async () => {
    stored.set('agents.autoExperiment', 'true');
    useAppStore.setState({ settings: { 'agents.autoExperiment': 'true' } });
    mount({ isReleased: true });
    await expectRoles();
  });

  it('opens the role grid in the build that ships', async () => {
    render(<CreateAgentPopover sessionId={SESSION_ID} />);
    await expectRoles();
  });

  it('opens the role grid while the release gate is closed', async () => {
    mount({ isReleased: false });
    await expectRoles();
  });
});
