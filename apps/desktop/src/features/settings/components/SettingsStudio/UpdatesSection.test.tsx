// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSetting } from '@goodboy/db';
import type { AppState } from '../../../../store/types';
import { clearMocks } from '@tauri-apps/api/mocks';
import { installSceneDatabase } from '../../../../app/components/MockScene/scenes/sceneDatabase';
import { tauriDatabase } from '../../../../shared/lib/db';
import { APP_VERSION } from '../../../../shared/lib/appVersion';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SETTING_UPDATER_AUTO_DOWNLOAD } from '../../settings';
import { checkedLine } from '../../../updater/checkedLine';
import { UpdatesSection } from './UpdatesSection';

const ONE_RUNNING: AppState['agentTurnState'] = JSON.parse(
  JSON.stringify({
    'agent-1': { kind: 'running', runId: 'run-1', startedAt: '2026-10-17T09:12:00.000Z' },
  }),
);

let useAppStore: StoryStore;

const actions = {
  checkForUpdates: vi.fn(async () => undefined),
  applyUpdate: vi.fn(async () => undefined),
  downloadUpdate: vi.fn(async () => undefined),
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  installSceneDatabase();
  useAppStore.setState({ ...actions });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.clearAllMocks();
});

describe('checkedLine', () => {
  it('says when Goodboy last looked and whether this is the latest version', () => {
    expect(checkedLine({ status: 'idle', failure: null, checkedAt: null, now: 0 })).toBe(
      'Not checked yet. Goodboy looks for a new version every hour.',
    );
    expect(
      checkedLine({
        status: 'uptodate',
        failure: null,
        checkedAt: '2026-09-23T10:00:00.000Z',
        now: Date.parse('2026-09-23T10:03:00.000Z'),
      }),
    ).toBe('Checked 3m ago. You have the latest version.');
    expect(
      checkedLine({
        status: 'error',
        failure: { phase: 'check', message: 'offline' },
        checkedAt: null,
        now: 0,
      }),
    ).toBe("Couldn't check for updates: offline");
  });
});

describe('UpdatesSection', () => {
  it('names the installed version and checks for updates on request', () => {
    render(<UpdatesSection />);

    screen.getByText(`Goodboy ${APP_VERSION}`);
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));

    expect(actions.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('keeps Check for updates busy while a check runs', () => {
    useAppStore.setState({ updaterStatus: 'checking' });
    render(<UpdatesSection />);

    expect(screen.getByRole('button', { name: 'Checking' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows a failed check as a status and keeps Check for updates', () => {
    useAppStore.setState({
      updaterStatus: 'error',
      updateFailure: { phase: 'check', message: 'offline' },
    });
    render(<UpdatesSection />);

    expect(screen.getByRole('status').textContent).toBe("Couldn't check for updates: offline");
    screen.getByRole('button', { name: 'Check for updates' });
  });

  it('offers the card verbs once a version is available: Update now downloads', () => {
    useAppStore.setState({ updaterStatus: 'available', updateVersion: '0.27.9' });
    render(<UpdatesSection />);

    screen.getByText('Goodboy 0.27.9 is available');
    expect(screen.queryByRole('button', { name: 'Check for updates' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));

    expect(actions.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(actions.applyUpdate).not.toHaveBeenCalled();
  });

  it('asks the same question as the card while agents run', () => {
    useAppStore.setState({
      updaterStatus: 'ready',
      updateVersion: '0.27.9',
      agentTurnState: ONE_RUNNING,
    });
    render(<UpdatesSection />);

    screen.getByText('Goodboy 0.27.9 is ready');
    screen.getByText('1 agent is running. A restart now picks them up where they stopped.');
    fireEvent.click(screen.getByRole('button', { name: 'Restart when they finish' }));

    expect(useAppStore.getState().updateQueuedUntilIdle).toBe(true);
    expect(actions.applyUpdate).not.toHaveBeenCalled();
  });

  it('turns background downloads off and saves the setting', async () => {
    render(<UpdatesSection />);

    const toggle = await screen.findByRole('switch', {
      name: 'Download updates in the background',
    });
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(toggle);

    await waitFor(async () =>
      expect(await getSetting(tauriDatabase, SETTING_UPDATER_AUTO_DOWNLOAD)).toBe('false'),
    );
  });
});
