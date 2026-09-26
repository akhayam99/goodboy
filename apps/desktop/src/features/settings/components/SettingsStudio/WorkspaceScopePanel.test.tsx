// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { OverrideSettings } from '@goodboy/types';
import {
  mergeWorkspaceOverrides,
  type WorkspaceOverridesPatch,
} from '../../../../store/slices/overrides/patchWorkspaceOverrides';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    loadSetting: vi.fn(async () => null),
    saveSetting: vi.fn(async () => undefined),
    disconnectWorkspace: vi.fn(async () => undefined),
    workspaces: [] as ReadonlyArray<{ id: string; name: string; rootPath: string }>,
    projects: [] as ReadonlyArray<{ id: string; workspaceId: string }>,
    renameWorkspace: vi.fn(async () => undefined),
    workspaceOverrides: {} as Record<string, OverrideSettings>,
    setWorkspaceOverrides: vi.fn(async (_workspaceId: string, _overrides: unknown) => undefined),
    patchWorkspaceOverrides: async (_params: {
      workspaceId: string;
      patch: WorkspaceOverridesPatch;
    }): Promise<void> => undefined,
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<{ id: string; connection: string }>,
    orphanWorktrees: {} as Record<string, ReadonlyArray<{ path: string; name: string }>>,
    retainedWorktreePaths: {} as Record<string, ReadonlyArray<unknown>>,
    focusStorage: vi.fn(),
    currentWorkspaceId: null as string | null,
    sessions: [] as ReadonlyArray<{ id: string; state: { kind: string } }>,
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: Object.assign(<T,>(selector: (s: typeof state) => T) => selector(state), {
    getState: () => state,
  }),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../../../../features/skills/components/SkillsPanel', () => ({
  SkillsPanel: () => null,
}));

vi.mock('../../../../features/session/components/VerbositySelect', () => ({
  VerbositySelect: () => null,
}));

vi.mock('../../../../features/chat/utils/chat-constants', () => ({
  PROVIDER_LABEL: { anthropic: 'Claude', cursor: 'Cursor', codex: 'Codex', gemini: 'Gemini' },
}));

vi.mock('../../../../features/providers/components/provider-brand', () => ({
  PROVIDER_BRAND: {
    anthropic: { icon: () => null },
    cursor: { icon: () => null },
    codex: { icon: () => null },
    gemini: { icon: () => null },
  },
  brandColor: () => '#000000',
}));

const EMPTY: OverrideSettings = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
};

beforeEach(() => {
  state.loadSetting = vi.fn(async () => null);
  state.saveSetting = vi.fn(async () => undefined);
  state.disconnectWorkspace = vi.fn(async () => undefined);
  state.workspaces = [{ id: 'ws-1', name: 'billing', rootPath: '/repos/billing-api' }];
  state.renameWorkspace = vi.fn(async () => undefined);
  state.workspaceOverrides = {};
  state.setWorkspaceOverrides = vi.fn(
    async (_workspaceId: string, _overrides: unknown) => undefined,
  );
  state.patchWorkspaceOverrides = ({ workspaceId, patch }) =>
    state.setWorkspaceOverrides(
      workspaceId,
      mergeWorkspaceOverrides({
        base: state.workspaceOverrides[workspaceId] ?? EMPTY,
        patch,
      }),
    );
  state.workspaceIntegrations = {};
  state.providers = [];
  state.orphanWorktrees = {};
  state.retainedWorktreePaths = {};
  state.focusStorage = vi.fn();
  state.currentWorkspaceId = null;
  state.sessions = [];
  toastMock.mockReset();
});
afterEach(cleanup);

import { overridesWithAttribution } from '../../../../__tests__/helpers/attributionOverrides';
import { WorkspaceScopePanel } from './WorkspaceScopePanel';

const attributionSwitch = (): HTMLElement => {
  const row = screen.getByText('Attribution line').parentElement?.parentElement;
  if (row == null) {
    throw new Error('attribution row not rendered');
  }
  return within(row).getByRole('switch');
};

describe('WorkspaceScopePanel', () => {
  it('renders the one-page fields without a nav rail', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    expect(screen.getByLabelText(/branch prefix/i)).toBeDefined();
    expect(screen.queryByText(/default provider/i)).toBeNull();
    expect(screen.getByText(/parallel agents/i)).toBeDefined();
    expect(screen.queryByText('Linear')).toBeNull();
    expect(screen.queryByText('GitHub')).toBeNull();
    expect(screen.queryByRole('button', { name: /^general$/i })).toBeNull();
  });

  it('orders the sections projects, about you, new sessions, disconnect', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    const order = [
      ...[/^projects/i, /^about you$/i, /^new sessions$/i].map((name) =>
        screen.getByRole('heading', { level: 2, name }),
      ),
      screen.getByRole('region', { name: 'Disconnect workspace' }),
    ];
    for (let i = 0; i < order.length - 1; i += 1) {
      expect(
        order[i]!.compareDocumentPosition(order[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('folds parallel agents into the new sessions grid with its help behind the info mark', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    const section = screen.getByRole('region', { name: 'New sessions' });
    expect(section.textContent).toContain('Parallel agents');
    expect(
      within(section).getByRole('img', {
        name: 'Lets eligible agents split independent work and reconcile it in one output.',
      }),
    ).toBeDefined();
  });

  it('shows the attribution line as on until the workspace switches it off', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    const section = screen.getByRole('region', { name: 'New sessions' });
    expect(section.textContent).toContain('Attribution line');
    expect(attributionSwitch().getAttribute('aria-checked')).toBe('true');
  });

  it('persists the attribution switch on both edges', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);

    fireEvent.click(attributionSwitch());

    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({ attributionFooter: false }),
    );

    cleanup();
    state.workspaceOverrides = {
      'ws-1': overridesWithAttribution({ attributionFooter: false }),
    };
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);

    expect(attributionSwitch().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(attributionSwitch());

    expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
      'ws-1',
      expect.objectContaining({ attributionFooter: true }),
    );
  });

  it('leaves attribution footer null when saving an unrelated override', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);

    const input = screen.getByLabelText(/branch prefix/i);
    fireEvent.change(input, { target: { value: 'feature' } });
    fireEvent.blur(input);

    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({ attributionFooter: null }),
    );
  });

  it('writes only the parallel agents key, never a resolved verbosity', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    const row = screen.getByText('Parallel agents').parentElement?.parentElement;
    if (row == null) {
      throw new Error('parallel agents row not rendered');
    }

    fireEvent.click(within(row).getByRole('switch'));

    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith('ws-1', {
      ...EMPTY,
      parallelAgents: true,
    });
  });

  it('renames the workspace in the title on blur', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'billing' })).toBeDefined();
    expect(screen.queryByLabelText(/display name/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rename billing' }));

    const input = screen.getByLabelText('Workspace name');
    expect((input as HTMLInputElement).value).toBe('billing');
    fireEvent.change(input, { target: { value: 'Billing platform' } });
    fireEvent.blur(input);

    expect(state.renameWorkspace).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      name: 'Billing platform',
    });
  });

  it('spends no write on a name that did not change', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename billing' }));

    const input = screen.getByLabelText('Workspace name');
    fireEvent.change(input, { target: { value: '  billing  ' } });
    fireEvent.blur(input);

    expect(state.renameWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'billing' })).toBeDefined();
  });

  it('keeps the old name when the rename is escaped', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename billing' }));

    const input = screen.getByLabelText('Workspace name');
    fireEvent.change(input, { target: { value: 'Something else' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(state.renameWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'billing' })).toBeDefined();
  });

  it('disconnects only after the row confirm and closes settings', async () => {
    const requestClose = vi.fn();
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={requestClose} />);
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(state.disconnectWorkspace).not.toHaveBeenCalled();

    const confirm = screen.getByRole('group', { name: 'Disconnect billing?' });
    expect(within(confirm).getByText(/Choose Add workspace with the same folder/)).toBeDefined();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(state.disconnectWorkspace).toHaveBeenCalledWith('ws-1'));
    await waitFor(() => expect(requestClose).toHaveBeenCalledOnce());
  });

  it('cancels the disconnect back to its trigger', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(state.disconnectWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeDefined();
  });

  it('counts the running sessions it stops when the workspace is current', () => {
    state.currentWorkspaceId = 'ws-1';
    state.sessions = [
      { id: 's-1', state: { kind: 'running' } },
      { id: 's-2', state: { kind: 'running' } },
      { id: 's-3', state: { kind: 'idle' } },
    ];
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));

    expect(
      screen.getByRole('group', { name: 'Disconnect billing and stop 2 running sessions?' }),
    ).toBeDefined();
  });

  it('claims no stopped sessions for a workspace that is not current', () => {
    state.currentWorkspaceId = 'ws-2';
    state.sessions = [{ id: 's-1', state: { kind: 'running' } }];
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));

    expect(screen.getByRole('group', { name: 'Disconnect billing?' })).toBeDefined();
  });

  it('hides the leftover folders notice when there is nothing to clean', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    expect(screen.queryByText(/left on disk/i)).toBeNull();
  });

  it('points the leftover folders to Storage filtered on this workspace', () => {
    state.orphanWorktrees = {
      'ws-1': [{ path: '/repo/.goodboy/worktrees/gb-ghost', name: 'gb-ghost' }],
    };
    const opened = vi.fn();
    window.addEventListener('goodboy:open-settings', opened);
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);

    expect(screen.getByText('1 session folder from this workspace is left on disk.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Review in Storage' }));

    expect(state.focusStorage).toHaveBeenCalledWith({ filter: 'review', workspaceId: 'ws-1' });
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener('goodboy:open-settings', opened);
  });
});
