// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverrideSettings, ProviderConnectionState, ProviderId } from '@goodboy/types';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { selectModelContext, selectResolution } from './index';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

const PAYMENTS = aProject({ workspaceId: WORKSPACE.id, name: 'payments-api' });

const LEDGER = aProject({ workspaceId: WORKSPACE.id, name: 'ledger-core' });

const SESSION = aSession({ workspaceId: WORKSPACE.id });

const providerInfo = ({
  id,
  connection = 'connected',
  version = null,
}: {
  readonly id: ProviderId;
  readonly connection?: ProviderConnectionState;
  readonly version?: string | null;
}): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection,
  version,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const withOverrides = (patch: Partial<OverrideSettings>): OverrideSettings => ({
  ...WORKSPACE.overrides,
  ...patch,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    sessions: [SESSION],
    providers: [
      providerInfo({ id: 'anthropic', version: '2.1.200' }),
      providerInfo({ id: 'codex' }),
      providerInfo({ id: 'gemini', connection: 'installed_disconnected' }),
    ],
    projects: [PAYMENTS, LEDGER],
  });
});

describe('selectModelContext', () => {
  it('lists the providers that can run and the CLI versions the machine has', () => {
    const { context } = selectModelContext({
      state: useAppStore.getState(),
      workspaceId: WORKSPACE.id,
    });

    expect(context.connected).toEqual(['anthropic', 'codex']);
    expect(context.cliVersions).toEqual({ anthropic: '2.1.200' });
  });

  it('in a session reads the workspace, the active project and the session', () => {
    useAppStore.setState({
      workspaceOverrides: { [WORKSPACE.id]: withOverrides({ defaultProviderId: 'anthropic' }) },
      sessionActiveProject: { [SESSION.id]: PAYMENTS.id },
      sessionOverrides: { [SESSION.id]: withOverrides({ defaultProviderId: 'codex' }) },
    });

    const { layers, workspaceId } = selectModelContext({
      state: useAppStore.getState(),
      sessionId: SESSION.id,
    });

    expect(workspaceId).toBe(WORKSPACE.id);
    expect(layers.workspace?.defaultProviderId).toBe('anthropic');
    expect(layers.project).toBe(PAYMENTS.overrides);
    expect(layers.session?.defaultProviderId).toBe('codex');
  });
});

describe('selectResolution', () => {
  const PIN = { providerId: 'anthropic', model: 'opus-5', effort: 'high' } as const;

  const SONNET = { providerId: 'anthropic', model: 'sonnet-5', effort: 'medium' } as const;

  it('lets the session pin win over the workspace pin and names the layer', () => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE.id]: withOverrides({ roleModels: { planner: PIN } }),
      },
      sessionOverrides: {
        [SESSION.id]: withOverrides({ roleModels: { planner: SONNET } }),
      },
    });

    const resolution = selectResolution({
      state: useAppStore.getState(),
      sessionId: SESSION.id,
      slot: { kind: 'role', id: 'planner' },
    });

    expect(resolution).toMatchObject({ model: 'sonnet-5', source: 'session', via: 'pin' });
  });

  it('skips a pin on a provider that is Off and says so', () => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE.id]: withOverrides({
          providerPool: [
            { id: 'codex', state: 'on' },
            { id: 'anthropic', state: 'off' },
          ],
          roleModels: { planner: PIN },
        }),
      },
    });

    const resolution = selectResolution({
      state: useAppStore.getState(),
      workspaceId: WORKSPACE.id,
      slot: { kind: 'role', id: 'planner' },
    });

    expect(resolution).toMatchObject({ provider: 'codex', source: 'auto' });
    expect(resolution.skipped).toEqual([
      { source: 'workspace', provider: 'anthropic', model: 'opus-5', reason: 'off' },
    ]);
  });

  it('never lets a project pin win: the workspace pin runs', () => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE.id]: withOverrides({
          taskModels: { summarizer: { providerId: 'anthropic', model: 'claude-opus-5-5' } },
        }),
      },
      projects: [
        {
          ...PAYMENTS,
          overrides: withOverrides({
            taskModels: { summarizer: { providerId: 'anthropic', model: 'claude-sonnet-5' } },
          }),
        },
        LEDGER,
      ],
      sessionActiveProject: { [SESSION.id]: PAYMENTS.id },
    });

    const resolution = selectResolution({
      state: useAppStore.getState(),
      sessionId: SESSION.id,
      slot: { kind: 'task', id: 'summarizer' },
    });

    expect(resolution).toMatchObject({ model: 'opus-5.5', source: 'workspace' });
  });

  it('answers for Auto alone when asked, and keeps the provider policy', () => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE.id]: withOverrides({
          providerPool: [{ id: 'codex', state: 'on' }],
          roleModels: { planner: PIN },
        }),
      },
    });

    const resolution = selectResolution({
      state: useAppStore.getState(),
      workspaceId: WORKSPACE.id,
      slot: { kind: 'role', id: 'planner' },
      isAutoOnly: true,
    });

    expect(resolution).toMatchObject({ provider: 'codex', source: 'auto', skipped: [] });
  });
});
