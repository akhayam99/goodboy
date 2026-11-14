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
import { aProject, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { PaneShell } from '@goodboy/ui';
import type { IsoDateTime, MountId, Session, StepId, Workflow, WorkflowId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
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
import { testTurn } from '../../../features/file-versions/testing/testTurn';
import type { AppStore } from '../../../store/store';
import type { ColumnActions } from '../SideColumn/columnDoors';
import type { ColumnPlace } from '../../../shared/navigation/columnPlace';
import { SideColumn } from '../SideColumn';
import { SessionContextCards } from '../SessionContextCards';
import { SessionFrame } from './SessionFrame';
import { CARD_INSET } from './SessionLevel/railInset';

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
  openWork: vi.fn(),
  openChat: vi.fn(),
  openWorkflows: vi.fn(),
  openNewChat: vi.fn(),
  openMonitoring: vi.fn(),
  openImpact: vi.fn(),
  openSettings: vi.fn(),
  openChangelog: vi.fn(),
  openGuide: vi.fn(),
});

const open = sessionOf({ goal: 'Stop retried webhooks', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
const other = sessionOf({
  goal: 'Ledger export speedup',
  lastOpenedAt: '2026-10-05T09:00:00.000Z',
});
const openId = open.id;

const WORKFLOW_ID: WorkflowId = brandedId<WorkflowId>({ value: 'workflow-ledger-export' });

const workflowOf = (): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: harborline.id,
  name: 'Fix flaky tests',
  description: '',
  steps: [
    {
      id: brandedId<StepId>({ value: 'step-1' }),
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Implement',
      promptPrefix: '',
    },
    {
      id: brandedId<StepId>({ value: 'step-2' }),
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Test',
      promptPrefix: '',
    },
  ],
  createdAt: brandedId<IsoDateTime>({ value: '2026-10-06T09:00:00.000Z' }),
  updatedAt: brandedId<IsoDateTime>({ value: '2026-10-06T09:00:00.000Z' }),
});

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

const Shell = ({ place = null }: MountParams) => {
  const current = useAppStore(
    (state) => state.sessions.find((entry) => entry.id === state.currentSessionId) ?? null,
  );
  const currentSessionId = current?.id ?? null;
  return (
    <ToastProvider>
      <SideColumn
        scope="workspace"
        workspaceId={harborline.id}
        currentSessionId={currentSessionId}
        place={place}
        actions={actions()}
      />
      {current === null ? null : (
        <SessionFrame session={current}>
          <PaneShell title="Context" scroll="self">
            <SessionContextCards session={current} />
          </PaneShell>
        </SessionFrame>
      )}
    </ToastProvider>
  );
};

const mountColumn = ({ place = null }: MountParams = {}) => render(<Shell place={place} />);

const elementOf = (selector: string, root: ParentNode = document): HTMLElement => {
  const element = root.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`no element for ${selector}`);
  }
  return element;
};

const rail = (): HTMLElement => elementOf('[data-page-header]');

const sessionLayer = (): HTMLElement => elementOf('[data-level-layer="session"]');

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
    expect(within(sessionLayer()).queryByRole('group', { name: 'Folders' })).toBeNull();
    const paymentsRows = within(projects.getByRole('list', { name: 'payments-api worktrees' }));
    const worktree = paymentsRows.getByRole('button', { name: /#418/ });
    expect(worktree.textContent?.startsWith('#418 ')).toBe(true);
    expect(worktree.getAttribute('aria-label')).toContain(`branch goodboy/${openId}`);
    projects.getByRole('list', { name: 'ledger-core worktrees' });

    await act(async () => {
      fireEvent.click(worktree);
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
    linked.getByRole('button', { name: 'Link work' });
  });

  it('starts every linked title on one edge and keeps a long key whole, cut at the end by the column', () => {
    seed();
    useAppStore.setState({
      sessionExternalTasks: {
        [openId]: [
          {
            sessionId: openId,
            provider: 'sentry',
            externalId: 'ext-sentry',
            identifier: 'PAYMENTS-API-3F2',
            title: 'DuplicateCreditError in applyWebhook',
            url: 'https://sentry.io/acme/payments-api/issues/3F2',
            createdAt: brandedId<IsoDateTime>({ value: '2026-10-05T09:00:00.000Z' }),
          },
        ],
      },
    });
    mountColumn();

    const key = sessionLayer().querySelector('[data-linked-key]');
    expect(key?.textContent).toBe('PAYMENTS-API-3F2');
  });

  it('gives the Projects card and the Linked card the same side padding, from one constant', () => {
    seed();
    const payments = mountOf({ session: open, project: paymentsApi });
    useAppStore.setState({
      sessionProjectMounts: { [openId]: [payments] },
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
    stubStoryInvoke({
      worktree_status: () => worktreeStatusOf({}),
      worktree_remote_url: () => 'git@github.com:harborline/payments-api.git',
      detect_editors: () => [],
    });
    mountColumn();

    const cards = Array.from(sessionLayer().querySelectorAll<HTMLElement>('[data-level-card]'));
    expect(cards.map((card) => card.getAttribute('data-level-card'))).toEqual(
      expect.arrayContaining(['Projects', 'Linked']),
    );
    const projects = within(sessionLayer()).getByRole('group', { name: 'Projects' });
    const linked = within(sessionLayer()).getByRole('group', { name: 'Linked' });
    expect(projects.getAttribute('data-level-card')).toBe('Projects');
    expect(linked.getAttribute('data-level-card')).toBe('Linked');
    expect(CARD_INSET).toBe('px-2 py-1');
  });

  it('lists a pull request once: a worktree that owns it hides the same number from Linked', () => {
    seed();
    const payments = mountOf({ session: open, project: paymentsApi });
    useAppStore.setState({
      sessionProjectMounts: { [openId]: [payments] },
      mountGithub: { [payments.mountId]: mountGithubOf({ mount: payments, number: 418 }) },
      sessionGithub: {
        [openId]: {
          ...mountGithubOf({ mount: payments, number: 418 }),
          pr: null,
          linkedIssues: [
            {
              number: 418,
              title: 'Retry webhook deliveries',
              url: 'https://github.com/harborline/payments-api/issues/418',
              closes: true,
            },
            {
              number: 418,
              title: 'Same number in another repository',
              url: 'https://github.com/harborline/notify-relay/issues/418',
              closes: false,
            },
          ],
        },
      },
    });
    stubStoryInvoke({
      worktree_status: () => worktreeStatusOf({}),
      worktree_remote_url: () => 'git@github.com:harborline/payments-api.git',
      detect_editors: () => [],
    });
    mountColumn();

    const linked = within(within(sessionLayer()).getByRole('group', { name: 'Linked' }));
    expect(linked.getAllByRole('button', { name: 'Open issue #418' })).toHaveLength(1);
    linked.getByText('Same number in another repository');
  });
});

const openSessionMenu = (): HTMLElement => {
  fireEvent.click(
    within(rail()).getByRole('button', {
      name: 'More session actions',
    }),
  );
  return screen.getByRole('menu');
};

type MenuItemParams = {
  readonly name: RegExp;
};

const menuItem = ({ name }: MenuItemParams): HTMLElement =>
  within(openSessionMenu()).getByRole('menuitem', { name });

describe('the session rail top row and its menu', () => {
  it('holds Pin, Refresh and the session menu in the title row, with no foot', () => {
    seed();
    mountColumn();
    expect(sessionLayer().querySelector('[data-level-identity]')).toBeNull();
    const top = within(rail());

    expect(top.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Pin session',
      'Refresh session',
      'More session actions',
    ]);
    expect(rail().querySelector('[data-session-foot]')).toBeNull();
    expect(top.getByRole('button', { name: 'Pin session' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('pins through the registry action and shows Pin pressed once pinned', async () => {
    seed();
    const pinSession = vi.fn(async () => undefined);
    useAppStore.setState({ pinSession });
    mountColumn();
    const top = within(rail());

    await act(async () => {
      fireEvent.click(top.getByRole('button', { name: 'Pin session' }));
    });
    expect(pinSession).toHaveBeenCalledWith(openId);

    act(() => {
      useAppStore.setState({
        sessionPins: { [harborline.id]: [{ id: openId, at: 1 }] },
      });
    });
    expect(top.getByRole('button', { name: 'Pin session' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('keeps the pin as it was and says why when pinning fails, with Retry', async () => {
    seed();
    const pinSession = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('database is locked'))
      .mockResolvedValueOnce(undefined);
    useAppStore.setState({ pinSession });
    mountColumn();
    const top = within(rail());

    await act(async () => {
      fireEvent.click(top.getByRole('button', { name: 'Pin session' }));
    });
    screen.getByText(/database is locked/);
    expect(top.getByRole('button', { name: 'Pin session' }).getAttribute('aria-pressed')).toBe(
      'false',
    );

    await act(async () => {
      fireEvent.click(within(rail()).getByRole('button', { name: 'Retry' }));
    });
    expect(pinSession).toHaveBeenCalledTimes(2);
    expect(within(rail()).queryByText(/database is locked/)).toBeNull();
  });

  it('reports a failed read of the session limit and leaves the menu working', async () => {
    seed();
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({
      loadSessionBudget: async () => {
        throw new Error('database is locked');
      },
      reportError,
    });

    await act(async () => {
      mountColumn();
    });

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't read the session limit", sessionId: openId }),
    );
    expect(openSessionMenu()).toBeDefined();
  });

  it('holds Archive and Delete in the session menu, Delete as the danger entry', () => {
    seed();
    mountColumn();

    const menu = openSessionMenu();
    const labels = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent ?? '');
    expect(labels.some((label) => label.startsWith('Archive'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Delete'))).toBe(true);
  });

  it('holds five rows at most, with no row that has a control beside it, and shows the values', () => {
    seed();
    mountColumn();

    const labels = within(openSessionMenu())
      .getAllByRole('menuitem')
      .map((item) => item.textContent ?? '');
    expect(labels.length).toBeLessThanOrEqual(5);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label).toMatch(/^(Limit: |Autopilot: |Stop running|Archive|Delete)/);
    }
    expect(labels.some((label) => /^(Pin|Unpin|Refresh|Rename)/.test(label))).toBe(false);
    expect(labels.some((label) => label.startsWith('Limit: none'))).toBe(true);
  });

  it('keeps Delete behind its confirm', async () => {
    seed();
    const deleteTask = vi.fn(async () => undefined);
    useAppStore.setState({ deleteTask });
    mountColumn();

    fireEvent.click(menuItem({ name: /^Delete/ }));
    const dialog = within(await screen.findByRole('dialog', { name: /^Delete .+\?$/ }));
    expect(deleteTask).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(dialog.getByRole('button', { name: /^Delete/ }));
    });
    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(deleteTask).toHaveBeenCalledWith(openId);
  });

  it('with a live agent asks before Archive, and Cancel leaves the session live', async () => {
    seed();
    useAppStore.setState({
      sessionPhaseRuns: { [openId]: [anAgent({ sessionId: openId, status: 'running' })] },
    });
    const bulkArchiveTask = vi.fn<AppStore['bulkArchiveTask']>();
    useAppStore.setState({ bulkArchiveTask });
    mountColumn();

    fireEvent.click(menuItem({ name: /^Archive/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Stop 1 agent and archive?' }));
    dialog.getByText(/stay on disk/);
    await act(async () => {
      fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    });

    expect(bulkArchiveTask).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Stop 1 agent and archive?' })).toBeNull();
  });

  it('archives an idle session with no confirm and undoes from the toast', async () => {
    seed();
    const bulkArchiveTask = vi.fn<AppStore['bulkArchiveTask']>(async () => ({
      succeeded: [openId],
      failed: [],
    }));
    const bulkUnarchiveTask = vi.fn<AppStore['bulkUnarchiveTask']>(async () => ({
      succeeded: [openId],
      failed: [],
    }));
    useAppStore.setState({ bulkArchiveTask, bulkUnarchiveTask });
    mountColumn();

    const archiveItem = menuItem({ name: /^Archive/ });
    await act(async () => {
      fireEvent.click(archiveItem);
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bulkArchiveTask).toHaveBeenCalledWith([openId]);
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    });
    expect(bulkUnarchiveTask).toHaveBeenCalledWith([openId]);
  });

  it('names the live agents it stops in the Archive confirm, archives on confirm and undoes from the toast', async () => {
    seed();
    useAppStore.setState({
      sessionPhaseRuns: { [openId]: [anAgent({ sessionId: openId, status: 'running' })] },
    });
    const bulkArchiveTask = vi.fn<AppStore['bulkArchiveTask']>(async () => ({
      succeeded: [openId],
      failed: [],
    }));
    const bulkUnarchiveTask = vi.fn<AppStore['bulkUnarchiveTask']>(async () => ({
      succeeded: [openId],
      failed: [],
    }));
    useAppStore.setState({ bulkArchiveTask, bulkUnarchiveTask });
    mountColumn();

    fireEvent.click(menuItem({ name: /^Archive/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Stop 1 agent and archive?' }));
    dialog.getByText(/Archive stops it first and keeps what it wrote/);
    await act(async () => {
      fireEvent.click(dialog.getByRole('button', { name: 'Stop 1 agent and archive' }));
    });
    expect(bulkArchiveTask).toHaveBeenCalledWith([openId]);

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    });
    expect(bulkUnarchiveTask).toHaveBeenCalledWith([openId]);
  });

  it('says why Archive failed, keeps the session live, and a second Archive retries', async () => {
    seed();
    const bulkArchiveTask = vi
      .fn<AppStore['bulkArchiveTask']>()
      .mockRejectedValueOnce(new Error('database is locked'))
      .mockResolvedValueOnce({ succeeded: [], failed: [] });
    useAppStore.setState({ bulkArchiveTask });
    mountColumn();

    const archiveItem = menuItem({ name: /^Archive/ });
    await act(async () => {
      fireEvent.click(archiveItem);
    });
    screen.getByText(/database is locked/);
    expect(useAppStore.getState().sessions.map((session) => session.id)).toContain(openId);

    const again = menuItem({ name: /^Archive/ });
    await act(async () => {
      fireEvent.click(again);
    });
    expect(bulkArchiveTask).toHaveBeenCalledTimes(2);
    expect(bulkArchiveTask).toHaveBeenLastCalledWith([openId]);
  });

  it('offers Restore in the menu of an archived session, with no Pin or Refresh', async () => {
    seed({
      session: {
        ...open,
        archivedAt: brandedId<IsoDateTime>({ value: '2026-10-06T10:00:00.000Z' }),
      },
    });
    const bulkUnarchiveTask = vi.fn<AppStore['bulkUnarchiveTask']>(async () => ({
      succeeded: [],
      failed: [],
    }));
    useAppStore.setState({ bulkUnarchiveTask });
    mountColumn();

    const top = within(rail());
    expect(top.queryByRole('button', { name: 'Pin session' })).toBeNull();
    const restore = menuItem({ name: /^Restore/ });
    await act(async () => {
      fireEvent.click(restore);
    });
    expect(screen.queryByRole('dialog', { name: 'Archive session?' })).toBeNull();
    expect(bulkUnarchiveTask).toHaveBeenCalledWith([openId]);
  });
});
