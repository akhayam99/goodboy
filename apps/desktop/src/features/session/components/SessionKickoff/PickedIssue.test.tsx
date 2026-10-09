// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AgentId, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { IssueBriefEntry } from '../../../../store/slices/issue-briefs/types';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { PickedIssue } from './PickedIssue';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;

const CANDIDATE: IssueCandidate = {
  provider: 'linear',
  externalId: 'issue-412',
  identifier: 'HBL-412',
  title: 'Retried webhooks post a second credit',
  url: 'https://linear.app/harborline/issue/HBL-412',
  goal: '[HBL-412] Retried webhooks post a second credit\n\nThe processor redelivers an event.',
  body: 'The processor redelivers an event.',
  branchSlug: 'retried-webhooks-post-a-second-credit',
};

const READY: IssueBriefEntry = {
  status: 'ready',
  signature: 'sig',
  route: { providerId: 'anthropic', model: 'haiku-4.5' },
  brief: {
    title: 'Stop retried webhooks posting a second credit',
    goal: 'payments-api credits an account once per processor event.',
    acceptance: ['Replaying one event three times posts one credit'],
  },
  durationMs: 4_000,
  costUsd: 0,
};

const BRIEF_GOAL = [
  'payments-api credits an account once per processor event.',
  'Done when:\n- Replaying one event three times posts one credit',
  'Issue: HBL-412 https://linear.app/harborline/issue/HBL-412',
].join('\n\n');

const created = vi.fn<StoreState['createSession']>(async (input) => ({
  session: aSession({
    id: 'session-new' as SessionId,
    workspaceId: WORKSPACE_ID,
    goal: input.goal,
  }),
}));

const spawned = vi.fn<StoreState['spawnAgent']>(async () => 'agent-new' as AgentId);

const requestBrief = vi.fn<StoreState['requestIssueBrief']>(async () => undefined);

const renderPicked = (onDismiss = vi.fn()) => {
  render(
    <ToastProvider>
      <PickedIssue workspaceId={WORKSPACE_ID} candidate={CANDIDATE} onDismiss={onDismiss} />
    </ToastProvider>,
  );
  return onDismiss;
};

const useAgent = () => fireEvent.click(screen.getByRole('tab', { name: 'Ask an agent' }));

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ workspaces_with_unread: [] });
  created.mockClear();
  spawned.mockClear();
  requestBrief.mockClear();
  useAppStore.setState({
    createSession: created,
    spawnAgent: spawned,
    requestIssueBrief: requestBrief,
    loadPhaseTemplates: async () => undefined,
  });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('PickedIssue', () => {
  it('shows one block right after the pick, with the issue text and no gate', () => {
    renderPicked();

    expect(screen.getByRole('region', { name: 'Brief from HBL-412' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Brief title' })).toHaveProperty(
      'value',
      CANDIDATE.title,
    );
    expect(screen.getByRole('tablist', { name: 'How to work on it' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Use brief' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('starts an agent from the edited title and goal, and raises one Follow toast', async () => {
    renderPicked();
    useAgent();

    fireEvent.change(screen.getByRole('textbox', { name: 'Brief title' }), {
      target: { value: 'Post one credit per event' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Agent instructions' }), {
      target: { value: 'Credit once per processor event id.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start from HBL-412' }));

    await waitFor(() => expect(created).toHaveBeenCalledOnce());
    expect(created.mock.calls[0]?.[0]).toMatchObject({
      workspaceId: WORKSPACE_ID,
      title: 'Post one credit per event',
      goal: 'Credit once per processor event id.',
      externalTasks: [
        {
          provider: 'linear',
          externalId: 'issue-412',
          identifier: 'HBL-412',
          url: CANDIDATE.url,
          title: CANDIDATE.title,
        },
      ],
    });
    await waitFor(() => expect(spawned).toHaveBeenCalledOnce());
    expect(spawned.mock.calls[0]).toEqual([
      'session-new',
      expect.objectContaining({
        kindOverride: 'implementer',
        initialPrompt: 'Credit once per processor event id.',
      }),
    ]);
    await waitFor(() => expect(screen.getAllByText('Session started')).toHaveLength(1));
  });

  it('swaps in the brief when it arrives, and the issue text and the brief by one link each', async () => {
    renderPicked();
    useAgent();
    expect(screen.getByRole('textbox', { name: 'Agent instructions' })).toHaveProperty(
      'value',
      CANDIDATE.goal,
    );

    useAppStore.setState({ issueBriefs: { 'linear:issue-412': READY } });

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Agent instructions' })).toHaveProperty(
        'value',
        BRIEF_GOAL,
      ),
    );
    expect(screen.getByRole('textbox', { name: 'Brief title' })).toHaveProperty(
      'value',
      READY.status === 'ready' ? READY.brief.title : '',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use the issue text' }));
    expect(screen.getByRole('textbox', { name: 'Agent instructions' })).toHaveProperty(
      'value',
      CANDIDATE.goal,
    );
    expect(screen.getByRole('textbox', { name: 'Brief title' })).toHaveProperty(
      'value',
      CANDIDATE.title,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use brief' }));
    expect(screen.getByRole('textbox', { name: 'Agent instructions' })).toHaveProperty(
      'value',
      BRIEF_GOAL,
    );
  });

  it('never replaces text the user already edited with the brief', async () => {
    renderPicked();
    useAgent();
    fireEvent.change(screen.getByRole('textbox', { name: 'Agent instructions' }), {
      target: { value: 'My own goal' },
    });

    useAppStore.setState({ issueBriefs: { 'linear:issue-412': READY } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Use brief' })).toBeDefined());
    expect(screen.getByRole('textbox', { name: 'Agent instructions' })).toHaveProperty(
      'value',
      'My own goal',
    );
  });

  it('keeps the draft and raises no toast when the start fails', async () => {
    created.mockRejectedValueOnce(new Error('worktree failed'));
    renderPicked();
    useAgent();

    fireEvent.click(screen.getByRole('button', { name: 'Start from HBL-412' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('worktree failed'));
    expect(screen.queryByText('Session started')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Agent instructions' })).toHaveProperty(
      'value',
      CANDIDATE.goal,
    );
  });

  it('hands Dismiss to the list', () => {
    const onDismiss = renderPicked();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
