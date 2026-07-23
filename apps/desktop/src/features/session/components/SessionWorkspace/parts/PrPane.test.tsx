import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  IsoDateTime,
  PullRequestState,
  Session,
  SessionId,
  TaskModelPreferences,
  WorkspaceId,
} from '@goodboy/types';
import type { AgentSpawnConfigValue } from '../../AgentSpawnConfig/AgentSpawnConfigValue';

type SpawnAgent = (
  sessionId: SessionId,
  args: Readonly<Record<string, unknown>>,
) => Promise<string>;

type Store = {
  sessionGithub: Record<string, unknown>;
  sessionGitlabMr: Record<string, unknown>;
  readonly refreshSessionPr: ReturnType<typeof vi.fn>;
  readonly createPrForSession: ReturnType<typeof vi.fn>;
  readonly spawnAgent: ReturnType<typeof vi.fn<SpawnAgent>>;
  readonly selectAgent: ReturnType<typeof vi.fn>;
  readonly setActiveLens: ReturnType<typeof vi.fn>;
  readonly sessionBranches: Record<string, string>;
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
    model: 'gpt-5.4',
    effort: 'high',
    hint: 'Call out the migration risk.',
  } satisfies AgentSpawnConfigValue,
  store: {
    sessionGithub: {},
    sessionGitlabMr: {},
    refreshSessionPr: vi.fn(),
    createPrForSession: vi.fn(async () => undefined),
    spawnAgent: vi.fn<SpawnAgent>(async () => 'agent-1'),
    selectAgent: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    sessionBranches: { 'session-1': 'ak/refactor-auth' },
    workspaceOverrides: {},
  } satisfies Store,
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) => selector(h.store),
}));

vi.mock('../../../../worktree/useRemoteHostKind', () => ({
  useRemoteHostKind: () => 'github',
}));

vi.mock('../../AgentSpawnConfig', () => ({
  AgentSpawnConfig: ({ onChange, disabled }: ConfigProps) => (
    <button type="button" disabled={disabled} onClick={() => onChange(h.config)}>
      Choose agent config
    </button>
  ),
}));

import { PrPane } from './PrPane';

const DATE = '2026-07-22T10:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-1' as SessionId;
const PULL_REQUEST = {
  number: 42,
  title: 'Refactor authentication',
  url: 'https://github.com/acme/goodboy/pull/42',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/refactor-auth',
  isDraft: false,
  reviewDecision: 'review_required',
  body: 'Refactors authentication.',
  updatedAt: DATE,
} satisfies PullRequestState;
const session: Session = {
  id: SESSION_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  goal: 'Refactor authentication',
  state: { kind: 'idle', lastActivityAt: DATE },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: DATE,
  updatedAt: DATE,
};

beforeEach(() => {
  h.store.sessionGithub = {};
  h.store.sessionGitlabMr = {};
  h.store.createPrForSession.mockClear();
  h.store.spawnAgent.mockClear();
  h.store.selectAgent.mockClear();
  h.store.setActiveLens.mockClear();
  h.store.workspaceOverrides = {};
});

afterEach(cleanup);

describe('PrPane', () => {
  it('renders the stored pull request as a selected list row above its detail', () => {
    h.store.sessionGithub = {
      [SESSION_ID]: {
        pr: PULL_REQUEST,
        detail: { checks: [], comments: [] },
        loading: false,
        error: null,
      },
    };

    render(<PrPane session={session} />);

    const listRow = screen.getByRole('button', {
      name: /GitHub #42 Refactor authentication In review/i,
    });
    expect(listRow.getAttribute('aria-current')).toBe('true');
    expect(screen.getAllByText('Refactor authentication')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Open PR' })).toBeDefined();
  });

  it('spawns a draft agent with the chosen config and operator notes', async () => {
    render(<PrPane session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose agent config' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draft with an agent' }));

    await waitFor(() => expect(h.store.spawnAgent).toHaveBeenCalledOnce());
    const args = h.store.spawnAgent.mock.calls[0]![1];
    expect(args).toMatchObject({ provider: 'codex', model: 'gpt-5.4', effort: 'high' });
    expect(args.initialPrompt).toContain(
      '\n\nOperator notes:\n---\nCall out the migration risk.\n---',
    );
    expect(h.store.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'agents');
  });

  it('keeps quick draft on createPrForSession without spawning an agent', async () => {
    render(<PrPane session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quick draft' }));

    await waitFor(() =>
      expect(h.store.createPrForSession).toHaveBeenCalledWith(SESSION_ID, { draft: true }),
    );
    expect(h.store.spawnAgent).not.toHaveBeenCalled();
  });

  it('uses a workspace task model loaded after mount', async () => {
    const { rerender } = render(<PrPane session={session} />);
    h.store.workspaceOverrides = {
      'workspace-1': {
        taskModels: { pr_draft: { providerId: 'codex', model: 'gpt-5.4-mini' } },
      },
    };
    rerender(<PrPane session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Draft with an agent' }));

    await waitFor(() => expect(h.store.spawnAgent).toHaveBeenCalledOnce());
    expect(h.store.spawnAgent.mock.calls[0]![1]).toMatchObject({
      provider: 'codex',
      model: 'gpt-5.4-mini',
    });
  });
});
