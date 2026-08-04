import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId, TaskModelPreferences, WorkspaceId } from '@goodboy/types';
import type { AgentSpawnConfigValue } from '../../../session/components/AgentSpawnConfig/AgentSpawnConfigValue';
import type { GitlabMergeRequest } from '../client';

type SpawnAgent = (
  sessionId: SessionId,
  args: Readonly<Record<string, unknown>>,
) => Promise<string>;

type Store = {
  readonly sessions: ReadonlyArray<{
    id: SessionId;
    goal: string;
    workspaceId: string;
    providerPreference: { defaultProvider: 'anthropic'; allowTurnOverride: false };
  }>;
  sessionGitlabMr: Record<string, unknown>;
  readonly sessionBranches: Record<string, string>;
  readonly refreshSessionMr: ReturnType<typeof vi.fn>;
  readonly createMrForSession: ReturnType<typeof vi.fn>;
  readonly mergeMrForSession: ReturnType<typeof vi.fn>;
  readonly spawnAgent: ReturnType<typeof vi.fn<SpawnAgent>>;
  readonly selectAgent: ReturnType<typeof vi.fn>;
  readonly setCurrentSession: ReturnType<typeof vi.fn>;
  workspaceOverrides: Record<string, { readonly taskModels: TaskModelPreferences | null }>;
};

type ConfigProps = {
  readonly onChange: (value: AgentSpawnConfigValue) => void;
  readonly disabled: boolean;
};

type ToastAction = { readonly label: string; readonly onClick: () => void };

type ToastOptions = { readonly title?: string; readonly action?: ToastAction };

type MrParams = {
  readonly mergeStatus?: GitlabMergeRequest['mergeStatus'];
  readonly webUrl?: string;
};

const h = vi.hoisted(() => ({
  config: {
    provider: 'gemini',
    model: 'gemini-3.5-flash',
    effort: 'low',
    hint: 'Mention the rollout order.',
  } satisfies AgentSpawnConfigValue,
  gitlabMergeMr: vi.fn(async () => undefined),
  showToast: vi.fn<(kind: string, message: string, opts?: ToastOptions) => void>(),
  store: {
    sessions: [
      {
        id: 'session-3' as SessionId,
        goal: 'Prepare the GitLab release',
        workspaceId: 'workspace-1',
        providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
      },
    ],
    sessionGitlabMr: {},
    sessionBranches: { 'session-3': 'ak/gitlab-release' },
    refreshSessionMr: vi.fn(async () => undefined),
    createMrForSession: vi.fn(async () => undefined),
    mergeMrForSession: vi.fn(async () => undefined),
    spawnAgent: vi.fn<SpawnAgent>(async () => 'agent-3'),
    selectAgent: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
    workspaceOverrides: {},
  } satisfies Store,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) => selector(h.store),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock('../client', async () => {
  const actual = await vi.importActual<typeof import('../client')>('../client');
  return { ...actual, gitlabMergeMr: h.gitlabMergeMr };
});

vi.mock('../../../session/components/AgentSpawnConfig', () => ({
  AgentSpawnConfig: ({ onChange, disabled }: ConfigProps) => (
    <button type="button" disabled={disabled} onClick={() => onChange(h.config)}>
      Choose agent config
    </button>
  ),
}));

import { MrDetailPanel } from './MrDetailPanel';

const SESSION_ID = 'session-3' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const makeMr = ({
  mergeStatus = 'can_be_merged',
  webUrl = 'https://gitlab.com/acme/web/-/merge_requests/4',
}: MrParams = {}): GitlabMergeRequest => ({
  id: 12,
  iid: 4,
  projectId: 3,
  title: 'Add merge request dashboard',
  description: null,
  state: 'opened',
  webUrl,
  sourceBranch: 'ak/mr-dashboard',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus,
  updatedAt: '2026-07-22T10:00:00Z',
});

beforeEach(() => {
  h.gitlabMergeMr.mockClear();
  h.store.refreshSessionMr.mockClear();
  h.store.createMrForSession.mockClear();
  h.store.spawnAgent.mockClear();
  h.store.selectAgent.mockClear();
  h.store.setCurrentSession.mockClear();
  h.showToast.mockClear();
  h.store.workspaceOverrides = {};
  h.store.sessionGitlabMr = {};
});

const switchToAgentMode = () => {
  fireEvent.click(screen.getByRole('tab', { name: 'With an agent' }));
};

afterEach(cleanup);

describe('MrDetailPanel', () => {
  it('creates an MR from the form footer', async () => {
    render(<MrDetailPanel sessionId={SESSION_ID} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Merge request title' }), {
      target: { value: 'Ship the GitLab release' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Merge request description' }), {
      target: { value: 'Documents the release changes.' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Target branch' }), {
      target: { value: 'develop' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create MR' }));

    await waitFor(() =>
      expect(h.store.createMrForSession).toHaveBeenCalledWith(SESSION_ID, {
        title: 'Ship the GitLab release',
        description: 'Documents the release changes.',
        targetBranch: 'develop',
        draft: true,
      }),
    );
  });

  it('respects the draft toggle on manual create', async () => {
    render(<MrDetailPanel sessionId={SESSION_ID} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Merge request title' }), {
      target: { value: 'Ship the GitLab release' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Open as draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create MR' }));

    await waitFor(() =>
      expect(h.store.createMrForSession).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({ draft: false }),
      ),
    );
  });

  it('shows the merge request error in the form footer', () => {
    h.store.sessionGitlabMr = {
      'session-3': { mr: null, loading: false, error: 'GitLab token expired' },
    };
    render(<MrDetailPanel sessionId={SESSION_ID} onClose={vi.fn()} />);

    expect(screen.getByRole('alert').textContent).toContain('GitLab token expired');
  });

  it('swaps the form body when switching modes', () => {
    render(<MrDetailPanel sessionId={SESSION_ID} onClose={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Merge request title' })).toBeDefined();
    switchToAgentMode();
    expect(screen.queryByRole('textbox', { name: 'Merge request title' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose agent config' })).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Manual' }));
    expect(screen.getByRole('textbox', { name: 'Merge request title' })).toBeDefined();
  });

  it('spawns an MR agent with the chosen config and operator notes', async () => {
    const onClose = vi.fn();
    render(<MrDetailPanel sessionId={SESSION_ID} onClose={onClose} />);
    switchToAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'Choose agent config' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draft with agent' }));

    await waitFor(() => expect(h.store.spawnAgent).toHaveBeenCalledOnce());
    const args = h.store.spawnAgent.mock.calls[0]![1];
    expect(args).toMatchObject({
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      effort: 'low',
    });
    expect(args.initialPrompt).toContain(
      '\n\nOperator notes:\n---\nMention the rollout order.\n---',
    );
    expect(args).toMatchObject({ focus: 'none' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the panel in place after the spawn and opens the agent only from the toast action', async () => {
    const onClose = vi.fn();
    render(<MrDetailPanel sessionId={SESSION_ID} onClose={onClose} />);
    switchToAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'Draft with agent' }));

    await waitFor(() => expect(h.showToast).toHaveBeenCalledOnce());
    expect(h.store.selectAgent).not.toHaveBeenCalled();
    const action = h.showToast.mock.calls[0]![2]?.action;
    expect(action?.label).toBe('Open the agent');

    action?.onClick();

    await waitFor(() => expect(h.store.selectAgent).toHaveBeenCalledWith(SESSION_ID, 'agent-3'));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('uses a workspace task model loaded after mount', async () => {
    const { rerender } = render(<MrDetailPanel sessionId={SESSION_ID} onClose={vi.fn()} />);
    h.store.workspaceOverrides = {
      'workspace-1': {
        taskModels: { pr_draft: { providerId: 'codex', model: 'gpt-5.4-mini' } },
      },
    };
    rerender(<MrDetailPanel sessionId={SESSION_ID} onClose={vi.fn()} />);
    switchToAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'Draft with agent' }));

    await waitFor(() => expect(h.store.spawnAgent).toHaveBeenCalledOnce());
    expect(h.store.spawnAgent.mock.calls[0]![1]).toMatchObject({
      provider: 'codex',
      model: 'gpt-5.4-mini',
    });
  });

  it('merges a selected MR through the GitLab client', async () => {
    const onClose = vi.fn();
    const onRefresh = vi.fn();
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onRefresh={onRefresh}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge request' }));

    await waitFor(() =>
      expect(h.gitlabMergeMr).toHaveBeenCalledWith(
        WORKSPACE_ID,
        'https://gitlab.com',
        'acme/web',
        4,
      ),
    );
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('surfaces branches and the last update in the metadata rail', () => {
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Source branch')).toBeDefined();
    expect(screen.getByText('Target branch')).toBeDefined();
    expect(screen.getByText('Updated')).toBeDefined();
    expect(screen.getByText('No description.')).toBeDefined();
  });

  it('disables merge when GitLab reports cannot_be_merged', () => {
    render(
      <MrDetailPanel
        mr={makeMr({ mergeStatus: 'cannot_be_merged' })}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole('button', { name: 'Merge request' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('disables merge when the MR project path cannot be parsed', () => {
    render(
      <MrDetailPanel
        mr={makeMr({ webUrl: 'not a URL' })}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole('button', { name: 'Merge request' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
