// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import type { IsoDateTime, Session, StepId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { worktreeStatusOf } from '../../../test/worktreeStatusOf';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { ToastProvider } from '../../../shared/components/Toast';
import {
  harborline,
  ledgerCore,
  mountGithubOf,
  mountOf,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { brandedId } from '../../../features/history/testing/brandedId';
import { ColumnRail } from './ColumnRail';
import type { ColumnActions } from './columnDoors';
import type { ColumnPlace } from './columnPlace';
import { SideColumn } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

const actions = (): ColumnActions => ({
  openBoard: vi.fn(),
  openInbox: vi.fn(),
  openChat: vi.fn(),
  openWorkflows: vi.fn(),
  openTerminalStudio: vi.fn(),
  openNewChat: vi.fn(),
  openNewTerminal: vi.fn(),
  openMonitoring: vi.fn(),
  openSettings: vi.fn(),
  openChangelog: vi.fn(),
  openGuide: vi.fn(),
  openShortcuts: vi.fn(),
});

const open = sessionOf({ goal: 'Stop retried webhooks', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
const other = sessionOf({
  goal: 'Ledger export speedup',
  lastOpenedAt: '2026-10-05T09:00:00.000Z',
});
const openId = open.id;

type SeedParams = {
  readonly session?: Session;
  readonly isBranchless?: boolean;
};

const seed = ({ session = open, isBranchless = false }: SeedParams = {}) => {
  seedColumn({ store: useAppStore, sessions: [session, other], currentSessionId: openId });
  useAppStore.setState({
    sessionBranches: { [openId]: isBranchless ? '' : 'goodboy/webhook-retries' },
  });
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId: openId }) });
};

type MountParams = {
  readonly place?: ColumnPlace;
};

const Column = ({ place = null }: MountParams) => (
  <ToastProvider>
    <SideColumn
      scope="workspace"
      workspaceId={harborline.id}
      currentSessionId={openId}
      place={place}
      isCollapsed={false}
      actions={actions()}
      onToggle={vi.fn()}
    />
  </ToastProvider>
);

const mountColumn = ({ place = null }: MountParams = {}) => render(<Column place={place} />);

const elementOf = (selector: string, root: ParentNode = document): HTMLElement => {
  const element = root.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`no element for ${selector}`);
  }
  return element;
};

const nav = (): HTMLElement => elementOf('[data-column-layer="nav"]');

const levelOf = (): string | null => nav().getAttribute('data-sidebar-level');

const sessionLayer = (): HTMLElement => elementOf('[data-level-layer="session"]');

const workspaceLayer = (): HTMLElement => elementOf('[data-level-layer="workspace"]');

const pages = () => within(within(sessionLayer()).getByRole('list', { name: 'Pages' }));

describe('the session level', () => {
  it('opens on the session with its back row, identity and pages, the doors one step away', () => {
    seed();
    mountColumn();

    expect(levelOf()).toBe('session');
    expect(within(sessionLayer()).getByRole('button', { name: 'Back to Sessions' })).toBeDefined();
    expect(within(sessionLayer()).getByText('Stop retried webhooks')).toBeDefined();
    expect(
      pages()
        .getAllByRole('button')
        .map((row) => row.textContent),
    ).toEqual(['Overview', 'Runs', 'Orchestrated', 'Agents', 'Artifacts']);
    expect(workspaceLayer().hasAttribute('inert')).toBe(true);
  });

  it('goes back to the workspace level with the session row still selected, the page untouched', () => {
    seed();
    mountColumn();

    fireEvent.click(within(sessionLayer()).getByRole('button', { name: 'Back to Sessions' }));

    expect(levelOf()).toBe('workspace');
    expect(useAppStore.getState().currentSessionId).toBe(openId);
    const row = workspaceLayer().querySelector(`[data-select-id="${openId}"]`);
    expect(row?.getAttribute('aria-current')).toBe('page');
    expect(sessionLayer().hasAttribute('inert')).toBe(true);
  });

  it('drills in again from the session row', () => {
    seed();
    mountColumn();
    fireEvent.click(within(sessionLayer()).getByRole('button', { name: 'Back to Sessions' }));

    const row = workspaceLayer().querySelector<HTMLElement>(`[data-select-id="${openId}"]`);
    expect(row).not.toBeNull();
    act(() => {
      row?.click();
    });

    expect(levelOf()).toBe('session');
  });

  it('goes back with Command [ while the sidebar has focus', () => {
    seed();
    mountColumn();

    fireEvent.keyDown(within(sessionLayer()).getByRole('button', { name: /^Overview/ }), {
      key: '[',
      metaKey: true,
    });

    expect(levelOf()).toBe('workspace');
  });

  it('comes back to the session level when history returns to it', () => {
    seed();
    mountColumn();
    fireEvent.click(within(sessionLayer()).getByRole('button', { name: 'Back to Sessions' }));

    act(() => {
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId: openId, lens: 'agents' }) });
    });

    expect(levelOf()).toBe('session');
  });

  it('shows the workspace level while a studio sits over the session, with its door selected', () => {
    seed();
    mountColumn({ place: 'inbox' });

    expect(levelOf()).toBe('workspace');
    expect(
      workspaceLayer().querySelector('[data-column-door="inbox"]')?.getAttribute('aria-current'),
    ).toBe('page');
    const row = workspaceLayer().querySelector(`[data-select-id="${openId}"]`);
    expect(row?.getAttribute('aria-current')).toBeNull();
  });
});

describe('the session level pages', () => {
  it('opens a page from its row and moves the current mark with it', () => {
    seed();
    mountColumn();

    fireEvent.click(pages().getByRole('button', { name: /^Agents/ }));

    expect(useAppStore.getState().activeLens[openId]).toBe('agents');
    expect(
      pages()
        .getByRole('button', { name: /^Agents/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      pages()
        .getByRole('button', { name: /^Overview/ })
        .getAttribute('aria-current'),
    ).toBe(null);
  });

  it('counts the runs in gray with a dot while one runs, the word in the tooltip', () => {
    const first = aWorkflowRun({ ordinal: 0 });
    const second = aWorkflowRun({ ordinal: 1 });
    const withRuns: Session = { ...open, workflowRuns: [first, second] };
    seed({ session: withRuns });
    useAppStore.setState({
      sessionPhaseRuns: {
        [openId]: [
          anAgent({
            sessionId: openId,
            status: 'running',
            workflowRunId: first.id,
            stepId: brandedId<StepId>({ value: 'step-1' }),
          }),
        ],
      },
    });
    mountColumn();

    const slot = sessionLayer().querySelector('[data-page-value="runs"]');
    expect(slot?.textContent).toBe('2');
    expect(slot?.getAttribute('data-tone')).toBe('running');
  });

  it('adds Questions last with a warning dot only while one is open', () => {
    seed();
    seedColumn({
      store: useAppStore,
      sessions: [open, other],
      currentSessionId: openId,
      questions: [open],
    });
    mountColumn();

    expect(pages().getAllByRole('button').at(-1)?.textContent).toBe('Questions1');
    expect(
      sessionLayer().querySelector('[data-page-value="questions"]')?.getAttribute('data-tone'),
    ).toBe('warning');
  });

  it('shows File versions and no Projects in a branchless session', () => {
    seed({ isBranchless: true });
    mountColumn();

    expect(pages().getByRole('button', { name: /^File versions/ })).toBeDefined();
    expect(within(sessionLayer()).queryByRole('group', { name: 'Projects' })).toBeNull();
  });
});

describe('the session level projects and linked work', () => {
  it('lists each worktree under its project with its pull request number, and opens its branch', async () => {
    seed();
    const payments = mountOf({ session: open, project: paymentsApi });
    const ledger = mountOf({ session: open, project: ledgerCore });
    useAppStore.setState({
      sessionProjectMounts: { [openId]: [payments, ledger] },
      mountGithub: { [payments.mountId]: mountGithubOf({ mount: payments, number: 418 }) },
      setSessionActiveMount: vi.fn(async () => undefined),
    });
    stubStoryInvoke({
      worktree_status: () => worktreeStatusOf({}),
      worktree_remote_url: () => 'git@github.com:harborline/payments-api.git',
      detect_editors: () => [],
    });
    mountColumn();

    const projects = within(within(sessionLayer()).getByRole('group', { name: 'Projects' }));
    const paymentsRows = within(projects.getByRole('list', { name: 'payments-api worktrees' }));
    expect(paymentsRows.getByRole('button').textContent).toBe(`goodboy/${openId}#418`);
    expect(projects.getByRole('list', { name: 'ledger-core worktrees' })).toBeDefined();

    await act(async () => {
      fireEvent.click(paymentsRows.getByRole('button'));
    });

    expect(useAppStore.getState().activeLens[openId]).toBe('branch');
    expect(useAppStore.getState().diffMountPath[openId]).toBe(payments.worktreePath);
  });

  it('lists the linked work with its key and title, and keeps Link work at the label', () => {
    seed();
    useAppStore.setState({
      sessionExternalTasks: {
        [openId]: [
          {
            sessionId: openId,
            provider: 'linear',
            externalId: 'ext-nw-142',
            identifier: 'NW-142',
            title: 'Retry webhook deliveries on a 502',
            url: 'https://linear.app/northwind/issue/NW-142',
            createdAt: brandedId<IsoDateTime>({ value: '2026-10-05T09:00:00.000Z' }),
          },
        ],
      },
    });
    mountColumn();

    const linked = within(within(sessionLayer()).getByRole('group', { name: 'Linked' }));
    expect(linked.getByRole('button', { name: 'Open NW-142' }).textContent).toBe(
      'NW-142Retry webhook deliveries on a 502',
    );
    expect(linked.getByRole('button', { name: 'Link work' })).toBeDefined();
  });
});

describe('the identity row', () => {
  it('renames inline from the title and keeps Rename, Pin, Refresh, Archive and Delete in its menu', () => {
    seed();
    mountColumn();
    const identity = within(elementOf('[data-level-identity]', sessionLayer()));

    fireEvent.click(identity.getByRole('button', { name: 'More session actions' }));
    for (const label of [
      'Rename',
      'Pin session',
      'Refresh',
      'Archive session',
      'Delete session…',
    ]) {
      expect(screen.getByRole('menuitem', { name: new RegExp(`^${label}`) })).toBeDefined();
    }
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    fireEvent.click(identity.getByRole('button', { name: 'Stop retried webhooks' }));
    expect(screen.getByRole('textbox', { name: 'Session title' })).toBeDefined();
  });
});

describe('the folded sidebar', () => {
  const Rail = () => (
    <ToastProvider>
      <ColumnRail
        scope="workspace"
        workspaceId={harborline.id}
        currentSessionId={openId}
        place={null}
        onToggle={vi.fn()}
        actions={actions()}
      />
    </ToastProvider>
  );

  it('shows the session level as icons with the back icon on top, and goes back from it', () => {
    seed();
    render(<Rail />);
    const rail = elementOf('[data-column-rail]');

    expect(rail.getAttribute('data-sidebar-level')).toBe('session');
    expect(within(rail).getByRole('button', { name: 'Back to Sessions' })).toBeDefined();
    expect(within(rail).getByRole('button', { name: 'Agents' })).toBeDefined();
    expect(rail.querySelector('[data-column-door="board"]')).toBeNull();

    fireEvent.click(within(rail).getByRole('button', { name: 'Back to Sessions' }));

    expect(rail.getAttribute('data-sidebar-level')).toBe('workspace');
    expect(rail.querySelector('[data-column-door="board"]')).not.toBeNull();
  });
});
