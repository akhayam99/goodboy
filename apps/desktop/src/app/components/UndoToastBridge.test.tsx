import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { currentPlatform } from '../../shared/platform';
import { ToastProvider } from '../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../store/storyHarness';
import { UndoToastBridge } from './UndoToastBridge';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());

let useAppStore: StoryStore;
const SESSION = 'session-northwind' as SessionId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const setup = () => {
  render(
    <ToastProvider>
      <UndoToastBridge />
      <input aria-label="Title" />
      <textarea aria-label="Notes" />
      <button type="button">Work</button>
    </ToastProvider>,
  );
  act(() => {
    useAppStore.setState({ currentSessionId: null });
    useAppStore.getState().undoable({
      message: 'Unlinked NW-142',
      undo: async () => {
        useAppStore.setState({ currentSessionId: SESSION });
      },
    });
  });
};

const undoKey = () => ({
  code: 'KeyZ',
  key: 'z',
  metaKey: currentPlatform() === 'darwin',
  ctrlKey: currentPlatform() !== 'darwin',
});

describe('app Undo', () => {
  it('keeps same-worded operation toasts attached to their own Undo', async () => {
    setup();
    const latest = 'session-latest' as SessionId;
    act(() => {
      useAppStore.getState().undoable({
        message: 'Unlinked NW-142',
        undo: async () => {
          useAppStore.setState({ currentSessionId: latest });
        },
      });
    });
    const buttons = screen.queryAllByRole('button', { name: 'Undo' });
    expect(buttons).toHaveLength(2);
    const last = buttons.at(-1);
    if (last === undefined) {
      throw new Error('Expected latest Undo');
    }
    await act(async () => {
      fireEvent.click(last);
    });
    expect(useAppStore.getState().currentSessionId).toBe(latest);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
  });

  it('offers an Undo toast and consumes the operation from its button', async () => {
    setup();
    screen.getByText('Unlinked NW-142');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(useAppStore.getState().currentSessionId).toBe(SESSION);
    expect(useAppStore.getState().undoStack).toEqual([]);
  });

  it('undoes the latest operation from Cmd+Z outside text fields', async () => {
    setup();
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Work' }), undoKey());
    });
    expect(useAppStore.getState().currentSessionId).toBe(SESSION);
    expect(useAppStore.getState().undoStack).toEqual([]);
  });

  it.each(['Title', 'Notes'])('leaves native text Undo alone in %s', async (name) => {
    setup();
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name }), undoKey());
    });
    expect(useAppStore.getState().currentSessionId).toBeNull();
    expect(useAppStore.getState().undoStack).toHaveLength(1);
  });

  it('dismisses the toast at ten seconds but keeps keyboard Undo available', async () => {
    vi.useFakeTimers();
    setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9999);
    });
    screen.getByRole('button', { name: 'Undo' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Work' }), undoKey());
    });
    expect(useAppStore.getState().currentSessionId).toBe(SESSION);
  });
});
