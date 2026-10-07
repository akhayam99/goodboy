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
    .find((button) => button.textContent?.trim().startsWith(label) === true);
  if (row === undefined) {
    throw new Error(`no ${label} row in the column`);
  }
  return row;
};

const trailSegments = (): ReadonlyArray<string> =>
  [...document.querySelectorAll<HTMLElement>('[data-trail-segment]')].map(
    (segment) => segment.dataset['trailSegment'] ?? '',
  );

const renderShell = async () => {
  render(<ShellScene />);
  await screen.findByTestId('ask-trail-button');
};

describe('the shell scene mounts the real session workspace', () => {
  it('shows the trail band with Ask over the open session', async () => {
    await renderShell();
    expect(document.querySelector('[data-slot="trail-bar"]')).not.toBeNull();
    expect(trailSegments()[0]).toBe('overview');
    expect(useAppStore.getState().currentSessionId).toBe(SESSION.id);
  });

  it('moves to Branch, Runs, Agents and Artifacts from the column', async () => {
    await renderShell();
    const moves: ReadonlyArray<readonly [string, string]> = [
      ['Branch', 'branch'],
      ['Runs', 'lens-workflows'],
      ['Agents', 'lens-agents'],
      ['Artifacts', 'lens-plans'],
    ];
    for (const [label, segment] of moves) {
      act(() => {
        fireEvent.click(pageRow(label));
      });
      await waitFor(() => expect(trailSegments()).toContain(segment));
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
    expect(screen.getByTestId('ask-trail-button')).toBeDefined();
  });
});
