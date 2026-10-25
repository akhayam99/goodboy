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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getSetting, insertWorkspace } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type Project,
  type ProjectId,
} from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStoryProject,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { runRoutesKey } from '../../../session/startRun/runRoutesSetting';
import { FirstSessionStep } from './FirstSessionStep';

let useAppStore: StoryStore;

type StoryState = ReturnType<StoryStore['getState']>;

const ACME = aWorkspace({ name: 'Acme' });

const AGENT = brandId<AgentId>({ value: 'agent-acme-web' });

const ACME_WEB: Project = buildStoryProject({
  workspaceId: ACME.id,
  id: brandId<ProjectId>({ value: 'project-acme-web' }),
  name: 'acme-web',
  rootPath: '/mock/Code/acme-web',
  kind: 'repo',
  baseBranch: 'main',
});

const LINEAR_ISSUES = [
  {
    id: 'mock-linear-acm-112',
    identifier: 'ACM-112',
    title: 'Checkout submits twice on a slow network',
    description: null,
    url: 'https://example.invalid/linear/ACM-112',
    state: { name: 'Todo', type: 'unstarted' },
    team: { key: 'ACM' },
    updatedAt: STORY_NOW,
  },
  {
    id: 'mock-linear-acm-113',
    identifier: 'ACM-113',
    title: 'Refund totals drift on partial captures',
    description: null,
    url: 'https://example.invalid/linear/ACM-113',
    state: { name: 'Todo', type: 'unstarted' },
    team: { key: 'ACM' },
    updatedAt: STORY_NOW,
  },
];

const connectLinear = () =>
  useAppStore.setState({
    workspaceIntegrations: {
      [ACME.id]: [
        {
          id: brandId<IntegrationBindingId>({ value: 'binding-linear' }),
          workspaceId: ACME.id,
          projectId: null,
          credentialId: brandId<IntegrationCredentialId>({ value: 'credential-linear' }),
          provider: 'linear',
          config: { workspaceUrlKey: 'acme', viewerUserId: 'viewer-dana', viewerName: 'Dana K.' },
          createdAt: STORY_NOW,
          updatedAt: STORY_NOW,
        },
      ],
    },
  });

const renderStep = () => {
  const handlers = {
    onStarted: vi.fn(),
    onDraft: vi.fn(),
    onSkip: vi.fn(),
    onOpenTools: vi.fn(),
  };
  render(
    <ToastProvider>
      <FirstSessionStep
        workspaceId={ACME.id}
        folder={ACME_WEB}
        mode="full"
        isLocked={false}
        onBack={() => undefined}
        {...handlers}
      />
    </ToastProvider>,
  );
  return handlers;
};

const field = () => {
  const input = screen.getByRole('textbox', { name: 'Start a run' });
  if (!(input instanceof HTMLTextAreaElement)) {
    throw new Error('the Start a run field is not a text area');
  }
  return input;
};

const askTab = () => screen.getByRole('tab', { name: 'Ask about the code' });

const issueTab = () => screen.getByRole('tab', { name: 'Pick up an issue' });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: ACME });
  useAppStore.setState({
    workspaces: [ACME],
    currentWorkspaceId: ACME.id,
    projects: [ACME_WEB],
  });
  stubStoryInvoke({ linear_fetch_assigned_issues: LINEAR_ISSUES });
});

afterEach(cleanup);

describe('FirstSessionStep with no task source', () => {
  it('opens on the real Start a run field with the first starter and the Limit chip', () => {
    renderStep();

    expect(field().value).toContain('Explain how acme-web is organized');
    screen.getByRole('region', { name: 'Start a run' });
    screen.getByRole('button', { name: /^Limit \$/ });
    screen.getByRole('button', { name: 'Explain how acme-web is organized' });
    screen.getByRole('heading', { name: 'Start your first session' });
  });

  it('draws no pill that looks like a control and does nothing', () => {
    renderStep();

    expect(screen.queryByText('reads only')).toBeNull();
    expect(screen.queryByText('Auto')).toBeNull();
    expect(screen.queryByText('Claude')).toBeNull();
    screen.getByText(/Scout reads acme-web and answers in a new session/);
  });

  it('marks the Start run button as the setup demo anchor for the playground', () => {
    renderStep();

    const anchored = document.querySelector('[data-demo-anchor="setup-first-start"]');
    expect(anchored?.textContent).toContain('Start');
    expect(anchored?.closest('[aria-label="Start a run"]')).not.toBeNull();
  });

  it('puts the folder in the draft so the session mounts it', () => {
    renderStep();

    expect(useAppStore.getState().sessionDrafts[ACME.id]?.projectIds).toEqual([ACME_WEB.id]);
  });

  it('fills the field from a starter chip', () => {
    renderStep();

    fireEvent.click(screen.getByRole('button', { name: 'Find one small bug' }));

    expect(field().value).toContain('Find one small, real bug in acme-web');
    expect(
      screen.getByRole('button', { name: 'Find one small bug' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('starts one Scout in a new session, keeps the reason with it and hands back', async () => {
    const session = aSession({ workspaceId: ACME.id, goal: 'Explain how acme-web is organized' });
    const spawnAgent = vi.fn<StoryState['spawnAgent']>(async () => AGENT);
    const startSessionFromDraft = vi.fn<StoryState['startSessionFromDraft']>(async ({ start }) => {
      if (start.kind === 'workflow-run') {
        await start.run(session);
      }
      return session;
    });
    useAppStore.setState({ spawnAgent, startSessionFromDraft, sessions: [session] });
    const handlers = renderStep();

    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));

    await waitFor(() => expect(handlers.onStarted).toHaveBeenCalledOnce());
    expect(startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: ACME.id,
      start: expect.objectContaining({
        kind: 'workflow-run',
        goal: expect.stringContaining('Explain how acme-web is organized'),
      }),
    });
    expect(spawnAgent).toHaveBeenCalledWith(
      session.id,
      expect.objectContaining({ kindOverride: 'scout' }),
    );
    const stored = await getSetting(storySqlite(), runRoutesKey({ sessionId: session.id }));
    expect(JSON.parse(stored ?? '{}')[AGENT]).toMatchObject({ role: 'scout', row: 1 });
  });

  it('keeps the text and reads Retry when the session does not start', async () => {
    useAppStore.setState({
      startSessionFromDraft: vi.fn<StoryState['startSessionFromDraft']>(async () => {
        throw new Error('the worktree could not be created');
      }),
    });
    const handlers = renderStep();

    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('the worktree could not be created'),
    );
    expect(handlers.onStarted).not.toHaveBeenCalled();
    screen.getByRole('button', { name: /^retry/i });
    expect(field().value).toContain('Explain how acme-web is organized');
  });

  it('skips with the one skip word and gives the starter text back', () => {
    const handlers = renderStep();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(handlers.onSkip).toHaveBeenCalledOnce();
    expect(useAppStore.getState().sessionDrafts[ACME.id]?.workflowGoal).toBe('');
  });

  it('keeps what you wrote when you skip', () => {
    const handlers = renderStep();
    fireEvent.change(field(), { target: { value: 'Why does ledger-core retry twice?' } });

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(handlers.onSkip).toHaveBeenCalledOnce();
    expect(useAppStore.getState().sessionDrafts[ACME.id]?.workflowGoal).toBe(
      'Why does ledger-core retry twice?',
    );
  });

  it('hides the issue tab until a task source is connected and points at Tools', () => {
    const handlers = renderStep();

    expect(screen.queryByRole('tab', { name: 'Pick up an issue' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Tools' }));

    expect(handlers.onOpenTools).toHaveBeenCalledOnce();
  });
});

describe('FirstSessionStep with a task source and open issues', () => {
  beforeEach(() => {
    connectLinear();
  });

  it('opens on Pick up an issue with the first issue selected', async () => {
    renderStep();

    const first = await screen.findByRole('button', { name: /ACM-112/ });
    expect(issueTab().getAttribute('aria-selected')).toBe('true');
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('textbox', { name: 'Start a run' })).toBeNull();
  });

  it('drafts the brief of the first issue without another click', async () => {
    const handlers = renderStep();
    await screen.findByRole('button', { name: /ACM-112/ });

    fireEvent.click(screen.getByRole('button', { name: /draft the brief/i }));

    expect(handlers.onDraft).toHaveBeenCalledWith({
      workspaceId: ACME.id,
      projectId: ACME_WEB.id,
      issue: expect.objectContaining({ identifier: 'ACM-112' }),
    });
  });

  it('drafts the brief of the issue you picked instead', async () => {
    const handlers = renderStep();

    fireEvent.click(await screen.findByRole('button', { name: /ACM-113/ }));
    fireEvent.click(screen.getByRole('button', { name: /draft the brief/i }));

    expect(handlers.onDraft).toHaveBeenCalledWith(
      expect.objectContaining({ issue: expect.objectContaining({ identifier: 'ACM-113' }) }),
    );
  });

  it('goes back to the question tab on a click and keeps the field there', async () => {
    renderStep();
    await screen.findByRole('button', { name: /ACM-112/ });

    fireEvent.click(askTab());

    expect(field().value).toContain('Explain how acme-web is organized');
    expect(askTab().getAttribute('aria-selected')).toBe('true');
  });

  it('stays on the question tab when you wrote your own ask before the issues came', async () => {
    const issuesRead = vi.fn(() => LINEAR_ISSUES);
    stubStoryInvoke({ linear_fetch_assigned_issues: issuesRead });
    useAppStore.getState().patchSessionDraft({
      workspaceId: ACME.id,
      patch: { workflowGoal: 'Why does ledger-core retry twice?' },
    });
    renderStep();

    await waitFor(() => expect(issuesRead).toHaveBeenCalled());
    await act(async () => undefined);
    expect(askTab().getAttribute('aria-selected')).toBe('true');
    expect(field().value).toBe('Why does ledger-core retry twice?');
    expect(within(screen.getByRole('tablist')).getAllByRole('tab')).toHaveLength(2);
  });
});

describe('FirstSessionStep with a task source and no open issue', () => {
  it('opens on Ask about the code', async () => {
    stubStoryInvoke({ linear_fetch_assigned_issues: [] });
    connectLinear();
    renderStep();

    await waitFor(() => expect(askTab().getAttribute('aria-selected')).toBe('true'));
    expect(field().value).toContain('Explain how acme-web is organized');
    expect(issueTab().getAttribute('aria-selected')).toBe('false');
  });
});
