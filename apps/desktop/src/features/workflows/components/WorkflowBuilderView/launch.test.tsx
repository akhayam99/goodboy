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

import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId, Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { WorkflowBuilderView } from './index';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const session = buildStorySession({
  id: 'session-harborline' as SessionId,
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

let useAppStore: StoryStore;
const attachWorkflowToSession = vi.fn<AppStore['attachWorkflowToSession']>();
const savePhaseTemplate = vi.fn<AppStore['savePhaseTemplate']>();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  attachWorkflowToSession.mockReset();
  attachWorkflowToSession.mockResolvedValue(undefined);
  savePhaseTemplate.mockReset();
  useAppStore.setState({
    workspaces: [harborline],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [session],
    providers: [connected('anthropic')],
    phaseTemplates: { [WORKSPACE_ID]: [] },
    attachWorkflowToSession,
    savePhaseTemplate,
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type KickoffProps = {
  readonly target: Session;
};

const Kickoff = ({ target }: KickoffProps) => {
  const [goal, setGoal] = useState('');
  return (
    <ToastProvider>
      <WorkflowBuilderView
        mode="dynamic"
        kickoff={{
          workspaceId: WORKSPACE_ID,
          goal,
          goalPlaceholder: 'What should get done?',
          onGoalChange: setGoal,
          start: async (run) => run(target),
        }}
      />
    </ToastProvider>
  );
};

describe('WorkflowBuilderView on the real store: autonomy', () => {
  it('asks me by default and starts on autopilot when you choose it', async () => {
    render(<Kickoff target={session} />);
    fireEvent.change(screen.getByPlaceholderText('What should get done?'), {
      target: { value: 'Retry payments through ledger-core' },
    });

    screen.getByRole('button', { name: 'Autonomy: Ask me' });
    expect(screen.queryByRole('switch', { name: 'Autorun' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Autonomy: Ask me' }));
    fireEvent.click(screen.getByRole('radio', { name: /^Autopilot/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      autoRun: true,
      executionMode: 'dynamic',
    });
  });

  it('offers the three names in the pill', () => {
    render(<Kickoff target={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Autonomy: Ask me' }));
    expect(
      screen.getAllByRole('radio').map((option) => option.querySelector('span span')?.textContent),
    ).toEqual(['Ask me', 'Balanced', 'Autopilot']);
  });
});
