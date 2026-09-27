// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { seedSessionWithMounts } from '../helpers/seedSessionWithMounts';
import { ToastProvider } from '../../app/components/Toast';
import { KeepAliveWorkSurface } from '../../app/components/KeepAliveWorkSurface';
import { ThemeToggle } from '../../app/components/AppTopBar/ThemeToggle';
import { useThemeStore } from '../../shared/lib/theme';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  document.documentElement.removeAttribute('data-theme');
  useThemeStore.setState({ preference: 'dark', theme: 'dark' });
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-switching');
  useThemeStore.setState({ preference: 'dark', theme: 'dark' });
});

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

describe('theme switch on the session detail page', () => {
  it('keeps every node of the page mounted and its text on screen across toggles', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });
    render(
      <ToastProvider>
        <ThemeToggle />
        <div data-testid="session-surface">
          <KeepAliveWorkSurface sessionId={sessionId} isActive />
        </div>
      </ToastProvider>,
    );
    await flush();

    const surface = screen.getByTestId('session-surface');
    const startAgent = screen.getByRole('button', { name: 'Start agent' });
    const textBefore = surface.textContent;
    const removed: Array<Node> = [];
    const added: Array<Node> = [];
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        removed.push(...Array.from(record.removedNodes));
        added.push(...Array.from(record.addedNodes));
      });
    });
    observer.observe(surface, { childList: true, subtree: true });

    for (const expected of ['light', 'dark', 'light'] as const) {
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /Switch to/ }));
      });
      expect(useThemeStore.getState().theme).toBe(expected);
      expect(document.documentElement.hasAttribute('data-theme-switching')).toBe(true);
      expect(surface.textContent).toBe(textBefore);
      await flush();
    }
    observer.disconnect();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.hasAttribute('data-theme-switching')).toBe(false);
    expect(removed).toEqual([]);
    expect(added).toEqual([]);
    expect(screen.getByRole('button', { name: 'Start agent' })).toBe(startAgent);
    expect(surface.textContent).toBe(textBefore);
  });
});
