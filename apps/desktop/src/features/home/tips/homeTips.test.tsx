// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../store/storyHarness';
import { HomePage } from '../HomePage';
import { HOME_TIPS } from './homeTips';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  storySpies.getWorkspaceValue.mockResolvedValue(null);
  storySpies.getSetting.mockResolvedValue(null);
  storySpies.setSetting.mockResolvedValue(undefined);
  store.setState({ currentWorkspaceId: WS, boardReady: true, switchingToWorkspaceId: null });
});

afterEach(cleanup);

const mount = () =>
  render(
    <ToastProvider>
      <HomePage workspaceId={WS} />
    </ToastProvider>,
  );

const tipBar = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-home-tip]');

describe('Home tips', () => {
  it('keeps the list short', () => {
    expect(HOME_TIPS.length).toBeGreaterThan(0);
    expect(HOME_TIPS.length).toBeLessThanOrEqual(10);
  });

  it('shows one tip, the first one not closed yet', async () => {
    mount();

    await waitFor(() => expect(tipBar()).not.toBeNull());
    expect(tipBar()?.getAttribute('data-home-tip')).toBe(HOME_TIPS[0]?.id);
    expect(document.querySelectorAll('[data-home-tip]')).toHaveLength(1);
  });

  it('writes the key of that tip alone, and hides the tip only after the write landed', async () => {
    let finish: () => void = () => undefined;
    storySpies.setSetting.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    mount();
    await waitFor(() => expect(tipBar()).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Close tip' }));

    expect(storySpies.setSetting).toHaveBeenCalledWith(
      expect.anything(),
      `home.tip.${HOME_TIPS[0]?.id}`,
      '1',
    );
    expect(tipBar()).not.toBeNull();
    await act(async () => finish());
    await waitFor(() => expect(tipBar()).toBeNull());
  });

  it('does not open the next tip in the same visit', async () => {
    mount();
    await waitFor(() => expect(tipBar()).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Close tip' }));

    await waitFor(() => expect(tipBar()).toBeNull());
    await act(async () => undefined);
    expect(tipBar()).toBeNull();
  });

  it('keeps the tip and shows the error when the write fails, and closes on the next press', async () => {
    storySpies.setSetting.mockRejectedValueOnce(new Error('disk is full'));
    mount();
    await waitFor(() => expect(tipBar()).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Close tip' }));

    await screen.findByText("Couldn't close this tip. Try closing it again.");
    expect(tipBar()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close tip' }));
    await waitFor(() => expect(tipBar()).toBeNull());
    expect(storySpies.setSetting).toHaveBeenCalledTimes(2);
  });

  it('skips a tip already closed, and shows none when all are closed', async () => {
    const first = HOME_TIPS[0]?.id;
    storySpies.getSetting.mockImplementation(async (_db, key) =>
      key === `home.tip.${first}` ? '1' : null,
    );
    mount();

    await waitFor(() => expect(tipBar()).not.toBeNull());
    expect(tipBar()?.getAttribute('data-home-tip')).toBe(HOME_TIPS[1]?.id);
    cleanup();

    storySpies.getSetting.mockResolvedValue('1');
    mount();
    await screen.findByRole('button', { name: 'Hide Spend' });
    expect(tipBar()).toBeNull();
  });

  it('keeps both dismissals when two windows each close a different tip', async () => {
    mount();
    await waitFor(() => expect(tipBar()).not.toBeNull());
    const first = HOME_TIPS[0]?.id ?? '';
    const second = HOME_TIPS[1]?.id ?? '';

    fireEvent.click(screen.getByRole('button', { name: 'Close tip' }));
    await waitFor(() => expect(store.getState().settings[`home.tip.${first}`]).toBe('1'));
    act(() =>
      store.setState((state) => ({
        settings: { ...state.settings, [`home.tip.${second}`]: '1' },
      })),
    );

    expect(store.getState().settings[`home.tip.${first}`]).toBe('1');
    expect(store.getState().settings[`home.tip.${second}`]).toBe('1');
    expect(tipBar()).toBeNull();
  });
});
