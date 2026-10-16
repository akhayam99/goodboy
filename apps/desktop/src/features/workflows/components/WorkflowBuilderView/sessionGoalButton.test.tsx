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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { brandedId } from '../../../history/testing/brandedId';
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

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });

const session = buildStorySession({
  id: brandedId<SessionId>({ value: 'session-harborline' }),
  workspaceId: WORKSPACE_ID,
  goal: 'Retry payments through ledger-core',
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' })],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [session],
    phaseTemplates: { [WORKSPACE_ID]: [] },
    sessionSlots: {
      [session.id]: [{ key: 'goal', value: 'Retry payments through ledger-core', enabled: true }],
    },
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('WorkflowBuilderView, Use session goal', () => {
  it('is offered in a session that has a goal slot', () => {
    render(
      <ToastProvider>
        <WorkflowBuilderView mode="dynamic" session={session} onClose={() => undefined} />
      </ToastProvider>,
    );

    expect(screen.getByRole('button', { name: /use session goal/i })).toBeDefined();
  });

  it('is not offered on the New session page', () => {
    render(
      <ToastProvider>
        <WorkflowBuilderView
          mode="dynamic"
          kickoff={{
            workspaceId: WORKSPACE_ID,
            goal: '',
            goalPlaceholder: 'What should get done?',
            onGoalChange: () => undefined,
            start: async () => undefined,
          }}
        />
      </ToastProvider>,
    );

    expect(screen.getByRole('textbox', { name: 'Goal' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /use session goal/i })).toBeNull();
  });
});
