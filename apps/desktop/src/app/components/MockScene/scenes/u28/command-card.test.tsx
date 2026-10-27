// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { U28_COMMAND_CARD_SCENES } from './command-card';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('command card scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U28_COMMAND_CARD_SCENES)).toEqual(['command-card']);
    expect(MOCK_SCENES['command-card']).toBe(U28_COMMAND_CARD_SCENES['command-card']);
  });

  it('opens the failed command to its command, its output and the four verbs', () => {
    const Scene = U28_COMMAND_CARD_SCENES['command-card'];
    render(<Scene />);
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId('tool-command').textContent).toBe(
      '$ pnpm --filter payments-api test -- --run settlement',
    );
    expect(screen.getByTestId('tool-output').textContent).toContain('AssertionError');
    screen.getByRole('button', { name: 'Copy command' });
    screen.getByRole('button', { name: 'Copy output' });
    screen.getByRole('button', { name: 'Ask about this output' });
    expect(screen.getAllByRole('button', { name: 'Run in terminal' })).toHaveLength(2);
  });

  it('types the shell block of the message as one paste in the agent folder without running it', () => {
    const Scene = U28_COMMAND_CARD_SCENES['command-card'];
    render(<Scene />);

    const runs = screen.getAllByRole('button', { name: 'Run in terminal' });
    fireEvent.click(runs[runs.length - 1]!);

    const tab = Object.values(useAppStore.getState().terminalTabs).flat()[0];
    expect(tab?.cwd).toBe('/mock/northwind/payments-api-settlement');
    expect(tab?.prefill).toBe(
      '\u001B[200~pnpm --filter payments-api migrate:up\npnpm --filter payments-api test -- --run settlement\u001B[201~',
    );
  });
});
