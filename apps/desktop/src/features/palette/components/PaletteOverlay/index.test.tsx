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
import type { AgentId, IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import type { SessionTitleRef } from '@goodboy/db';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { seedBoardScene } from '../../../../app/components/MockScene/scenes/BoardScene';
import { ToastProvider } from '../../../../app/components/Toast';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { agentPlace, sessionPlace } from '../../../../store/slices/navigation/place';
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
});
