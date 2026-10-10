import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  IsoDateTime,
  SessionExternalTask,
  SessionId,
  TaskModelPreferences,
} from '@goodboy/types';
import type { AgentSpawnConfigValue } from '../../../../session/agentSpawnConfigValue';

type SpawnAgent = (
  sessionId: SessionId,
  args: Readonly<Record<string, unknown>>,
) => Promise<string>;

type CreatePr = (input: {
  readonly sessionId: SessionId;
  readonly title: string;
  readonly body: string;
  readonly base: string;
  readonly draft: boolean;
}) => Promise<void>;

type Store = {
  readonly createPrForSession: ReturnType<typeof vi.fn<CreatePr>>;
  readonly spawnAgent: ReturnType<typeof vi.fn<SpawnAgent>>;
  readonly navigate: ReturnType<typeof vi.fn>;
  readonly loadAgentTranscript: ReturnType<typeof vi.fn>;
  readonly sessionBranches: Record<string, string>;
  readonly sessionProjectMounts: Record<string, ReadonlyArray<never>>;
  readonly sessionActiveProject: Record<string, string>;
  readonly sessionWorktrees: Record<string, ReadonlyArray<string>>;
  readonly sessions: ReadonlyArray<{
    id: SessionId;
    workspaceId: string;
    providerPreference: Readonly<Record<string, unknown>>;
  }>;
  readonly providers: ReadonlyArray<{ readonly id: string; readonly connection: 'connected' }>;
  sessionExternalTasks: Record<string, ReadonlyArray<SessionExternalTask>>;
  readonly workspaces: ReadonlyArray<{ id: string; rootPath: string; kind: 'repo' }>;
  workspaceOverrides: Record<string, { readonly taskModels: TaskModelPreferences | null }>;
  readonly requestScribe: ReturnType<typeof vi.fn<RequestScribe>>;
  readonly openScribePullRequest: ReturnType<typeof vi.fn<OpenScribePullRequest>>;
  scribeWork: Record<string, unknown>;
};

type RequestScribe = (input: Readonly<Record<string, unknown>>) => Promise<string>;

type OpenScribePullRequest = (input: { readonly key: string }) => Promise<void>;

type ConfigProps = {
  readonly value: AgentSpawnConfigValue;
  readonly onChange: (value: AgentSpawnConfigValue) => void;
  readonly disabled: boolean;
};

type BaseBranches = { defaultBranch: string | null; branches: ReadonlyArray<string> };

type ToastAction = { readonly label: string; readonly onClick: () => void };

type ToastOptions = { readonly title?: string; readonly action?: ToastAction };

const h = vi.hoisted(() => ({
  showToast:
    vi.fn<(params: { readonly kind: string; readonly message: string } & ToastOptions) => void>(),
  config: {
    provider: 'codex',
    model: 'gpt-5.6-luna',
    effort: 'medium',
    hint: 'Keep the public API stable.',
  } satisfies AgentSpawnConfigValue,
  ghBaseBranches: vi.fn(
    async (): Promise<{ defaultBranch: string | null; branches: ReadonlyArray<string> }> => ({
      defaultBranch: 'main',
      branches: ['main'],
    }),
  ),
  store: {
    createPrForSession: vi.fn<CreatePr>(async () => undefined),
    spawnAgent: vi.fn<SpawnAgent>(async () => 'agent-2'),
    navigate: vi.fn(),
    loadAgentTranscript: vi.fn(async () => undefined),
    sessionBranches: { 'session-2': 'ak/card-config' },
    sessionProjectMounts: {},
    sessionActiveProject: {},
    sessionWorktrees: { 'session-2': ['/repo/.goodboy/worktrees/card-config'] },
    sessions: [
      {
        id: 'session-2' as SessionId,
        workspaceId: 'workspace-1',
        providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
      },
    ],
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ],
    sessionExternalTasks: {} as Record<string, ReadonlyArray<SessionExternalTask>>,
    workspaces: [{ id: 'workspace-1', rootPath: '/repo', kind: 'repo' }],
    workspaceOverrides: {},
    requestScribe: vi.fn<RequestScribe>(async () => 'pr:mount-1'),
    openScribePullRequest: vi.fn<OpenScribePullRequest>(async () => undefined),
    scribeWork: {} as Record<string, unknown>,
  } satisfies Store,
}));

vi.mock('../../../../../store', async () => ({
  ...(await import('../../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (state: Store) => T) => selector(h.store),
}));

vi.mock('../../github', () => ({
  ghBaseBranches: h.ghBaseBranches,
}));

vi.mock('../../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock('../../../../../store/slices/worktrees/useSessionRepo', () => ({
  useSessionRepo: () => ({
    repoRoot: '/repo',
    worktreePath: '/repo/.goodboy/worktrees/card-config',
    branch: 'ak/card-config',
    mountName: null,
    mountId: 'mount-1',
    workspaceId: 'workspace-1',
  }),
}));

vi.mock('../../../../session/components/AgentSpawnConfig', () => ({
  AgentSpawnConfig: ({ value, onChange, disabled }: ConfigProps) => (
    <div>
      <button type="button" disabled={disabled} onClick={() => onChange(h.config)}>
        Choose agent config
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({ ...value, hint: ' \n\t ' })}
      >
        Set whitespace hint
      </button>
    </div>
  ),
}));

import { CreatePrPanel } from './CreatePrPanel';
import { closingIssueReferences } from '../../closingIssueReferences';
import { appendClosingReferences } from '../../appendClosingReferences';

const SESSION_ID = 'session-2' as SessionId;

const linkedIssue = (overrides: Partial<SessionExternalTask>): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider: 'github',
  externalId: '41',
  identifier: '#41',
  url: 'https://github.com/acme/web/issues/41',
  title: 'Broken card',
  branch: 'ak/card-config',
  createdAt: '2026-08-04T00:00:00.000Z' as IsoDateTime,
  ...overrides,
});

const renderPanel = () =>
  render(
    <CreatePrPanel sessionId={SESSION_ID} defaultTitle="Refactor PR cards" onCreated={vi.fn()} />,
  );

const switchToAgentMode = () => {
  fireEvent.click(screen.getByRole('tab', { name: 'Draft with an agent' }));
};

beforeEach(() => {
  h.store.createPrForSession.mockClear();
  h.store.createPrForSession.mockImplementation(async () => undefined);
  h.store.spawnAgent.mockClear();
  h.store.navigate.mockClear();
  h.store.requestScribe.mockClear();
  h.store.openScribePullRequest.mockClear();
  h.store.scribeWork = {};
  h.showToast.mockClear();
  h.store.workspaceOverrides = {};
  h.store.sessionExternalTasks = {};
  h.ghBaseBranches.mockClear();
  h.ghBaseBranches.mockImplementation(async () => ({ defaultBranch: 'main', branches: ['main'] }));
});

afterEach(cleanup);

describe('CreatePrPanel', () => {
  it('creates a PR manually with the filled fields and the default base', async () => {
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Pull request title' }), {
      target: { value: 'Ship the card refactor' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Pull request description' }), {
      target: { value: 'Documents the change.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create pull request' }));

    await waitFor(() =>
      expect(h.store.createPrForSession).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        title: 'Ship the card refactor',
        body: 'Documents the change.',
        base: 'main',
        draft: true,
        isScribeBody: false,
      }),
    );
  });

  it('focuses the untouched default title with the caret at its start, so a long title reads from its first word', async () => {
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });
    const title = screen.getByRole('textbox', { name: 'Pull request title' }) as HTMLInputElement;

    expect(document.activeElement).toBe(title);
    expect(title.selectionStart).toBe(0);
    expect(title.selectionEnd).toBe(0);
  });

  it('respects the draft toggle on manual create', async () => {
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });
    fireEvent.click(screen.getByRole('switch', { name: 'Open as draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create pull request' }));

    await waitFor(() =>
      expect(h.store.createPrForSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: SESSION_ID, draft: false }),
      ),
    );
  });

  it('ends the form with cancel and create inline, never in a footer bar', async () => {
    const onCancel = vi.fn();
    render(
      <CreatePrPanel
        sessionId={SESSION_ID}
        defaultTitle="Refactor PR cards"
        onCreated={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await screen.findByRole('combobox', { name: 'Branch' });
    const create = screen.getByRole('button', { name: 'Create pull request' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(create.closest('[data-slot="form-page"]')).not.toBeNull();
    expect(create.closest('footer')).toBeNull();
    expect(cancel.parentElement).toBe(create.parentElement);
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows the create error next to the actions', async () => {
    h.store.createPrForSession.mockRejectedValueOnce(new Error('gh exploded'));
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });
    fireEvent.click(screen.getByRole('button', { name: 'Create pull request' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('gh exploded');
  });

  it('swaps the body when switching modes', async () => {
    renderPanel();
    expect(screen.getByRole('textbox', { name: 'Pull request title' })).toBeDefined();
    switchToAgentMode();
    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose agent config' })).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Manual' }));
    expect(screen.getByRole('textbox', { name: 'Pull request title' })).toBeDefined();
  });

  it('shows a skeleton instead of the base branch picker while branches load', async () => {
    let resolve: (value: BaseBranches) => void = () => undefined;
    h.ghBaseBranches.mockImplementationOnce(
      () =>
        new Promise<BaseBranches>((r) => {
          resolve = r;
        }),
    );
    renderPanel();
    expect(screen.queryByRole('combobox', { name: 'Branch' })).toBeNull();
    resolve({ defaultBranch: 'main', branches: ['main'] });
    expect(await screen.findByRole('combobox', { name: 'Branch' })).toBeDefined();
  });

  it('asks Scribe for the text with the chosen config and notes, and never spawns a generalist', async () => {
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });
    switchToAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'Choose agent config' }));
    fireEvent.click(screen.getByRole('button', { name: 'Write and open' }));

    await waitFor(() => expect(h.store.requestScribe).toHaveBeenCalledOnce());
    expect(h.store.requestScribe.mock.calls[0]![0]).toMatchObject({
      sessionId: SESSION_ID,
      mountId: 'mount-1',
      task: { kind: 'pr', closedPrNumber: null, isDraft: true, base: 'main' },
      hint: 'Keep the public API stable.',
      routing: { provider: 'codex', model: 'gpt-5.6-luna', effort: 'medium' },
    });
    expect(h.store.spawnAgent).not.toHaveBeenCalled();
  });

  const failedScribe = (error: string) => ({
    'pr:mount-1': {
      status: 'failed',
      output: {
        prTitle: 'Make ledger postings idempotent',
        prBody: 'Retried batches no longer post twice.',
        commitMessages: [],
        changelogEntry: '- Retried batches no longer double post',
      },
      error,
    },
  });

  it('keeps the text Scribe wrote in the form when opening failed, and signs the body it did not change', async () => {
    h.store.scribeWork = failedScribe('remote: Permission denied');
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });

    expect(
      (screen.getByRole('textbox', { name: 'Pull request title' }) as HTMLInputElement).value,
    ).toBe('Make ledger postings idempotent');
    expect(screen.getByText('- Retried batches no longer double post')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Create pull request' }));

    await waitFor(() =>
      expect(h.store.createPrForSession).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Retried batches no longer post twice.',
          isScribeBody: true,
        }),
      ),
    );
  });

  it('shows why opening failed where the person clicked, with a Retry that reuses the text', async () => {
    h.store.scribeWork = failedScribe("Couldn't push ak/card-config: remote: Permission denied");
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });

    expect(screen.getByRole('alert').textContent).toContain(
      "Couldn't push ak/card-config: remote: Permission denied",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(h.store.openScribePullRequest).toHaveBeenCalledExactlyOnceWith({ key: 'pr:mount-1' });
    expect(h.store.requestScribe).not.toHaveBeenCalled();
  });

  it('offers no Retry when Scribe wrote nothing to retry with', async () => {
    h.store.scribeWork = {
      'pr:mount-1': { status: 'failed', output: null, error: 'Scribe wrote no text.' },
    };
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });

    expect(screen.getByRole('alert').textContent).toContain('Scribe wrote no text.');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('says it is pushing and opening while the engine works, and blocks a second click', async () => {
    h.store.scribeWork = {
      'pr:mount-1': { status: 'creating', output: null, error: null },
    };
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });

    expect(screen.getByText('Pushing the branch and opening the pull request.')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Create pull request' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('hands over to the branch page once the pull request it asked for exists', async () => {
    const onCreated = vi.fn();
    const view = render(
      <CreatePrPanel
        sessionId={SESSION_ID}
        defaultTitle="Refactor PR cards"
        onCreated={onCreated}
      />,
    );
    switchToAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'Write and open' }));
    await waitFor(() => expect(h.store.requestScribe).toHaveBeenCalledOnce());
    expect(onCreated).not.toHaveBeenCalled();

    h.store.scribeWork = {
      'pr:mount-1': { status: 'created', output: null, error: null },
    };
    view.rerender(
      <CreatePrPanel
        sessionId={SESSION_ID}
        defaultTitle="Refactor PR cards"
        onCreated={onCreated}
      />,
    );

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  });

  it('does not close on a pull request opened by an earlier request', async () => {
    const onCreated = vi.fn();
    h.store.scribeWork = {
      'pr:mount-1': { status: 'created', output: null, error: null },
    };
    render(
      <CreatePrPanel
        sessionId={SESSION_ID}
        defaultTitle="Refactor PR cards"
        onCreated={onCreated}
      />,
    );
    await screen.findByRole('combobox', { name: 'Branch' });

    expect(onCreated).not.toHaveBeenCalled();
  });

  it('locks the creation mode and both create actions while Scribe writes', async () => {
    h.store.scribeWork = { 'pr:mount-1': { status: 'writing', output: null, error: null } };
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });

    expect(screen.getByRole('tab', { name: 'Manual' }).hasAttribute('disabled')).toBe(true);
    const agentTab = screen.getByRole('tab', { name: 'Draft with an agent' });
    expect(agentTab.hasAttribute('disabled')).toBe(true);
    expect(agentTab.getAttribute('title')).toBe('Scribe is still writing the text.');
    expect(
      screen.getByRole('button', { name: 'Create pull request' }).hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(agentTab);

    expect(screen.queryByRole('button', { name: 'Write and open' })).toBeNull();
    expect(h.store.requestScribe).not.toHaveBeenCalled();
  });

  it('leaves the mode control free when no Scribe job runs', async () => {
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });

    expect(screen.getByRole('tab', { name: 'Manual' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('tab', { name: 'Draft with an agent' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('keeps the text the person typed when Scribe fails afterwards', async () => {
    const view = renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Pull request title' }), {
      target: { value: 'My own title' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Pull request description' }), {
      target: { value: 'My own description.' },
    });

    h.store.scribeWork = failedScribe('remote: Permission denied');
    view.rerender(
      <CreatePrPanel sessionId={SESSION_ID} defaultTitle="Refactor PR cards" onCreated={vi.fn()} />,
    );

    expect(
      (screen.getByRole('textbox', { name: 'Pull request title' }) as HTMLInputElement).value,
    ).toBe('My own title');
    expect(
      (screen.getByRole('textbox', { name: 'Pull request description' }) as HTMLTextAreaElement)
        .value,
    ).toBe('My own description.');
    fireEvent.click(screen.getByRole('button', { name: 'Create pull request' }));

    await waitFor(() =>
      expect(h.store.createPrForSession).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'My own description.', isScribeBody: false }),
      ),
    );
  });

  it('says Scribe is writing while its turn runs', async () => {
    h.store.scribeWork = { 'pr:mount-1': { status: 'writing', output: null, error: null } };
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });

    expect(screen.getByText('Scribe is writing the title and description.')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Create pull request' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('previews the closing reference for an issue linked on the session branch, and only that one', async () => {
    h.store.sessionExternalTasks = {
      'session-2': [
        linkedIssue({}),
        linkedIssue({ externalId: '52', identifier: '#52', branch: 'ak/other' }),
        linkedIssue({ provider: 'linear', externalId: 'GRO-9', identifier: 'GRO-9' }),
      ],
    };
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });

    expect(screen.getAllByTestId('pr-issue-reference').map((node) => node.textContent)).toEqual([
      'Closes #41',
    ]);
  });

  it('previews exactly the block the store appends to the body it is given', async () => {
    h.store.sessionExternalTasks = { 'session-2': [linkedIssue({})] };
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Pull request description' }), {
      target: { value: 'Documents the change.' },
    });
    const previewed = screen
      .getAllByTestId('pr-issue-reference')
      .map((node) => node.textContent)
      .join('\n');
    fireEvent.click(screen.getByRole('button', { name: 'Create pull request' }));

    await waitFor(() => expect(h.store.createPrForSession).toHaveBeenCalledOnce());
    const sent = h.store.createPrForSession.mock.calls[0]![0];
    const stored = appendClosingReferences({
      body: sent.body,
      references: closingIssueReferences({
        tasks: h.store.sessionExternalTasks['session-2']!,
        branch: 'ak/card-config',
        body: sent.body,
      }),
    });
    expect(stored).toBe(`${sent.body}\n\n${previewed}`);
  });

  it('hides the preview when nothing will be referenced', async () => {
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });
    expect(screen.queryByTestId('pr-issue-reference')).toBeNull();
  });

  it('hands Scribe the closing references it must not repeat', async () => {
    h.store.sessionExternalTasks = { 'session-2': [linkedIssue({})] };
    renderPanel();
    switchToAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'Write and open' }));

    await waitFor(() => expect(h.store.requestScribe).toHaveBeenCalledOnce());
    expect(h.store.requestScribe.mock.calls[0]![0]).toMatchObject({
      task: { references: ['Closes #41'] },
    });
  });
});
