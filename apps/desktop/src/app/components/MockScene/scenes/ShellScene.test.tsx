// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { useAppStore } from '../../../../store';
import { SESSION } from './workflowSeed';
import { ShellScene } from './ShellScene';

beforeAll(async () => {
  await importStore();
  await import('../../../../features/settings/components/SettingsStudio');
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  window.history.replaceState(null, '', '/?scene=shell');
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const pageTab = (label: string): HTMLElement => {
  const tab = screen
    .getAllByRole('tab')
    .find((candidate) => (candidate.textContent ?? '').trim().startsWith(label));
  if (tab === undefined) {
    throw new Error(`no ${label} tab in the page tabs`);
  }
  return tab;
};

const renderShell = async () => {
  render(<ShellScene />);
  await screen.findByTestId('pane-toggle-terminal');
};

describe('the shell scene mounts the real session workspace', () => {
  it('opens the step of its preset run with the page tabs on the session, Ask and no trail band', async () => {
    await renderShell();
    expect(document.querySelector('[data-slot="trail-bar"]')).toBeNull();
    expect(screen.getAllByRole('tablist', { name: 'Session pages' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Back to Runs' })).toBeNull();
    expect(useAppStore.getState().currentSessionId).toBe(SESSION.id);
  });

  it('moves to Runs and Artifacts from the page tabs', async () => {
    await renderShell();
    const moves: ReadonlyArray<readonly [string, string]> = [
      ['Runs', 'workflows'],
      ['Artifacts', 'plans'],
    ];
    for (const [label, lens] of moves) {
      act(() => {
        fireEvent.click(pageTab(label));
      });
      await waitFor(() => expect(useAppStore.getState().activeLens[SESSION.id]).toBe(lens));
    }
  });

  it('opens Settings as a page beside the live column and Back to app returns to the session', async () => {
    await renderShell();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    });
    await waitFor(() => screen.getByRole('complementary', { name: 'Settings scopes' }));
    expect(useAppStore.getState().appStudio?.kind).toBe('settings');
    const column = screen.getByRole('navigation', { name: 'Sidebar' });
    expect(column.hasAttribute('inert')).toBe(false);
    expect(
      column.querySelector('[data-column-door="settings"]')?.getAttribute('aria-current'),
    ).toBe('page');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Back to app/ }));
    });
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Settings scopes' })).toBeNull(),
    );
    expect(useAppStore.getState().appStudio).toBeNull();
    expect(screen.getByTestId('pane-toggle-terminal')).toBeDefined();
  });
});
