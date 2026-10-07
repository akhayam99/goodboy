import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';

type CreateSession = (input: Readonly<Record<string, unknown>>) => Promise<{
  session: { id: string; goal: string };
}>;

const h = vi.hoisted(() => ({
  createSession: vi.fn<CreateSession>(async () => ({
    session: { id: 'session-9', goal: 'Fix the flake' },
  })),
  requestIssueBrief: vi.fn(async (_params: unknown) => undefined),
  showToast: vi.fn(),
  navigate: vi.fn(),
  issueBriefs: {} as Record<string, unknown>,
}));

vi.mock('../../../../store', () => {
  const storeState = () => ({
    createSession: h.createSession,
    requestIssueBrief: h.requestIssueBrief,
    issueBriefs: h.issueBriefs,
    navigate: h.navigate,
    currentWorkspaceId: null,
    currentSessionId: null,
    openSessionDraftWorkspaceId: null,
    appStudio: null,
    drawer: null,
  });
  return {
    useAppStore: Object.assign(
      <T,>(selector: (state: Record<string, unknown>) => T) => selector(storeState()),
      { getState: storeState },
    ),
  };
});

vi.mock('../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

import { LaunchSessionPanel } from './index';
import type { IssueBriefSource } from '../../../../store/slices/issue-briefs/types';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const EXTERNAL_TASK = {
  provider: 'gitlab' as const,
  externalId: '71',
  identifier: 'acme/web#7',
  url: 'https://gitlab.com/acme/web/-/issues/7',
  title: 'Fix the flake',
};

const BRIEF_SOURCE: IssueBriefSource = {
  ...EXTERNAL_TASK,
  body: 'The checkout test fails one run in five.',
  noun: 'issue',
};

const BRIEF_KEY = 'gitlab:71';

const READY_BRIEF = {
  status: 'ready',
  signature: 'sig',
  route: { providerId: 'anthropic', model: 'haiku-4.5' },
  brief: {
    title: 'Stabilize the checkout test',
    goal: 'The checkout test passes on every run.',
    acceptance: ['Ten runs in a row pass'],
  },
  durationMs: 4_000,
  costUsd: 0.002,
};

const BRIEF_GOAL = [
  'The checkout test passes on every run.',
  'Done when:\n- Ten runs in a row pass',
  'Issue: acme/web#7 https://gitlab.com/acme/web/-/issues/7',
].join('\n\n');

const renderPanel = (briefSource: IssueBriefSource | null = null) =>
  render(
    <LaunchSessionPanel
      workspaceId={WORKSPACE_ID}
      linkedSessionId={null}
      goalSeed="Fix the flake"
      externalTask={EXTERNAL_TASK}
      briefSource={briefSource}
      onClose={vi.fn()}
    />,
  );

beforeEach(() => {
  h.createSession.mockClear();
  h.requestIssueBrief.mockClear();
  h.showToast.mockClear();
  h.navigate.mockClear();
  h.issueBriefs = {};
});

afterEach(cleanup);

describe('LaunchSessionPanel', () => {
  it('launches without a project and omits project configuration', async () => {
    renderPanel();

    const launchButton = screen.getByRole('button', { name: /Launch session/i });
    expect(launchButton.getAttribute('disabled')).toBeNull();
    expect(screen.queryByText('Which project?')).toBeNull();

    fireEvent.click(launchButton);

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
    expect(h.createSession.mock.calls[0]?.[0]).toEqual({
      workspaceId: WORKSPACE_ID,
      goal: 'Fix the flake',
      externalTasks: [EXTERNAL_TASK],
    });
  });

  it('offers Follow to the new session as one info toast, never a success toast', async () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /Launch session/i }));

    await waitFor(() => expect(h.showToast).toHaveBeenCalledOnce());
    const toast = h.showToast.mock.calls[0]?.[0] as {
      readonly kind: string;
      readonly title: string;
      readonly message: string;
      readonly dedupeKey: string;
      readonly action: { readonly label: string; readonly onClick: () => void };
    };
    expect(toast).toMatchObject({
      kind: 'info',
      title: 'Session started',
      message: 'Fix the flake',
      dedupeKey: 'follow:session-9',
      action: { label: 'Follow' },
    });
    expect(h.showToast).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
    expect(h.navigate).not.toHaveBeenCalled();

    toast.action.onClick();

    expect(h.navigate).toHaveBeenCalledWith({
      to: {
        at: 'session',
        sessionId: 'session-9',
        view: { lens: null, agentId: null, studio: null, target: null },
      },
    });
  });

  it('keeps a failed launch inline and raises no toast', async () => {
    h.createSession.mockRejectedValueOnce(new Error('worktree is locked'));
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /Launch session/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('worktree is locked'),
    );
    expect(h.showToast).not.toHaveBeenCalled();
  });

  it('launches on the keyboard submit shortcut', async () => {
    renderPanel();

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Session goal' }), {
      key: 'Enter',
      metaKey: true,
    });

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
  });

  it('requires a non-empty goal', () => {
    renderPanel();

    fireEvent.change(screen.getByRole('textbox', { name: 'Session goal' }), {
      target: { value: '   ' },
    });

    expect(screen.getByRole('button', { name: /Launch session/i }).getAttribute('disabled')).toBe(
      '',
    );
  });

  it('asks for a brief once and launches with the verbatim text while it loads', async () => {
    h.issueBriefs = {
      [BRIEF_KEY]: { status: 'loading', signature: 'sig', route: READY_BRIEF.route },
    };
    renderPanel(BRIEF_SOURCE);

    expect(h.requestIssueBrief).toHaveBeenCalledWith({
      source: BRIEF_SOURCE,
      workspaceId: WORKSPACE_ID,
      sessionId: null,
    });
    expect(screen.getByRole('status').textContent).toBe('Writing a brief');

    fireEvent.click(screen.getByRole('button', { name: /Launch session/i }));

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
    expect(h.createSession.mock.calls[0]?.[0]).toEqual({
      workspaceId: WORKSPACE_ID,
      goal: 'Fix the flake',
      externalTasks: [EXTERNAL_TASK],
    });
  });

  it('fills the goal and the title from a ready brief', async () => {
    h.issueBriefs = { [BRIEF_KEY]: READY_BRIEF };
    renderPanel(BRIEF_SOURCE);

    const field = screen.getByRole('textbox', { name: 'Session goal' }) as HTMLTextAreaElement;
    expect(field.value).toBe(BRIEF_GOAL);
    expect(screen.getByText('Brief ready')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Launch session/i }));

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
    expect(h.createSession.mock.calls[0]?.[0]).toEqual({
      workspaceId: WORKSPACE_ID,
      goal: BRIEF_GOAL,
      title: 'Stabilize the checkout test',
      externalTasks: [EXTERNAL_TASK],
    });
  });

  it('never replaces text the user already edited', () => {
    h.issueBriefs = {};
    const view = renderPanel(BRIEF_SOURCE);
    const field = screen.getByRole('textbox', { name: 'Session goal' }) as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'My own goal' } });

    h.issueBriefs = { [BRIEF_KEY]: READY_BRIEF };
    view.rerender(
      <LaunchSessionPanel
        workspaceId={WORKSPACE_ID}
        linkedSessionId={null}
        goalSeed="Fix the flake"
        externalTask={EXTERNAL_TASK}
        briefSource={BRIEF_SOURCE}
        onClose={vi.fn()}
      />,
    );

    expect(field.value).toBe('My own goal');
  });

  it('switches back to the issue text and launches without the brief title', async () => {
    h.issueBriefs = { [BRIEF_KEY]: READY_BRIEF };
    renderPanel(BRIEF_SOURCE);

    fireEvent.click(screen.getByRole('button', { name: 'Show issue text' }));

    const field = screen.getByRole('textbox', { name: 'Session goal' }) as HTMLTextAreaElement;
    expect(field.value).toBe('Fix the flake');
    fireEvent.click(screen.getByRole('button', { name: /Launch session/i }));

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
    expect(h.createSession.mock.calls[0]?.[0]).not.toHaveProperty('title');
  });

  it('shows a failed brief inline and retries on demand', () => {
    h.issueBriefs = {
      [BRIEF_KEY]: {
        status: 'failed',
        signature: 'sig',
        route: READY_BRIEF.route,
        failure: 'missing_title',
        detail: null,
      },
    };
    renderPanel(BRIEF_SOURCE);

    expect(screen.getByRole('alert').textContent).toBe(
      "Couldn't write a brief. The model answered without a title.",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(h.requestIssueBrief).toHaveBeenLastCalledWith({
      source: BRIEF_SOURCE,
      workspaceId: WORKSPACE_ID,
      sessionId: null,
      isRetry: true,
    });
  });
});

describe('LaunchSessionPanel mount', () => {
  const MOUNT = {
    options: [
      { projectId: 'pay' as ProjectId, name: 'payments-api' },
      { projectId: 'ledger' as ProjectId, name: 'ledger-core' },
    ],
    selectedId: 'pay' as ProjectId,
    reason: 'from Sentry project payments-api',
  };

  const renderWithMount = () =>
    render(
      <LaunchSessionPanel
        workspaceId={WORKSPACE_ID}
        linkedSessionId={null}
        goalSeed="Fix the flake"
        externalTask={EXTERNAL_TASK}
        briefSource={null}
        onClose={vi.fn()}
        mount={MOUNT}
      />,
    );

  it('says which project it mounts and why, then mounts it on launch', async () => {
    renderWithMount();

    expect(screen.getByRole('combobox', { name: 'Project to work in' }).textContent).toContain(
      'Works in payments-api',
    );
    expect(screen.getByText('from Sentry project payments-api')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Launch session/ }));

    await waitFor(() =>
      expect(h.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'pay',
          projectReason: 'from Sentry project payments-api',
        }),
      ),
    );
  });

  it('lets the user switch the project or mount none', async () => {
    renderWithMount();

    fireEvent.click(screen.getByRole('combobox', { name: 'Project to work in' }));
    fireEvent.click(await screen.findByRole('option', { name: /ledger-core/ }));
    expect(screen.getByRole('combobox', { name: 'Project to work in' }).textContent).toContain(
      'Works in ledger-core',
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Project to work in' }));
    fireEvent.click(await screen.findByRole('option', { name: /No project/ }));
    expect(screen.queryByText('from Sentry project payments-api')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Launch session/ }));

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
    expect(h.createSession.mock.calls[0]?.[0]).not.toHaveProperty('projectId');
  });

  it('shows no project row when nothing maps to a project', () => {
    renderPanel();
    expect(screen.queryByRole('combobox', { name: 'Project to work in' })).toBeNull();
  });
});
