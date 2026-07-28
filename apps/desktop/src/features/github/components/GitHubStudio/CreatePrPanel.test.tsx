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

const h = vi.hoisted(() => ({
  config: {
    provider: 'codex',
    model: 'gpt-5.4-mini',
    effort: 'medium',
    hint: 'Keep the public API stable.',
  } satisfies AgentSpawnConfigValue,
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
  ghBaseBranches: vi.fn(async () => ({ defaultBranch: 'main', branches: ['main'] })),
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

beforeEach(() => {
  h.store.spawnAgent.mockClear();
  h.store.selectAgent.mockClear();
  h.store.setCurrentSession.mockClear();
  h.store.workspaceOverrides = {};
});

afterEach(cleanup);

describe('CreatePrPanel', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Choose agent config' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draft with an agent' }));

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
    render(
      <CreatePrPanel
        sessionId={SESSION_ID}
        defaultTitle="Refactor PR cards"
        onCreated={vi.fn()}
        onStudioClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set whitespace hint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draft with an agent' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Draft with an agent' }));

    await waitFor(() => expect(h.store.spawnAgent).toHaveBeenCalledOnce());
    expect(h.store.spawnAgent.mock.calls[0]![1]).toMatchObject({
      provider: 'codex',
      model: 'gpt-5.4-mini',
    });
  });
});
