import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId, TaskModelPreferences } from '@goodboy/types';
import type { AgentSpawnConfigValue } from '../../../session/components/AgentSpawnConfig/AgentSpawnConfigValue';

type SpawnAgent = (
  sessionId: SessionId,
  args: Readonly<Record<string, unknown>>,
) => Promise<string>;

type Store = {
  readonly createPrForSession: ReturnType<typeof vi.fn>;
  readonly spawnAgent: ReturnType<typeof vi.fn<SpawnAgent>>;
  readonly selectAgent: ReturnType<typeof vi.fn>;
  readonly setCurrentSession: ReturnType<typeof vi.fn>;
  readonly sessionBranches: Record<string, string>;
  readonly sessions: ReadonlyArray<{ id: SessionId; workspaceId: string }>;
  readonly workspaces: ReadonlyArray<{ id: string; rootPath: string }>;
  workspaceOverrides: Record<string, { readonly taskModels: TaskModelPreferences | null }>;
};

type ConfigProps = {
  readonly value: AgentSpawnConfigValue;
  readonly onChange: (value: AgentSpawnConfigValue) => void;
  readonly disabled: boolean;
};

type BaseBranches = { defaultBranch: string | null; branches: ReadonlyArray<string> };

const h = vi.hoisted(() => ({
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
    createPrForSession: vi.fn(async () => undefined),
    spawnAgent: vi.fn<SpawnAgent>(async () => 'agent-2'),
    selectAgent: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
    sessionBranches: { 'session-2': 'ak/card-config' },
    sessions: [{ id: 'session-2' as SessionId, workspaceId: 'workspace-1' }],
    workspaces: [{ id: 'workspace-1', rootPath: '/repo' }],
    workspaceOverrides: {},
  } satisfies Store,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) => selector(h.store),
}));

vi.mock('../../github', () => ({
  ghBaseBranches: h.ghBaseBranches,
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

const SESSION_ID = 'session-2' as SessionId;

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
  h.store.workspaceOverrides = {};
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
});
