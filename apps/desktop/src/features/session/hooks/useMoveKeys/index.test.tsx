// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 10, 31, 0));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type OpenQuestionId } from '@goodboy/types';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import { shortcutGlyphs, type ShortcutId } from '../../../../shared/keyboard/registry';
import { captureLocation } from '../../../../store/slices/navigation/captureLocation';
import { questionPlace, sessionPlace } from '../../../../store/slices/navigation/place';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../store/runtime/worktreeStatuses/cache';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
} from '../../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('../../components/SessionOverviewPane').SessionOverviewPane;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('../../components/SessionOverviewPane'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(cleanup);

afterAll(() => {
  vi.useRealTimers();
});

const show = async () => {
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId: COLUMN_SESSION_ID }) });
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <AutoReleaseContext.Provider value>
          <SessionOverviewPane session={session} />
        </AutoReleaseContext.Provider>
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
};

const MARK_READY = 'suggestion:mark-ready:mock-central-mount-payments-api';

const QUESTION = 'question:mock-central-question-cap';

const REBASE = 'suggestion:rebase-project:mock-run-session-webhooks';

type PressParams = {
  readonly id: ShortcutId;
  readonly target?: Element;
};

const press = async ({ id, target }: PressParams): Promise<KeyboardEvent> => {
  const event = pressShortcut({ id, ...(target !== undefined && { target }) });
  await act(async () => {
    await Promise.resolve();
  });
  return event;
};

const moveOf = (id: string): Element | null => document.querySelector(`[data-move="${id}"]`);

const lensNow = (): string | null => {
  const { place } = captureLocation({ state: useAppStore.getState() });
  return place.at === 'session' ? place.view.lens : null;
};

describe('the keys of the move in front', () => {
  it('runs the primary verb of the move in front on Enter', async () => {
    seedCentralColumn({ kind: 'mid' });
    await show();
    const navigate = vi.fn();
    useAppStore.setState({ navigate });
    await act(async () => {
      await Promise.resolve();
    });
    expect(moveOf(QUESTION)?.hasAttribute('data-move-primary')).toBe(true);

    const event = await press({ id: 'list.open' });

    expect(event.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith({
      to: questionPlace({
        sessionId: COLUMN_SESSION_ID,
        questionId: brandId<OpenQuestionId>({ value: 'mock-central-question-cap' }),
      }),
    });
  });

  it('prints the Enter key on the button of the move in front', async () => {
    seedCentralColumn({ kind: 'finished' });
    await show();
    const verb = screen.getByRole('button', { name: 'Mark ready' });

    fireEvent.mouseEnter(verb);

    const tip = await screen.findByRole('tooltip', undefined, { timeout: 3000 });
    expect(tip.textContent).toContain(shortcutGlyphs('list.open'));
  });

  it('puts a move out of the way on S and brings it back with Undo', async () => {
    seedCentralColumn({ kind: 'finished' });
    await show();
    expect(moveOf(MARK_READY)).not.toBeNull();

    await press({ id: 'move.notNow' });

    await waitFor(() => expect(moveOf(MARK_READY)).toBeNull());
    await act(async () => {
      await useAppStore.getState().undoLastOperation({});
    });
    await waitFor(() => expect(moveOf(MARK_READY)).not.toBeNull());
  });

  it('walks the moves with J and K, then S acts on the move with the focus', async () => {
    seedCentralColumn({ kind: 'mid' });
    await show();

    await press({ id: 'list.next', target: document.body });
    expect(document.activeElement?.closest('[data-move]')).toBe(moveOf(QUESTION));
    await press({ id: 'list.next' });
    expect(document.activeElement?.closest('[data-move]')).toBe(moveOf(REBASE));
    await press({ id: 'list.previous' });
    expect(document.activeElement?.closest('[data-move]')).toBe(moveOf(QUESTION));
    await press({ id: 'list.next' });
    await press({ id: 'move.notNow' });

    await waitFor(() => expect(moveOf(REBASE)).toBeNull());
    expect(moveOf(QUESTION)).not.toBeNull();
  });

  it('stays quiet in a text field and in a terminal', async () => {
    seedCentralColumn({ kind: 'finished' });
    await show();
    const field = document.createElement('input');
    const terminal = document.createElement('div');
    terminal.className = 'xterm';
    const terminalInput = document.createElement('textarea');
    terminal.append(terminalInput);
    document.body.append(field, terminal);

    for (const target of [field, terminalInput]) {
      target.focus();
      const notNow = await press({ id: 'move.notNow', target });
      const open = await press({ id: 'list.open', target });
      expect(notNow.defaultPrevented).toBe(false);
      expect(open.defaultPrevented).toBe(false);
    }

    expect(moveOf(MARK_READY)).not.toBeNull();
    expect(lensNow()).toBeNull();
    field.remove();
    terminal.remove();
  });

  it('leaves a move alone while a page covers the session', async () => {
    seedCentralColumn({ kind: 'finished' });
    await show();
    act(() => {
      useAppStore.getState().openStudio({ studio: { kind: 'guide' } });
    });

    const event = await press({ id: 'move.notNow' });

    expect(event.defaultPrevented).toBe(false);
    expect(moveOf(MARK_READY)).not.toBeNull();
  });
});
