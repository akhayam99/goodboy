// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listNudgeEvents: vi.fn(async () => []),
  }),
);
vi.mock('../../useSessionSuggestions', () => ({
  useSessionSuggestions: () => suggestionState.list,
}));
vi.mock('../../useNextStepOutcomes', () => ({
  recordNextStepOutcome: outcomes.record,
  revertNextStepOutcome: vi.fn(async () => undefined),
}));

type SuggestionState = {
  list: ReadonlyArray<SessionSuggestion>;
};

const suggestionState = vi.hoisted((): SuggestionState => ({ list: [] }));
const outcomes = vi.hoisted(() => ({ record: vi.fn(async () => null) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type MountId,
  type ProjectId,
  type SessionId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import type { SessionSuggestion } from '../../types';
import { NextStepSlot } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  suggestionState.list = [];
  outcomes.record.mockClear();
});

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const SESSION = aSession({ id: SESSION_ID });

const SHARED_SUGGESTION = {
  priority: 40,
  band: 3,
  sessionId: SESSION_ID,
  targetKey: null,
} as const;

const CHECK_CHANGES: SessionSuggestion = {
  ...SHARED_SUGGESTION,
  id: 'check-changes:agent-ledger',
  kind: 'check-changes',
  title: 'Check the changes before you push',
  detail: 'The implementer finished the ledger export',
  fingerprint: 'check-changes:agent-ledger',
  payload: { agentId: brandId({ value: 'agent-ledger' }) },
};

const REBASE: SessionSuggestion = {
  ...SHARED_SUGGESTION,
  id: 'rebase-project:session-harborline',
  kind: 'rebase-project',
  title: 'Rebase ledger-core and notify-relay',
  fingerprint: 'rebase-project:session-harborline',
  payload: {
    targets: [
      {
        id: 'mount:ledger-core',
        mountId: brandId<MountId>({ value: 'mount-ledger-core' }),
        projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
        projectName: 'ledger-core',
        branch: 'feature/ledger-first',
        worktreePath: '/w/ledger-core',
        baseBranch: 'main',
        behind: 7,
        dirtyCount: 0,
      },
      {
        id: 'mount:notify-relay',
        mountId: brandId<MountId>({ value: 'mount-notify-relay' }),
        projectId: brandId<ProjectId>({ value: 'project-notify-relay' }),
        projectName: 'notify-relay',
        branch: 'feature/relay',
        worktreePath: '/w/notify-relay',
        baseBranch: 'main',
        behind: 3,
        dirtyCount: 0,
      },
    ],
  },
};

const PUSH: SessionSuggestion = {
  ...SHARED_SUGGESTION,
  id: 'push-branch:mount-ledger-core',
  kind: 'push-branch',
  title: '1 commit is ready to push',
  fingerprint: 'push-branch:mount-ledger-core',
  payload: {
    mountId: brandId<MountId>({ value: 'mount-ledger-core' }),
    projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
    projectName: 'ledger-core',
    branch: 'feature/ledger-first',
    worktreePath: '/w/ledger-core',
    state: 'ahead',
    ahead: 1,
    behind: 0,
  },
};

const spies = () => {
  const spawnAgent = vi.fn(async () => brandId<AgentId>({ value: 'agent-new' }));
  const openRewriteHistory = vi.fn();
  const openDrawer = vi.fn();
  const setNewDrawerAutoGoal = vi.fn();
  const reportError = vi.fn(async () => undefined);
  useAppStore.setState({
    sessions: [SESSION],
    spawnAgent,
    openRewriteHistory,
    openDrawer,
    setNewDrawerAutoGoal,
    reportError,
  });
  return { spawnAgent, openRewriteHistory, openDrawer, setNewDrawerAutoGoal, reportError };
};

type MountParams = {
  readonly isAutoOn: boolean;
  readonly suggestion: SessionSuggestion;
};

const mountSlot = ({ isAutoOn, suggestion }: MountParams) => {
  suggestionState.list = [suggestion];
  return render(
    <ToastProvider>
      <AutoReleaseContext.Provider value={isAutoOn}>
        <NextStepSlot session={SESSION} onSelectLens={vi.fn()} />
      </AutoReleaseContext.Provider>
    </ToastProvider>,
  );
};

const openMenu = (title: string) => {
  fireEvent.click(screen.getByRole('button', { name: `More options for ${title}` }));
  return screen.getByRole('menu');
};

const menuLabels = (menu: HTMLElement): ReadonlyArray<string> =>
  within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent ?? '');

const tileKind = (suggestion: SessionSuggestion) =>
  screen
    .getByTestId(`next-step-${suggestion.id}`)
    .querySelector('[data-column="tile"]')
    ?.getAttribute('data-agent-kind');

describe('the more menu of a Next card on the real store', () => {
  it('lists the other roles in order with what each does, then Talk it through with Auto', () => {
    spies();
    mountSlot({ isAutoOn: true, suggestion: CHECK_CHANGES });

    const menu = openMenu(CHECK_CHANGES.title);

    expect(menuLabels(menu)).toEqual([
      'Start tester insteadWrites tests for the changes',
      'Start implementer insteadMakes the changes itself',
      'Talk it through with Auto',
    ]);
  });

  it('keeps the other roles and drops Talk it through while the release gate is closed', () => {
    spies();
    mountSlot({ isAutoOn: false, suggestion: CHECK_CHANGES });

    const menu = openMenu(CHECK_CHANGES.title);

    expect(menuLabels(menu)).toEqual([
      'Start tester insteadWrites tests for the changes',
      'Start implementer insteadMakes the changes itself',
    ]);
  });

  it('starts the chosen role without a focus change, records it once and closes the menu', async () => {
    const { spawnAgent } = spies();
    mountSlot({ isAutoOn: false, suggestion: CHECK_CHANGES });
    openMenu(CHECK_CHANGES.title);

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Start implementer instead/ }));
    });

    expect(spawnAgent).toHaveBeenCalledTimes(1);
    expect(spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'implementer',
      focus: 'none',
    });
    expect(outcomes.record).toHaveBeenCalledTimes(1);
    expect(outcomes.record).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'check-changes',
      outcome: 'accepted',
      fingerprint: 'check-changes:agent-ledger',
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows the role of the hovered or focused item on the tile and gives the card role back', () => {
    spies();
    mountSlot({ isAutoOn: false, suggestion: CHECK_CHANGES });
    expect(tileKind(CHECK_CHANGES)).toBe('reviewer');
    openMenu(CHECK_CHANGES.title);

    const tester = screen.getByRole('menuitem', { name: /Start tester instead/ });
    fireEvent.mouseEnter(tester);
    expect(tileKind(CHECK_CHANGES)).toBe('tester');
    fireEvent.mouseLeave(tester);
    expect(tileKind(CHECK_CHANGES)).toBe('reviewer');

    fireEvent.focus(screen.getByRole('menuitem', { name: /Start implementer instead/ }));
    expect(tileKind(CHECK_CHANGES)).toBe('implementer');

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(tileKind(CHECK_CHANGES)).toBe('reviewer');
  });

  it('holds the primary and the menu while an alternative runs, then reports a failure once', async () => {
    const { spawnAgent, reportError } = spies();
    let fail: (error: Error) => void = () => undefined;
    spawnAgent.mockImplementationOnce(
      () =>
        new Promise<AgentId>((_resolve, reject) => {
          fail = reject;
        }),
    );
    mountSlot({ isAutoOn: false, suggestion: CHECK_CHANGES });
    openMenu(CHECK_CHANGES.title);

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Start tester instead/ }));
    });

    expect(
      screen.getByRole('button', { name: 'Start reviewer', hidden: true }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: `More options for ${CHECK_CHANGES.title}`, hidden: true })
        .hasAttribute('disabled'),
    ).toBe(true);
    await act(async () => {
      fail(new Error('provider unavailable'));
    });
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith({
      title: "Couldn't start the reviewer",
      error: new Error('provider unavailable'),
      sessionId: SESSION_ID,
    });
    expect(screen.getByRole('button', { name: 'Start reviewer' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('opens the Agent tab with the card as context from Talk it through, and starts nothing', () => {
    const { spawnAgent, openDrawer, setNewDrawerAutoGoal } = spies();
    mountSlot({ isAutoOn: true, suggestion: CHECK_CHANGES });
    openMenu(CHECK_CHANGES.title);

    fireEvent.click(screen.getByRole('menuitem', { name: /Talk it through with Auto/ }));

    expect(setNewDrawerAutoGoal).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      goal: expect.stringContaining(
        'Check the changes before you push\nThe implementer finished the ledger export',
      ),
    });
    expect(openDrawer).toHaveBeenCalledWith({
      kind: 'new',
      sessionId: SESSION_ID,
      payload: { form: 'auto' },
    });
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('offers one item per rebase target, named by project with branch and distance', () => {
    const { openRewriteHistory, spawnAgent } = spies();
    mountSlot({ isAutoOn: true, suggestion: REBASE });

    const menu = openMenu(REBASE.title);

    expect(menuLabels(menu)).toEqual([
      'ledger-corefeature/ledger-first, 7 behind',
      'notify-relayfeature/relay, 3 behind',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: /notify-relay/ }));
    expect(openRewriteHistory).toHaveBeenCalledWith(SESSION_ID, '/w/notify-relay');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('draws no menu for a card that starts no agent and has nothing else to offer', () => {
    spies();
    mountSlot({ isAutoOn: true, suggestion: PUSH });

    expect(screen.queryByRole('button', { name: /More options/ })).toBeNull();
    expect(
      screen.getByTestId(`next-step-${PUSH.id}`).querySelector('[data-column="menu"]'),
    ).not.toBeNull();
  });
});
