// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type MountId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { dispatchWindowEvent } from '../../../../shared/lib/dispatchWindowEvent';
import type { ScriptRunRecord } from '../../scripts';
import { mountFixture } from '../../../../__tests__/helpers/actionFixtures';
import { ScriptEndToastBridge } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const SESSION_ID = nextSessionId();
const OTHER_SESSION_ID = nextSessionId();
const MOUNT_ID = brandId<MountId>({ value: 'mount-ledger' });
const KEY = 'drift';

const failed: ScriptRunRecord = {
  status: 'error',
  result: { stdout: 'FAIL postings', stderr: '', exitCode: 1 },
  runId: 'run-1',
  startedAt: 1,
  name: 'Check posting drift',
  mountId: MOUNT_ID,
};

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    currentSessionId: OTHER_SESSION_ID,
    scriptRuns: { [SESSION_ID]: { [KEY]: failed } },
    sessionProjectMounts: {
      [SESSION_ID]: [mountFixture({ mountId: MOUNT_ID, mountName: 'ledger-core' })],
    },
  });
});

afterEach(cleanup);

const mount = () =>
  render(
    <ToastProvider>
      <ScriptEndToastBridge />
    </ToastProvider>,
  );

const end = ({ runId = 'run-1' }: { readonly runId?: string } = {}) =>
  act(() => {
    dispatchWindowEvent({
      name: 'goodboy:script-ended',
      detail: { sessionId: SESSION_ID, scriptKey: KEY, runId },
    });
  });

describe('ScriptEndToastBridge', () => {
  it('raises one toast naming the script and the project when a script ends off screen', () => {
    mount();

    end();

    expect(screen.getAllByText('Check posting drift failed in ledger-core')).toHaveLength(1);
    screen.getByRole('button', { name: 'Open output' });
  });

  it('raises a toast once for a run, even if it is announced twice', () => {
    mount();

    end();
    end();

    expect(screen.getAllByText('Check posting drift failed in ledger-core')).toHaveLength(1);
  });

  it('opens the session and the output from the toast', () => {
    const navigate = vi.fn<StoreState['navigate']>();
    useAppStore.setState({ navigate });
    mount();
    end();

    fireEvent.click(screen.getByRole('button', { name: 'Open output' }));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().drawer).toEqual({
      kind: 'scriptRun',
      sessionId: SESSION_ID,
      payload: { scriptKey: KEY, mountId: MOUNT_ID },
    });
  });

  it('stays quiet for the session on screen', () => {
    useAppStore.setState({ currentSessionId: SESSION_ID });
    mount();

    end();

    expect(screen.queryByText(/Check posting drift/)).toBeNull();
  });

  it('stays quiet for a run that is no longer the latest', () => {
    mount();

    end({ runId: 'run-0' });

    expect(screen.queryByText(/Check posting drift/)).toBeNull();
  });

  it('stays quiet for an announcement it cannot read', () => {
    mount();

    act(() => {
      window.dispatchEvent(new CustomEvent('goodboy:script-ended', { detail: { runId: 'run-1' } }));
    });

    expect(screen.queryByText(/Check posting drift/)).toBeNull();
  });
});
