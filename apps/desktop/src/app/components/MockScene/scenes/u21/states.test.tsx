// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U21_STATES_SCENES } from './states';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const SCENE_IDS = [
  'runs-list-empty',
  'agents-list-empty',
  'artifacts-empty',
  'artifacts-no-match',
  'scripts-empty',
  'questions-empty',
  'activity-empty',
  'notifications-empty',
  'inbox-empty',
  'inbox-error',
  'needs-you-card',
] as const;

const renderScene = (id: (typeof SCENE_IDS)[number]) => {
  const Scene = U21_STATES_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u21 page-state scenes', () => {
  it('registers exactly the scenes the plan names', () => {
    expect(Object.keys(U21_STATES_SCENES).sort()).toEqual([...SCENE_IDS].sort());
  });

  it('shows the Runs first-time state with its one primary', async () => {
    renderScene('runs-list-empty');

    expect(await screen.findByRole('heading', { level: 2, name: 'No runs yet' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start a run' })).toBeDefined();
  });

  it('shows the Agents first-time state as one line and the header Start agent', async () => {
    renderScene('agents-list-empty');

    expect(await screen.findByText('No agents in this session yet.')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Start agent' })).toHaveLength(1);
  });

  it('shows the Artifacts first-time state', async () => {
    renderScene('artifacts-empty');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'No artifacts yet' }),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'New artifact' })).toBeNull();
    expect(screen.getByTestId('artifact-new')).toBeDefined();
  });

  it('shows Artifacts filtered to nothing and clears the filter', async () => {
    renderScene('artifacts-no-match');

    expect(await screen.findByText('No plans in this session.')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'No artifacts yet' })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    });

    expect(screen.queryByText('No plans in this session.')).toBeNull();
    expect(await screen.findByTestId('artifact-list')).toBeDefined();
  });

  it('shows the Scripts first-time state with its one primary', async () => {
    renderScene('scripts-empty');

    expect(await screen.findByRole('heading', { level: 3, name: 'No scripts yet' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add project' })).toBeDefined();
  });

  it('shows the Questions first-time state', async () => {
    renderScene('questions-empty');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'No questions yet' }),
    ).toBeDefined();
  });

  it('shows Activity with no runs or agents and points to the log that holds the branch facts', async () => {
    renderScene('activity-empty');

    expect(await screen.findByText('Nothing ran yet')).toBeDefined();
    expect(screen.queryByText('Nothing yet')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Log' }));
    });

    expect(screen.queryByText('Nothing ran yet')).toBeNull();
    expect(screen.queryByText('No log entries yet')).toBeNull();
  });

  it('opens the notifications popover on one line with no tabs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderScene('notifications-empty');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    vi.useRealTimers();

    expect(await screen.findByText('No notifications yet')).toBeDefined();
    expect(screen.queryByRole('tab', { name: 'All' })).toBeNull();
  });

  it('shows the Tasks first-time state', async () => {
    renderScene('inbox-empty');

    expect(await screen.findByRole('heading', { level: 2, name: 'No items yet' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the Tasks load failure as one gray line in its source group that retries', async () => {
    renderScene('inbox-error');

    expect(
      await screen.findByText("Sentry didn't load: The token was refused (401)."),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Sentry' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'No items yet' })).toBeNull();
  });

  it('draws the Needs you card for two owners, one Open each', async () => {
    renderScene('needs-you-card');

    const card = await screen.findByRole('region', { name: 'Needs you' });
    expect(within(card).getAllByRole('button')).toHaveLength(2);
    expect(within(card).queryByTestId('tone-bar')).toBeNull();
  });
});
