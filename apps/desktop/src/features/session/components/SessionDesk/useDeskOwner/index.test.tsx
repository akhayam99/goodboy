// @vitest-environment happy-dom

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
  }),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { worktreeStatusOf } from '../../../../../test/worktreeStatusOf';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { ledgerCore, mountOf, sessionOf } from '../../../../workspace/testing/sessionColumn';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { SessionFace } from '../SessionFace';
import { toggleRailTool } from '../../SessionTools/toggleRailTool';
import type { RailToolId } from '../../SessionTools/sessionTools';
import { applyDeskHold } from './applyDeskHold';
import { deskLines } from './deskLines';

const session = sessionOf({ goal: 'Reconcile the ledger export' });

type HoldArgs = {
  readonly sessionId: string;
  readonly isTaken: boolean;
};

let store: StoryStore;
let holder: string | null = null;
let isHoldBroken = false;
const stops: Array<() => void> = [];

const holdFor = ({ sessionId, isTaken }: HoldArgs) => {
  if (isHoldBroken) {
    throw new Error('the window bridge did not answer');
  }
  if (holder === null || holder === 'main' || isTaken) {
    holder = 'main';
  }
  return { sessionId, holder };
};

const holderFor = ({ sessionId }: HoldArgs) => ({ sessionId, holder });

const releaseHold = () => {
  holder = holder === 'main' ? null : holder;
  return null;
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  deskLines.reset();
  holder = null;
  isHoldBroken = false;
  stubStoryInvoke({
    worktree_status: () => worktreeStatusOf({}),
    worktree_remote_url: () => 'git@github.com:harborline/ledger-core.git',
    desk_hold: holdFor,
    desk_holder: holderFor,
    desk_release: releaseHold,
  });
  store.setState({
    currentWorkspaceId: session.workspaceId,
    sessions: [session],
    sessionProjectMounts: { [session.id]: [mountOf({ session, project: ledgerCore })] },
    setCurrentSession: async (id: SessionId | null) => {
      store.setState({ currentSessionId: id });
    },
  });
  await act(async () => {
    store.getState().navigate({ to: sessionPlace({ sessionId: session.id }) });
  });
  Reflect.set(window, '__TAURI_INTERNALS__', { metadata: { currentWindow: { label: 'main' } } });
});

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.();
  }
  cleanup();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  document.body.innerHTML = '';
});

const renderFace = () =>
  render(
    <ToastProvider>
      <SessionFace session={session} />
    </ToastProvider>,
  );

const face = () => store.getState().sessionFace[session.id] ?? 'overview';

const tick = async (): Promise<void> => {
  await act(async () => {
    for (let round = 0; round < 8; round += 1) {
      await Promise.resolve();
    }
  });
};

type ToolParams = {
  readonly pane: RailToolId;
};

const openTool = async ({ pane }: ToolParams): Promise<void> => {
  act(() => {
    toggleRailTool({ pane, sessionId: session.id });
  });
  await tick();
};

const otherWindowHolds = (): void => {
  holder = 'win-2';
};

describe('one Desk per session, in one window', () => {
  it('holds the Desk in the window that opens it first', async () => {
    renderFace();

    await openTool({ pane: 'terminal' });

    expect(face()).toBe('desk');
    expect(holder).toBe('main');
  });

  it('opens the overview with Desk open in another window when the other window holds it', async () => {
    otherWindowHolds();
    renderFace();

    await openTool({ pane: 'terminal' });

    expect(face()).toBe('overview');
    screen.getByText('Desk open in another window');
    screen.getByRole('button', { name: 'Bring it here' });
    expect(screen.queryByRole('complementary', { name: 'Desk' })).toBeNull();
  });

  it('keeps the page whole when this window already knows the other window holds the Desk', async () => {
    otherWindowHolds();
    deskLines.noteHolder({ sessionId: session.id, holder: 'win-2' });
    renderFace();

    await openTool({ pane: 'terminal' });

    expect(face()).toBe('overview');
    screen.getByText('Desk open in another window');
    expect(screen.queryByRole('complementary', { name: 'Desk' })).toBeNull();
  });

  it('answers a second tool with the same line instead of a second Desk', async () => {
    otherWindowHolds();
    renderFace();
    await openTool({ pane: 'terminal' });

    await openTool({ pane: 'scripts' });

    expect(face()).toBe('overview');
    expect(screen.getAllByText('Desk open in another window')).toHaveLength(1);
  });

  it('Bring it here takes the Desk into this window', async () => {
    otherWindowHolds();
    renderFace();
    await openTool({ pane: 'terminal' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Bring it here' }));
    });
    await tick();

    expect(holder).toBe('main');
    expect(face()).toBe('desk');
    expect(screen.queryByText('Desk open in another window')).toBeNull();
  });

  it('says Desk moved to another window in the page when the other window takes it, and Bring the Desk back returns it', async () => {
    renderFace();
    await openTool({ pane: 'terminal' });

    await act(async () => {
      otherWindowHolds();
      applyDeskHold({ hold: { sessionId: session.id, holder: 'win-2' }, line: 'moved' });
    });

    expect(face()).toBe('overview');
    screen.getByText('Desk moved to another window');

    await openTool({ pane: 'scripts' });
    expect(face()).toBe('overview');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Bring the Desk back' }));
    });
    await tick();

    expect(holder).toBe('main');
    expect(face()).toBe('desk');
    expect(screen.queryByText('Desk moved to another window')).toBeNull();
  });

  it('frees the Desk when the other window closes or stops answering', async () => {
    otherWindowHolds();
    renderFace();
    await openTool({ pane: 'terminal' });

    await act(async () => {
      holder = null;
      applyDeskHold({ hold: { sessionId: session.id, holder: null }, line: 'moved' });
    });
    await openTool({ pane: 'scripts' });

    expect(screen.queryByText('Desk open in another window')).toBeNull();
    expect(face()).toBe('desk');
  });

  it('goes back to the overview with Retry when the first hold check fails, and the retry opens the Desk', async () => {
    const reportError = vi.fn();
    store.setState({ reportError });
    isHoldBroken = true;
    renderFace();

    await openTool({ pane: 'terminal' });

    expect(face()).toBe('overview');
    expect(holder).toBeNull();
    expect(reportError).toHaveBeenCalledTimes(1);
    const [report] = reportError.mock.calls[0] ?? [];

    isHoldBroken = false;
    let isRetried = false;
    await act(async () => {
      isRetried = await report.retry();
    });
    await tick();

    expect(isRetried).toBe(true);
    expect(face()).toBe('desk');
    expect(holder).toBe('main');
  });

  it('keeps the line and offers Retry when Bring it here fails, and the retry takes the Desk', async () => {
    const reportError = vi.fn();
    store.setState({ reportError });
    otherWindowHolds();
    renderFace();
    await openTool({ pane: 'terminal' });
    isHoldBroken = true;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Bring it here' }));
    });
    await tick();

    expect(face()).toBe('overview');
    screen.getByText('Desk open in another window');
    expect(reportError).toHaveBeenCalledTimes(1);
    const [report] = reportError.mock.calls[0] ?? [];

    isHoldBroken = false;
    let isRetried = false;
    await act(async () => {
      isRetried = await report.retry();
    });
    await tick();

    expect(isRetried).toBe(true);
    expect(face()).toBe('desk');
  });
});
