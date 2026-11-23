// @vitest-environment happy-dom

const suggested = vi.hoisted(() => {
  const moves: ReadonlyArray<unknown> = [];
  return { moves };
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock({
    listNudgeEvents: async () => [],
    listArtifactComments: async () => [],
    deleteNudgeEvent: async () => undefined,
  }),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../../suggestions/useSessionSuggestions', () => ({
  useSessionSuggestions: () => suggested.moves,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TerminalTab, TerminalTabId } from '../../../../../shared/types/terminal';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { worktreeStatusOf } from '../../../../../test/worktreeStatusOf';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { brandedId } from '../../../../history/testing/brandedId';
import type { NextMove } from '../../../../suggestions/types';
import {
  harborline,
  mountOf,
  notifyRelay,
  sessionOf,
} from '../../../../workspace/testing/sessionColumn';
import { TerminalCommandSuggestion } from '.';

const session = sessionOf({ goal: 'Retry the webhook' });

const relay = mountOf({ session, project: notifyRelay });

const TAB: TerminalTab = {
  id: brandedId<TerminalTabId>({ value: `${session.id}::t1` }),
  owner: { kind: 'session', sessionId: session.id },
  title: 'notify-relay',
  cwd: relay.worktreePath,
  mountId: relay.mountId,
  status: 'running',
  createdAt: 0,
};

const COMMAND = "pnpm test -- 'retries the webhook'";

const FAILING_TEST: NextMove = {
  id: 'run-failing-test:relay',
  kind: 'run-failing-test',
  priority: 40,
  band: 1,
  title: 'Run the failing test',
  sessionId: session.id,
  targetKey: null,
  fingerprint: 'run-failing-test:relay:unit',
  reason: 'unit failed on #96',
  evidence: [],
  place: { tool: 'terminal', mountId: relay.mountId, agentId: null },
  completesWhen: { kind: 'check-passes', mountId: relay.mountId, checkName: 'unit' },
  group: 'advance',
  read: null,
  payload: {
    mountId: relay.mountId,
    prNumber: 96,
    checkName: 'unit',
    detailsUrl: 'https://github.com/harborline/notify-relay/actions/runs/7',
    testName: 'retries the webhook',
    command: { text: COMMAND, cwd: relay.worktreePath, mode: 'type', scriptId: null },
  },
};

let store: StoryStore;
let writeFailures = 0;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  suggested.moves = [FAILING_TEST];
  writeFailures = 0;
  stubStoryInvoke({
    terminal_write: () => {
      if (writeFailures > 0) {
        writeFailures -= 1;
        throw new Error('The shell is gone');
      }
      return null;
    },
    worktree_status: () => worktreeStatusOf({}),
  });
  store.setState({
    workspaces: [harborline],
    currentWorkspaceId: harborline.id,
    sessions: [session],
    sessionProjectMounts: { [session.id]: [relay] },
    terminalTabs: { [session.id]: [TAB] },
  });
});

afterEach(() => {
  cleanup();
});

const renderStrip = () =>
  render(
    <ToastProvider>
      <TerminalCommandSuggestion
        session={session}
        mountId={relay.mountId}
        tab={TAB}
        isTabBusy={false}
      />
    </ToastProvider>,
  );

const writes = () =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === 'terminal_write')
    .map(([, args]) => args);

describe('the command strip of a terminal', () => {
  it('shows the whole command and its folder, and types it here to wait for Enter', async () => {
    renderStrip();

    screen.getByText(COMMAND);
    screen.getByText('Run the failing test');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add to prompt' }));
    });

    expect(writes()).toEqual([{ sessionId: TAB.id, data: btoa(COMMAND) }]);
    screen.getByText('Press Enter to run');
    expect(screen.queryByRole('button', { name: 'Add to prompt' })).toBeNull();
  });

  it('keeps the strip and says why when the shell refuses, and Retry types it', async () => {
    writeFailures = 1;
    renderStrip();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add to prompt' }));
    });

    expect((await screen.findByRole('alert')).textContent).toContain('The shell is gone');
    expect(screen.queryByText('Press Enter to run')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add to prompt' }));
    });

    expect(writes()).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
    screen.getByText('Press Enter to run');
  });

  it('puts the command off with Not now, and Undo brings it back', async () => {
    renderStrip();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    });

    expect(screen.queryByText(COMMAND)).toBeNull();

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Undo/ }));
    });

    await waitFor(() => screen.getByText(COMMAND));
  });
});
