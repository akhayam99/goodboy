import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  IsoDateTime,
  SessionExternalTask,
  SessionId,
  TaskModelPreferences,
} from '@goodboy/types';
import type { AgentSpawnConfigValue } from '../../../session/components/AgentSpawnConfig/AgentSpawnConfigValue';

type SpawnAgent = (
  sessionId: SessionId,
  args: Readonly<Record<string, unknown>>,
) => Promise<string>;

type CreatePr = (
  sessionId: SessionId,
  opts: {
    readonly title: string;
    readonly body: string;
    readonly base: string;
    readonly draft: boolean;
  },
) => Promise<void>;

type Store = {
  readonly createPrForSession: ReturnType<typeof vi.fn<CreatePr>>;
  readonly spawnAgent: ReturnType<typeof vi.fn<SpawnAgent>>;
  readonly selectAgent: ReturnType<typeof vi.fn>;
  readonly setCurrentSession: ReturnType<typeof vi.fn>;
  readonly sessionBranches: Record<string, string>;
  readonly sessionMounts: Record<string, ReadonlyArray<never>>;
  readonly sessionActiveMount: Record<string, string>;
  readonly sessionWorktrees: Record<string, ReadonlyArray<string>>;
  readonly sessions: ReadonlyArray<{ id: SessionId; workspaceId: string }>;
  sessionExternalTasks: Record<string, ReadonlyArray<SessionExternalTask>>;
  readonly workspaces: ReadonlyArray<{ id: string; rootPath: string; kind: 'repo' }>;
  workspaceOverrides: Record<string, { readonly taskModels: TaskModelPreferences | null }>;
};

type ConfigProps = {
  readonly value: AgentSpawnConfigValue;
  readonly onChange: (value: AgentSpawnConfigValue) => void;
  readonly disabled: boolean;
};

type BaseBranches = { defaultBranch: string | null; branches: ReadonlyArray<string> };

type ToastAction = { readonly label: string; readonly onClick: () => void };

type ToastOptions = { readonly title?: string; readonly action?: ToastAction };

const h = vi.hoisted(() => ({
  showToast: vi.fn<(kind: string, message: string, opts?: ToastOptions) => void>(),
  config: {
    provider: 'codex',
    model: 'gpt-5.4-mini',
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
    selectAgent: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
    sessionBranches: { 'session-2': 'ak/card-config' },
    sessionMounts: {},
    sessionActiveMount: {},
    sessionWorktrees: { 'session-2': ['/repo/.goodboy/worktrees/card-config'] },
    sessions: [{ id: 'session-2' as SessionId, workspaceId: 'workspace-1' }],
    sessionExternalTasks: {} as Record<string, ReadonlyArray<SessionExternalTask>>,
    workspaces: [{ id: 'workspace-1', rootPath: '/repo', kind: 'repo' }],
    workspaceOverrides: {},
  } satisfies Store,
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (state: Store) => T) => selector(h.store),
}));

vi.mock('../../github', () => ({
  ghBaseBranches: h.ghBaseBranches,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock('../../../../store/slices/worktrees/useSessionRepo', () => ({
  useSessionRepo: () => ({
    repoRoot: '/repo',
    worktreePath: '/repo/.goodboy/worktrees/card-config',
    branch: 'ak/card-config',
    mountName: null,
    workspaceId: 'workspace-1',
  }),
}));

vi.mock('../../../session/components/AgentSpawnConfig', () => ({
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
    <CreatePrPanel
      sessionId={SESSION_ID}
      defaultTitle="Refactor PR cards"
      onCreated={vi.fn()}
      onStudioClose={vi.fn()}
    />,
  );

const switchToAgentMode = () => {
  fireEvent.click(screen.getByRole('tab', { name: 'With an agent' }));
};

beforeEach(() => {
  h.store.createPrForSession.mockClear();
  h.store.createPrForSession.mockImplementation(async () => undefined);
  h.store.spawnAgent.mockClear();
  h.store.selectAgent.mockClear();
  h.store.setCurrentSession.mockClear();
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
    fireEvent.click(screen.getByRole('button', { name: 'Create PR' }));

    await waitFor(() =>
      expect(h.store.createPrForSession).toHaveBeenCalledWith(SESSION_ID, {
        title: 'Ship the card refactor',
        body: 'Documents the change.',
        base: 'main',
        draft: true,
      }),
    );
  });

  it('respects the draft toggle on manual create', async () => {
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Open as draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create PR' }));

    await waitFor(() =>
      expect(h.store.createPrForSession).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({ draft: false }),
      ),
    );
  });

  it('shows the create error in the footer', async () => {
    h.store.createPrForSession.mockRejectedValueOnce(new Error('gh exploded'));
    renderPanel();
    await screen.findByRole('combobox', { name: 'Branch' });
    fireEvent.click(screen.getByRole('button', { name: 'Create PR' }));

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

  it('spawns a PR agent with the chosen config and operator notes', async () => {
    const onStudioClose = vi.fn();
    render(
      <CreatePrPanel
        sessionId={SESSION_ID}
        defaultTitle="Refactor PR cards"
        onCreated={vi.fn()}
        onStudioClose={onStudioClose}
      />,
    );
    switchToAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'Choose agent config' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draft with agent' }));

    await waitFor(() => expect(h.store.spawnAgent).toHaveBeenCalledOnce());
    const args = h.store.spawnAgent.mock.calls[0]![1];
    expect(args).toMatchObject({
      provider: 'codex',
      model: 'gpt-5.4-mini',
      effort: 'medium',
    });
    expect(args.initialPrompt).toContain(
      '\n\nOperator notes:\n---\nKeep the public API stable.\n---',
    );
    expect(args).toMatchObject({ focus: 'none' });
    expect(onStudioClose).not.toHaveBeenCalled();
  });

  it('keeps the panel in place after the spawn and opens the agent only from the toast action', async () => {
    const onStudioClose = vi.fn();
    render(
      <CreatePrPanel
        sessionId={SESSION_ID}
        defaultTitle="Refactor PR cards"
        onCreated={vi.fn()}
        onStudioClose={onStudioClose}
      />,
    );
    switchToAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'Draft with agent' }));

    await waitFor(() => expect(h.showToast).toHaveBeenCalledOnce());
    expect(h.store.selectAgent).not.toHaveBeenCalled();
    const action = h.showToast.mock.calls[0]![2]?.action;
    expect(action?.label).toBe('Open the agent');

    action?.onClick();

    await waitFor(() => expect(h.store.selectAgent).toHaveBeenCalledWith(SESSION_ID, 'agent-2'));
    await waitFor(() => expect(onStudioClose).toHaveBeenCalledOnce());
  });

  it('preserves the prompt for a whitespace-only hint', async () => {
    renderPanel();
    switchToAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'Set whitespace hint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draft with agent' }));

    await waitFor(() => expect(h.store.spawnAgent).toHaveBeenCalledOnce());
    const args = h.store.spawnAgent.mock.calls[0]![1];
    expect(args).toMatchObject({
      provider: 'anthropic',
      model: 'haiku-4.5',
      effort: 'low',
    });
    expect(args.initialPrompt).toBe(
      [
        `Open a GitHub pull request for this session's branch.`,
        `- Write a clear, conventional title and a concise description from the committed changes.`,
        `- Session goal: "Refactor PR cards".`,
        `- If this project defines a PR-creation skill, command, or template (look under .claude/), follow it.`,
        `- Open it as a draft PR.`,
        `Then run \`gh pr create\` to open it and report the PR URL.`,
      ].join('\n'),
    );
  });

  it('uses a workspace task model loaded after mount', async () => {
    const { rerender } = render(
      <CreatePrPanel
        sessionId={SESSION_ID}
        defaultTitle="Refactor PR cards"
        onCreated={vi.fn()}
        onStudioClose={vi.fn()}
      />,
    );
    h.store.workspaceOverrides = {
      'workspace-1': {
        taskModels: { pr_draft: { providerId: 'codex', model: 'gpt-5.4-mini' } },
      },
    };
    rerender(
      <CreatePrPanel
        sessionId={SESSION_ID}
        defaultTitle="Refactor PR cards"
        onCreated={vi.fn()}
        onStudioClose={vi.fn()}
      />,
    );
    switchToAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'Draft with agent' }));

    await waitFor(() => expect(h.store.spawnAgent).toHaveBeenCalledOnce());
    expect(h.store.spawnAgent.mock.calls[0]![1]).toMatchObject({
      provider: 'codex',
      model: 'gpt-5.4-mini',
    });
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
    fireEvent.click(screen.getByRole('button', { name: 'Create PR' }));

    await waitFor(() => expect(h.store.createPrForSession).toHaveBeenCalledOnce());
    const sent = h.store.createPrForSession.mock.calls[0]![1];
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

  it('tells the drafting agent to write the closing references it previewed', async () => {
    h.store.sessionExternalTasks = { 'session-2': [linkedIssue({})] };
    renderPanel();
    switchToAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'Draft with agent' }));

    await waitFor(() => expect(h.store.spawnAgent).toHaveBeenCalledOnce());
    expect(h.store.spawnAgent.mock.calls[0]![1].initialPrompt).toContain('Closes #41');
  });
});
