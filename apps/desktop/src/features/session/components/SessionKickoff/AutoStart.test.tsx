// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getCapabilities } from '@goodboy/core';
import type { ProviderId, Session } from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { StartSessionFromDraftParams } from '../../../../store/slices/sessionDraft/startSessionFromDraft';
import type { ProviderDisplayInfo } from '../../../providers/providers';
import { SETTING_CLASSIFY_REQUESTS } from '../../../settings/settings';
import { AutoStart } from './AutoStart';

const WORKSPACE = aWorkspace({ name: 'Cascadia' });

const GOAL = 'Where does payments-api validate a refund?';

const providerInfo = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: getCapabilities({ id }),
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

type StartFn = (params: StartSessionFromDraftParams) => Promise<Session>;

let useAppStore: StoryStore;
let startSessionFromDraft: ReturnType<typeof vi.fn<StartFn>>;

const answer = ({ result }: { readonly result: string }) =>
  stubStoryInvoke({
    summarize_session: () => ({ stdout: JSON.stringify({ result }), stderr: '', exitCode: 0 }),
  });

const startedAgentKind = (): string | null => {
  const start = startSessionFromDraft.mock.calls[0]?.[0]?.start;
  return start?.kind === 'scout' ? start.agentKind : null;
};

const submitGoal = async () => {
  render(
    <ToastProvider>
      <AutoStart workspaceId={WORKSPACE.id} />
    </ToastProvider>,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Describe the work' }), {
    target: { value: GOAL },
  });
  fireEvent.click(screen.getByRole('button', { name: /^Start/ }));
  await waitFor(() => expect(startSessionFromDraft).toHaveBeenCalledTimes(1));
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  startSessionFromDraft = vi.fn<StartFn>(async () =>
    aSession({ workspaceId: WORKSPACE.id, goal: GOAL }),
  );
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    providers: [providerInfo({ id: 'anthropic' })],
    providerCooldowns: {},
    workspaceOverrides: {},
    startSessionFromDraft,
  });
});

afterEach(cleanup);

describe('AutoStart', () => {
  it('starts the Auto agent on the request as typed while the classifier is off', async () => {
    answer({ result: '{"role":"scout","difficulty":"light"}' });

    await submitGoal();

    expect(startedAgentKind()).toBe('auto');
  });

  it('starts the role the classifier names once it is on', async () => {
    answer({ result: '{"role":"scout","difficulty":"light"}' });
    useAppStore.setState({ settings: { [SETTING_CLASSIFY_REQUESTS]: 'true' } });

    await submitGoal();

    expect(startedAgentKind()).toBe('scout');
  });

  it('starts the Auto agent when the classifier is not sure', async () => {
    answer({ result: '{"role":"none","difficulty":"standard"}' });
    useAppStore.setState({ settings: { [SETTING_CLASSIFY_REQUESTS]: 'true' } });

    await submitGoal();

    expect(startedAgentKind()).toBe('auto');
  });
});
