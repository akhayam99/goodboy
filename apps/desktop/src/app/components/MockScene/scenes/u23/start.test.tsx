// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U23_START_SCENES } from './start';
import { startInboxIpc } from './StartInboxScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  window.history.replaceState(null, '', '/');
});

afterEach(cleanup);

type SceneName = keyof typeof U23_START_SCENES;

const draw = ({ name }: { readonly name: SceneName }) => {
  const Scene = U23_START_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the start scenes', () => {
  it('registers the four scenes left after one flow unit 5', () => {
    expect(Object.keys(U23_START_SCENES).sort()).toEqual([
      'start-from-inbox',
      'start-panel-slack',
      'start-pick-one-block',
      'start-review-row',
    ]);
  });

  it('shows the picked issue above the task, asks the kind, and has no issue search', async () => {
    draw({ name: 'start-pick-one-block' });

    const picked = await screen.findByRole('list', { name: 'Picked issues' });
    expect(picked.textContent).toContain('HBL-412');
    expect(screen.getByRole('textbox', { name: 'Goal' })).toBeDefined();
    expect(screen.getByRole('tablist', { name: 'What kind of run?' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Runs as/ })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Search issues' })).toBeNull();
  });

  it('starts an Inbox issue with Start session, the key at the left', async () => {
    draw({ name: 'start-from-inbox' });

    expect(await screen.findByRole('button', { name: 'Start session' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Launch session/ })).toBeNull();
  });

  it('reviews a pull request that waits on you instead of starting from it', async () => {
    draw({ name: 'start-review-row' });

    expect(await screen.findByRole('button', { name: /Review pull request/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Start from #318/ })).toBeNull();
  });

  it('reads the conversation of the pull request row without an error', async () => {
    vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) =>
      startInboxIpc({ command, payload: args }),
    );
    draw({ name: 'start-review-row' });

    expect(await screen.findByText('No comments yet')).toBeDefined();
    expect(screen.queryByText("Couldn't load the conversation")).toBeNull();
  });

  it('keeps the one-step panel for a Slack thread, with the same verb', async () => {
    draw({ name: 'start-panel-slack' });

    const panel = await screen.findByRole('region', { name: 'Start from #payments-alerts' });
    expect(
      within(panel).getByRole('button', { name: /Start from #payments-alerts/ }),
    ).toBeDefined();
    expect(within(panel).getByRole('textbox', { name: 'Session goal' })).toBeDefined();
  });
});
