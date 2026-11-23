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
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
import { currentStack } from '../../../../../store/slices/navigation/currentStack';
import { registerShortcut } from '../../../../../shared/keyboard/dispatcher';
import { pressShortcut } from '../../../../../__tests__/helpers/pressKey';
import { ledgerCore, mountOf, sessionOf } from '../../../../workspace/testing/sessionColumn';
import { SessionPageTabs } from '../../../../../app/components/SessionPageTabs';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { toggleTerminalDock } from '../../../../terminal/toggleTerminalDock';
import { closeCurrentLevel } from '../../../../../app/hooks/useAppShortcuts/closeCurrentLevel';
import { applyDeskHold } from '../useDeskOwner/applyDeskHold';
import { deskLines } from '../useDeskOwner/deskLines';
import { deskToolsOf } from '../deskToolsOf';
import { isFaceShown } from '../isFaceShown';
import { SessionFace } from '../SessionFace';
import { switchSessionFace } from '../switchSessionFace';
import { toggleCurrentFace } from '../toggleCurrentFace';

const session = sessionOf({ goal: 'Reconcile the ledger export' });

let store: StoryStore;
const stops: Array<() => void> = [];

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  deskLines.reset();
  stubStoryInvoke({
    worktree_status: () => worktreeStatusOf({}),
    worktree_remote_url: () => 'git@github.com:harborline/ledger-core.git',
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
  stops.push(registerShortcut('session.desk', toggleCurrentFace, { canDecline: true }));
});

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.();
  }
  cleanup();
  document.body.innerHTML = '';
});

const renderFace = () =>
  render(
    <ToastProvider>
      <SessionPageTabs session={session} />
      <SessionFace session={session} />
    </ToastProvider>,
  );

const face = () => store.getState().sessionFace[session.id] ?? 'overview';

const tools = () => deskToolsOf({ state: store.getState() });

const entries = () => currentStack(store.getState()).entries.length;

const tick = async (): Promise<void> => {
  await act(async () => {
    for (let round = 0; round < 8; round += 1) {
      await Promise.resolve();
    }
  });
};

const openDesk = async (): Promise<void> => {
  act(() => {
    pressShortcut({ id: 'session.desk' });
  });
  await tick();
};

const closeEveryTool = async (): Promise<void> => {
  await act(async () => {
    tools().forEach((entry) => store.getState().closeDrawerEntry({ entry }));
  });
  await tick();
};

describe('entering the Desk', () => {
  it('opens a tool at once, the terminal of the first project when nothing was kept', async () => {
    renderFace();

    await openDesk();

    expect(face()).toBe('desk');
    expect(tools().map((entry) => entry.kind)).toEqual(['terminal']);
  });

  it('brings back a Desk saved with no tool as the overview, with no line', async () => {
    await act(async () => {
      store.setState({ sessionFace: { [session.id]: 'desk' } });
    });
    renderFace();
    await tick();

    expect(face()).toBe('overview');
    expect(screen.queryByText('Desk closed')).toBeNull();
  });

  it('stays off with the reason when there is nothing to open', async () => {
    await act(async () => {
      store.setState({ sessionProjectMounts: { [session.id]: [] }, projects: [] });
    });
    renderFace();
    const control = screen.getByRole('tablist', { name: 'Overview or Desk' });
    const desk = within(control).getByRole('tab', { name: 'Desk' });

    expect(desk.hasAttribute('disabled')).toBe(true);
    await openDesk();
    expect(face()).toBe('overview');
    expect(tools()).toEqual([]);
  });
});

describe('closing the last tool', () => {
  it('closes the Desk with Desk closed and Reopen, and no history entry', async () => {
    renderFace();
    await openDesk();
    const before = entries();

    await closeEveryTool();

    expect(face()).toBe('overview');
    screen.getByText('Desk closed');
    screen.getByRole('button', { name: 'Reopen' });
    expect(entries()).toBe(before);
  });

  it('Reopen finds the tools as they were', async () => {
    renderFace();
    await openDesk();
    const kept = tools();
    await closeEveryTool();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    });
    await tick();

    expect(face()).toBe('desk');
    expect(tools()).toEqual(kept);
    expect(screen.queryByText('Desk closed')).toBeNull();
  });

  it('cmd w closes one tool at a time and the last one closes the Desk, never the session', async () => {
    renderFace();
    await openDesk();
    const before = entries();

    await act(async () => {
      closeCurrentLevel({});
    });
    await tick();

    expect(face()).toBe('overview');
    screen.getByText('Desk closed');
    expect(entries()).toBe(before);
    expect(store.getState().currentSessionId).toBe(session.id);
  });

  it('the key finds the tools too, and the line goes', async () => {
    renderFace();
    await openDesk();
    await closeEveryTool();

    await openDesk();

    expect(face()).toBe('desk');
    expect(tools().map((entry) => entry.kind)).toEqual(['terminal']);
    expect(screen.queryByText('Desk closed')).toBeNull();
  });
});

type Step = {
  readonly name: string;
  readonly run: () => void | Promise<void>;
};

type SeedParams = {
  readonly seed: number;
};

const randomOf = ({ seed }: SeedParams) => {
  let value = seed;
  return (): number => {
    value = (value * 1_103_515_245 + 12_345) % 2_147_483_648;
    return value / 2_147_483_648;
  };
};

const STEPS: ReadonlyArray<Step> = [
  { name: 'cmd j', run: () => void pressShortcut({ id: 'session.desk' }) },
  { name: 'desk', run: () => switchSessionFace({ sessionId: session.id, face: 'desk' }) },
  { name: 'overview', run: () => switchSessionFace({ sessionId: session.id, face: 'overview' }) },
  { name: 'open terminal', run: () => toggleTerminalDock({ isToggle: false }) },
  {
    name: 'close one tool',
    run: () => {
      const [first] = tools();
      if (first !== undefined) {
        store.getState().closeDrawerEntry({ entry: first });
      }
    },
  },
  { name: 'cmd w', run: () => closeCurrentLevel({}) },
  { name: 'back', run: () => store.getState().back() },
  { name: 'forward', run: () => store.getState().forward() },
  {
    name: 'reload',
    run: () => {
      store.setState({ sessionFace: { [session.id]: face() } });
    },
  },
  {
    name: 'other window takes it',
    run: () => applyDeskHold({ hold: { sessionId: session.id, holder: 'win-2' }, line: 'moved' }),
  },
  {
    name: 'other window closes',
    run: () => applyDeskHold({ hold: { sessionId: session.id, holder: null }, line: 'moved' }),
  },
];

describe('a seeded walk through the session', () => {
  it('always ends on the overview or on a Desk with at least one tool', async () => {
    renderFace();
    const random = randomOf({ seed: 4_242 });
    const walked: Array<string> = [];
    let deskVisits = 0;

    for (let index = 0; index < 160; index += 1) {
      const step = STEPS[Math.floor(random() * STEPS.length)];
      if (step === undefined) {
        continue;
      }
      walked.push(step.name);
      await act(async () => {
        await step.run();
      });
      await tick();
      const state = store.getState();
      const isDeskShown = isFaceShown({ state, sessionId: session.id }) && face() === 'desk';

      expect(
        isDeskShown && tools().length === 0,
        JSON.stringify({
          tail: walked.slice(-4),
          grid: state.drawerGrid,
          drawer: state.drawer,
          back: state.drawerBack,
          kept: deskLines.keptOf({ sessionId: session.id }),
          current: state.currentSessionId,
        }),
      ).toBe(false);
      deskVisits += isDeskShown ? 1 : 0;
    }

    expect(deskVisits).toBeGreaterThan(5);
  });
});
