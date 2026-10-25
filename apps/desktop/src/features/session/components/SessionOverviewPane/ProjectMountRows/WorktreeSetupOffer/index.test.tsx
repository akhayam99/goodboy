// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type MountId } from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { WorktreeSetupOffer } from './index';

const SESSION = aSession({ workspaceId: aWorkspace({}).id }).id;
const MOUNT = brandId<MountId>({ value: 'mount-payments' });
const KEY = 'worktree.setup-offer.mount-payments';
const PATH = '/repos/payments-api/.goodboy/worktrees/retry-webhook';

const offerJson = (patch: Record<string, unknown> = {}): string =>
  JSON.stringify({ command: 'pnpm install', carried: 2, skipped: 0, state: 'offered', ...patch });

const runDiscoveredScript = vi.fn();
const saveSetting = vi.fn(async () => undefined);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const offered = (patch: Record<string, unknown> = {}) =>
  useAppStore.setState({ settings: { [KEY]: offerJson(patch) } });

const show = () =>
  render(
    <WorktreeSetupOffer
      sessionId={SESSION}
      mountId={MOUNT}
      worktreePath={PATH}
      projectName="payments-api"
      branch="retry-webhook"
    />,
  );

beforeEach(async () => {
  await resetStoryStore();
  vi.clearAllMocks();
  runDiscoveredScript.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
  useAppStore.setState({
    settings: { [KEY]: offerJson() },
    scriptRuns: {},
    loadSetting: async () => null,
    saveSetting,
    runDiscoveredScript,
  });
});

afterEach(cleanup);

describe('WorktreeSetupOffer', () => {
  it('shows what was copied and the proposed command, and runs nothing by itself', () => {
    show();

    screen.getByText('Worktree payments-api/retry-webhook is ready.');
    screen.getByText('Copied 2 files. Setup proposed: pnpm install.');
    screen.getByRole('button', { name: 'Run' });
    expect(runDiscoveredScript).not.toHaveBeenCalled();
  });

  it('runs the command in the worktree only on the click, then says it finished', async () => {
    show();

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() =>
      expect(runDiscoveredScript).toHaveBeenCalledWith({
        sessionId: SESSION,
        scriptId: 'setup:mount-payments',
        name: 'Setup',
        command: 'pnpm install',
        cwd: PATH,
        mountId: MOUNT,
      }),
    );
    await waitFor(() =>
      expect(saveSetting).toHaveBeenCalledWith(KEY, expect.stringContaining('"done"')),
    );
  });

  it('offers a retry with the last line of the failure and keeps the offer open', async () => {
    runDiscoveredScript.mockResolvedValue({
      stdout: '',
      stderr: 'ERR_PNPM_NO_LOCKFILE',
      exitCode: 1,
    });
    useAppStore.setState({
      scriptRuns: {
        [SESSION]: {
          'setup:mount-payments': {
            status: 'error',
            result: { stdout: '', stderr: 'resolving\nERR_PNPM_NO_LOCKFILE', exitCode: 1 },
            runId: 'run-1',
            startedAt: 1,
          },
        },
      },
    });
    show();

    screen.getByText('Setup failed: pnpm install');
    screen.getByText('ERR_PNPM_NO_LOCKFILE');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(runDiscoveredScript).toHaveBeenCalledTimes(1));
    expect(saveSetting).not.toHaveBeenCalled();
  });

  it('puts Not now away without running anything', async () => {
    show();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    await waitFor(() =>
      expect(saveSetting).toHaveBeenCalledWith(KEY, expect.stringContaining('"dismissed"')),
    );
    expect(runDiscoveredScript).not.toHaveBeenCalled();
  });

  it('says nothing for a dismissed offer, and only reports the copy when there is no command', () => {
    offered({ state: 'dismissed' });
    const { unmount } = show();
    expect(screen.queryByRole('status')).toBeNull();
    unmount();

    offered({ command: null, skipped: 1 });
    show();

    screen.getByText('Copied 2 files. 1 file left where they were.');
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
    screen.getByRole('button', { name: 'Dismiss' });
  });

  it('shows the running line while the command runs', () => {
    useAppStore.setState({
      scriptRuns: {
        [SESSION]: {
          'setup:mount-payments': { status: 'pending', result: null, runId: 'run-1', startedAt: 1 },
        },
      },
    });

    show();

    screen.getByText('Running pnpm install…');
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
  });
});
