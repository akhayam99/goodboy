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

const pageRow = (label: string): HTMLElement => {
  const row = screen
    .getAllByRole('button')
    .find((button) =>
      (button.getAttribute('aria-label') ?? button.textContent ?? '').trim().startsWith(label),
    );
  if (row === undefined) {
    throw new Error(`no ${label} row in the column`);
  }
  return row;
};

const renderShell = async () => {
  render(<ShellScene />);
  await screen.findByTestId('pane-toggle-ask');
};

describe('the shell scene mounts the real session workspace', () => {
  it('opens the step of its preset run with the rail on the session, Ask and no trail band', async () => {
    await renderShell();
    expect(document.querySelector('[data-slot="trail-bar"]')).toBeNull();
    expect(document.querySelector('[data-session-rail]')?.getAttribute('data-session-rail')).toBe(
      'session',
    );
    expect(screen.queryByRole('button', { name: 'Back to Runs' })).toBeNull();
    expect(useAppStore.getState().currentSessionId).toBe(SESSION.id);
  });

  it('moves to Runs and Artifacts from the session level', async () => {
    await renderShell();
    const moves: ReadonlyArray<readonly [string, string]> = [
      ['Runs', 'workflows'],
      ['Artifacts', 'plans'],
    ];
    for (const [label, lens] of moves) {
      act(() => {
        fireEvent.click(pageRow(label));
      });
      await waitFor(() => expect(useAppStore.getState().activeLens[SESSION.id]).toBe(lens));
    }
  });

  it('swaps the column for Settings and Back to app returns to the session', async () => {
    await renderShell();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    });
    await waitFor(() => expect(document.querySelector('[data-settings-column]')).not.toBeNull());
    expect(useAppStore.getState().appStudio?.kind).toBe('settings');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Back to app/ }));
    });
    await waitFor(() => expect(document.querySelector('[data-settings-column]')).toBeNull());
    expect(useAppStore.getState().appStudio).toBeNull();
    expect(screen.getByTestId('pane-toggle-ask')).toBeDefined();
  });
});
