// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../hooks/useSessionsEverywhere', () => ({
  useSessionsEverywhere: () => elsewhere.refs,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AgentId, ChatId, IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import type { SessionTitleRef } from '@goodboy/db';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { seedBoardScene } from '../../../../app/components/MockScene/scenes/BoardScene';
import { ToastProvider } from '../../../../shared/components/Toast';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { agentPlace, sessionPlace } from '../../../../store/slices/navigation/place';
import { holdPaletteScope } from '../../heldPaletteScope';
import type { CommitScope } from '../../types';
import { PaletteOverlay } from './index';

const elsewhere = vi.hoisted(() => ({ refs: [] as ReadonlyArray<SessionTitleRef> }));

const PAYOUT = 'mock-board-session-payout-export' as SessionId;
const IMPLEMENTER = 'mock-board-agent-export-implementer' as AgentId;
const ARCHIVED = 'mock-board-session-refund-macros' as SessionId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  elsewhere.refs = [];
  seedBoardScene();
});

afterEach(() => {
  cleanup();
});

const openIn = (sessionId: SessionId | null, agentId: AgentId | null = null) => {
  if (sessionId !== null) {
    act(() =>
      useAppStore.getState().navigate({
        to: agentId === null ? sessionPlace({ sessionId }) : agentPlace({ sessionId, agentId }),
      }),
    );
  }
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <PaletteOverlay onClose={onClose} />
    </ToastProvider>,
  );
  return { onClose, input: screen.getByRole('combobox', { name: 'Command palette search' }) };
};

const type = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
};

const optionNames = () =>
  screen.queryAllByRole('option').map((option) => option.getAttribute('aria-label'));

const selectedName = () =>
  screen
    .getAllByRole('option')
    .find((option) => option.getAttribute('aria-selected') === 'true')
    ?.getAttribute('aria-label');

describe('PaletteOverlay, the commands mode', () => {
  it('names the session in a scope chip and lists its verbs first', () => {
    openIn(PAYOUT);

    expect(screen.getByTitle('Backspace removes the scope').textContent).toBe(
      'Speed up the payout export for large merchants',
    );
    expect(screen.getByText('For this session')).toBeDefined();
    expect(optionNames().slice(0, 3)).toEqual(['Open Review', 'Open Diff', 'Open Terminal']);
    expect(optionNames()).toContain('Delete…');
  });

  it('drops the scope on Backspace in an empty input', () => {
    const { input } = openIn(PAYOUT);

    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(screen.queryByTitle('Backspace removes the scope')).toBeNull();
    expect(screen.queryByText('For this session')).toBeNull();
  });

  it('ranks the payout export first for pay export, across groups', () => {
    const { input } = openIn(null);

    type(input, 'pay export');

    expect(selectedName()).toBe('Speed up the payout export for large merchants');
    expect(screen.queryByText('Sessions')).toBeNull();
  });

  it('lists sessions of other workspaces and names their workspace', () => {
    elsewhere.refs = [
      {
        sessionId: 'northwind-session-ledger' as SessionId,
        workspaceId: 'northwind' as WorkspaceId,
        goal: 'Backfill the ledger snapshot for Northwind',
        stateKind: 'idle',
        updatedAt: '2026-09-27T10:00:00.000Z' as IsoDateTime,
      },
    ];
    useAppStore.setState((state) => ({
      workspaces: [
        ...state.workspaces,
        { ...state.workspaces[0]!, id: 'northwind' as WorkspaceId, name: 'Northwind' },
      ],
    }));
    const { input } = openIn(null);

    type(input, 'backfill snapshot');

    const option = screen.getByRole('option', {
      name: 'Backfill the ledger snapshot for Northwind',
    });
    expect(option.getAttribute('aria-description')).toMatch(/^Northwind · /);
  });

  it('shows what was used recently when the input is empty', () => {
    localStorage.setItem(
      STORAGE_KEYS.paletteFrecency,
      JSON.stringify({ [`session:${PAYOUT}`]: [Date.now() - 1000] }),
    );
    openIn(null);

    const recent = screen.getByText('Recent');
    expect(recent).toBeDefined();
    expect(optionNames()[0]).toBe('Speed up the payout export for large merchants');
  });

  it('opens every verb of a row on the right arrow and goes back on the left', () => {
    const { input } = openIn(null);
    type(input, 'pay export');

    fireEvent.keyDown(input, { key: 'ArrowRight' });

    expect(screen.getByPlaceholderText('Filter actions…')).toBeDefined();
    expect(screen.getByText('Copy and export')).toBeDefined();
    expect(screen.getByText('Danger')).toBeDefined();
    expect(optionNames()).toContain('Archive');

    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(screen.getByPlaceholderText('Type a command or a name')).toBeDefined();
  });

  it('previews the highlighted session with its facts', () => {
    const { input } = openIn(null);
    type(input, 'pay export');

    const preview = screen.getByRole('complementary', { name: 'Preview' });
    expect(within(preview).getByText('Stage')).toBeDefined();
    expect(within(preview).getByText('Spend')).toBeDefined();
  });

  it('morphs Delete into an inline confirm and deletes only after the confirm', () => {
    const deleteTask = vi.fn(async () => undefined);
    useAppStore.setState({ deleteTask } as never);
    const { input, onClose } = openIn(PAYOUT);
    type(input, 'delete');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Delete session?')).toBeDefined();
    expect(deleteTask).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Delete session?')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(deleteTask).toHaveBeenCalledWith(PAYOUT);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('refreshes the open session', () => {
    const resyncSession = vi.fn(async () => undefined);
    useAppStore.setState({ resyncSession } as never);
    const { input } = openIn(PAYOUT);
    type(input, 'refresh session');

    fireEvent.mouseDown(screen.getByRole('option', { name: 'Refresh session' }));

    expect(resyncSession).toHaveBeenCalledWith({ sessionId: PAYOUT });
  });

  it('offers no refresh outside a session or on an archived one', () => {
    const outside = openIn(null);
    type(outside.input, 'refresh session');
    expect(screen.queryByRole('option', { name: 'Refresh session' })).toBeNull();
    cleanup();

    const archived = openIn(ARCHIVED);
    type(archived.input, 'refresh session');
    expect(screen.queryByRole('option', { name: 'Refresh session' })).toBeNull();
  });

  it('closes on Escape and on a click outside', () => {
    const { input, onClose } = openIn(null);

    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByTestId('palette-scrim'));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('PaletteOverlay offers only the verbs the object state allows', () => {
  it('offers Restore and Delete on an archived session, never Archive or Review', () => {
    const { input } = openIn(ARCHIVED);

    expect(optionNames()).toContain('Restore');
    expect(optionNames()).not.toContain('Archive');
    type(input, 'archive');
    expect(optionNames()).not.toContain('Archive');
    type(input, 'review');
    expect(optionNames()).not.toContain('Open Review');
  });

  it('hides a blocked verb until it is searched, then shows it with its reason', () => {
    const { input } = openIn(PAYOUT);

    expect(optionNames()).not.toContain('Open in editor');

    type(input, 'editor');
    const blocked = screen.getByRole('option', { name: 'Open in editor' });
    expect(blocked.getAttribute('aria-disabled')).toBe('true');
    expect(blocked.getAttribute('aria-description')).toBe('This session has no worktree yet');
  });

  it('does not run a blocked verb on Enter', () => {
    const { input, onClose } = openIn(PAYOUT);
    type(input, 'open in editor');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers Interrupt on a running agent and never on an idle one', () => {
    act(() => {
      useAppStore.setState(
        (state) =>
          ({
            agentTurnState: {
              ...state.agentTurnState,
              [IMPLEMENTER]: {
                kind: 'running',
                runId: 'run',
                startedAt: '2026-09-28T09:00:00.000Z',
              },
            },
          }) as never,
      );
    });
    const running = openIn(PAYOUT, IMPLEMENTER);
    expect(screen.getByText('For this agent')).toBeDefined();
    expect(optionNames()).toContain('Interrupt');
    cleanup();

    act(() => {
      useAppStore.setState(
        (state) =>
          ({
            agentTurnState: { ...state.agentTurnState, [IMPLEMENTER]: undefined },
          }) as never,
      );
    });
    const idle = openIn(PAYOUT, IMPLEMENTER);
    type(idle.input, 'interrupt');
    expect(screen.queryByRole('option', { name: 'Interrupt' })).toBeNull();
    expect(running.onClose).not.toHaveBeenCalled();
  });

  it('opens the choices of a verb with a submenu, like Change model', () => {
    const setAgentConfig = vi.fn(async () => undefined);
    useAppStore.setState({ setAgentConfig } as never);
    const { input } = openIn(PAYOUT, IMPLEMENTER);
    type(input, 'change model');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByPlaceholderText('Filter actions…')).toBeDefined();
    expect(optionNames().length).toBeGreaterThan(0);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(setAgentConfig).toHaveBeenCalledOnce();
  });

  it('keeps the session verbs under the agent verbs when an agent is selected', () => {
    openIn(PAYOUT, IMPLEMENTER);

    const eyebrows = screen
      .getAllByText(/^For this (agent|session)$/)
      .map((node) => node.textContent);
    expect(eyebrows).toEqual(['For this agent', 'For this session']);
    expect(optionNames()).toContain('Start agent');
  });
});

describe('PaletteOverlay, copy worktree path', () => {
  const writeText = vi.fn(async (_text: string) => undefined);

  const mount = (name: string, branch: string) => ({
    mountId: `mount-${name}`,
    sessionId: PAYOUT,
    mountName: name,
    worktreePath: `/worktrees/${name}`,
    branch,
  });

  const seedMounts = (mounts: ReadonlyArray<ReturnType<typeof mount>>) => {
    act(() => {
      useAppStore.setState(
        (state) =>
          ({
            sessionProjectMounts: { ...state.sessionProjectMounts, [PAYOUT]: mounts },
          }) as never,
      );
    });
  };

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('copies the only worktree straight away, from the agent scope too', () => {
    seedMounts([mount('ledger-core', 'hl/payout-export')]);
    const { input, onClose } = openIn(PAYOUT, IMPLEMENTER);
    type(input, 'copy worktree');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onClose).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith('/worktrees/ledger-core');
  });

  it('picks one of several worktrees inside the palette, or copies all of them', () => {
    seedMounts([
      mount('ledger-core', 'hl/payout-export'),
      mount('notify-relay', 'hl/payout-webhook'),
    ]);
    const first = openIn(PAYOUT);
    type(first.input, 'copy worktree');
    fireEvent.keyDown(first.input, { key: 'Enter' });

    expect(optionNames()).toEqual(['ledger-core', 'notify-relay', 'Copy all paths']);
    type(first.input, 'webhook');
    fireEvent.keyDown(first.input, { key: 'Enter' });
    expect(writeText).toHaveBeenLastCalledWith('/worktrees/notify-relay');
    cleanup();

    const second = openIn(PAYOUT);
    type(second.input, 'copy worktree');
    fireEvent.keyDown(second.input, { key: 'Enter' });
    fireEvent.keyDown(second.input, { key: 'Enter', metaKey: true });
    expect(writeText).toHaveBeenLastCalledWith('/worktrees/ledger-core\n/worktrees/notify-relay');
    expect(second.onClose).toHaveBeenCalledOnce();
  });
});

const IMPORTER_SHA = 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1';

const commitScope = (fields: {
  readonly isFolded?: boolean;
  readonly canFoldDown?: boolean;
  readonly onRename?: () => void;
}): CommitScope => ({
  kind: 'commit',
  sessionId: PAYOUT,
  facts: {
    sha: IMPORTER_SHA,
    shortSha: 'b2c3d4e',
    subject: 'Keep trailing-comma rows in the ledger-core importer',
    isFolded: fields.isFolded ?? false,
    isRemoved: false,
    canRemove: true,
    canFoldDown: fields.canFoldDown ?? true,
    onRename: fields.onRename ?? vi.fn(),
    onFoldDown: vi.fn(),
    onSquashDown: vi.fn(),
    onToggleRemove: vi.fn(),
    onSeparate: vi.fn(),
    onMove: vi.fn(),
  },
});

const focusCommitRow = (scope: CommitScope): (() => void) => {
  const row = document.createElement('div');
  row.tabIndex = 0;
  document.body.append(row);
  const release = holdPaletteScope({ element: row, scope });
  row.focus();
  return () => {
    release();
    row.remove();
  };
};

describe('PaletteOverlay on a focused commit row', () => {
  it('opens on the commit with its verbs first, in the order of its ⋯ menu', () => {
    const release = focusCommitRow(commitScope({}));
    openIn(PAYOUT);

    expect(screen.getByTitle('Backspace removes the scope').textContent).toBe(
      'Keep trailing-comma rows in the ledger-core importer',
    );
    expect(screen.getByText('For this commit')).toBeDefined();
    expect(optionNames().slice(0, 8)).toEqual([
      'Rename',
      'Fold down',
      'Squash down',
      'Move up',
      'Move down',
      'Copy SHA',
      'Copy subject',
      'Remove',
    ]);
    release();
  });

  it('runs the verb on that commit', () => {
    const onRename = vi.fn();
    const release = focusCommitRow(commitScope({ onRename }));
    const { input } = openIn(PAYOUT);

    type(input, 'rename');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledTimes(1);
    release();
  });

  it('offers only Separate and the copies on a folded commit', () => {
    const release = focusCommitRow(commitScope({ isFolded: true }));
    openIn(PAYOUT);

    expect(optionNames().slice(0, 3)).toEqual(['Separate', 'Copy SHA', 'Copy subject']);
    expect(optionNames()).not.toContain('Rename');
    release();
  });

  it('hides Squash down on the oldest commit until it is searched, then gives the reason', () => {
    const release = focusCommitRow(commitScope({ canFoldDown: false }));
    const { input } = openIn(PAYOUT);

    expect(optionNames()).not.toContain('Squash down');
    type(input, 'squash');
    const blocked = screen.getByRole('option', { name: 'Squash down' });
    expect(blocked.getAttribute('aria-disabled')).toBe('true');
    expect(blocked.getAttribute('aria-description')).toBe('Nothing below to combine with');
    release();
  });

  it('falls back to the session once focus leaves the commit row', () => {
    const release = focusCommitRow(commitScope({}));
    (document.activeElement as HTMLElement).blur();
    openIn(PAYOUT);

    expect(screen.getByText('For this session')).toBeDefined();
    release();
  });
});

describe('PaletteOverlay, Ask in Chat', () => {
  it('puts Ask in Chat first on every search, with the query, above Jump to', () => {
    const { input } = openIn(null);

    type(input, 'pay export');

    expect(optionNames()[0]).toBe('Ask in Chat');
    expect(
      screen.getByRole('option', { name: 'Ask in Chat' }).getAttribute('aria-description'),
    ).toBe('"pay export"');
    expect(screen.getByText('Jump to')).toBeDefined();
  });

  it('keeps the best match picked for a name, and Ask in Chat picked for a question', () => {
    const { input } = openIn(null);

    type(input, 'pay export');
    expect(selectedName()).toBe('Speed up the payout export for large merchants');

    type(input, 'Where do we validate IBANs?');
    expect(selectedName()).toBe('Ask in Chat');
  });

  it('opens a new chat with the query as its first message on Enter', async () => {
    const createChat = vi.fn(async () => 'chat-ask' as ChatId);
    const sendChatMessage = vi.fn(async () => true);
    const loadSetting = vi.fn(async () => null);
    useAppStore.setState({ createChat, sendChatMessage, loadSetting });
    const { input, onClose } = openIn(null);

    type(input, 'Where do we validate IBANs?');
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onClose).toHaveBeenCalled();
    expect(createChat).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: useAppStore.getState().currentWorkspaceId }),
    );
    expect(useAppStore.getState().appStudio).toEqual({ kind: 'chat', chatId: 'chat-ask' });
    expect(sendChatMessage).toHaveBeenCalledWith({
      chatId: 'chat-ask',
      content: 'Where do we validate IBANs?',
    });
  });

  it('offers Ask about this session first inside a session, then Ask in Chat', () => {
    const { input } = openIn(PAYOUT);

    type(input, 'pay export');

    expect(optionNames().slice(0, 2)).toEqual(['Ask about this session', 'Ask in Chat']);
    expect(selectedName()).toBe('Speed up the payout export for large merchants');
    type(input, 'Why did the tester fail?');
    expect(selectedName()).toBe('Ask about this session');
  });

  it('opens Ask beside the session and sends the question on Enter', async () => {
    const sendAskQuestion = vi.fn(async () => true);
    useAppStore.setState({ sendAskQuestion });
    const { input, onClose } = openIn(PAYOUT);

    type(input, 'Why did the tester fail?');
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onClose).toHaveBeenCalled();
    expect(useAppStore.getState().drawer).toEqual({
      kind: 'ask',
      sessionId: PAYOUT,
      payload: null,
    });
    expect(sendAskQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: PAYOUT, question: 'Why did the tester fail?' }),
    );
  });

  it('keeps Ask in Chat alone on the Board', () => {
    const { input } = openIn(null);
    type(input, 'Why did the tester fail?');
    expect(optionNames()).not.toContain('Ask about this session');
  });

  it('stacks a filter popover opened inside the palette in the palette layer', () => {
    render(
      <ToastProvider>
        <PaletteOverlay mode="search" onClose={vi.fn()} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Filter by type' }));

    const portal = document.querySelector('[data-dropdown-portal]');
    expect(portal).not.toBeNull();
    expect(portal?.parentElement?.className).toContain('z-command-palette');
  });

  it('offers no Ask in Chat on an empty input or a prefixed search', () => {
    const { input } = openIn(null);

    expect(optionNames()).not.toContain('Ask in Chat');
    type(input, '>refresh');
    expect(optionNames()).not.toContain('Ask in Chat');
  });
});
