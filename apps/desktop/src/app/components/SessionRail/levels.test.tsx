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
import { innerColumnStore } from '@goodboy/ui';
import type { IsoDateTime, Session, StepId, Workflow, WorkflowId } from '@goodboy/types';
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
import { testTurn } from '../../../features/file-versions/testing/testTurn';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { useCurrentSession } from '../../../store';
import type { AppStore } from '../../../store/store';
import type { ColumnActions } from '../SideColumn/columnDoors';
import type { ColumnPlace } from '../SideColumn/columnPlace';
import { SideColumn } from '../SideColumn';
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
  openChat: vi.fn(),
  openWorkflows: vi.fn(),
  openTerminalStudio: vi.fn(),
  openNewChat: vi.fn(),
  openNewTerminal: vi.fn(),
  openMonitoring: vi.fn(),
  openImpact: vi.fn(),
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
  const current = useCurrentSession();
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
          <p>page</p>
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

const nav = (): HTMLElement => elementOf('[data-column-layer="nav"]');

const rail = (): HTMLElement => elementOf('[data-session-rail]');

const levelOf = (): string | null => rail().getAttribute('data-session-rail');

const sessionLayer = (): HTMLElement => elementOf('[data-level-layer="session"]');

const pages = () => within(within(sessionLayer()).getByRole('list', { name: 'Pages' }));

const toggle = (): HTMLElement => elementOf('[data-session-rail-toggle]');

describe('the main sidebar beside the session rail', () => {
  it('keeps the workspace level with the session row selected while the rail holds the session', () => {
    seed();
    mountColumn();

    expect(within(nav()).getByRole('button', { name: /^New session/ })).toBeDefined();
    expect(nav().querySelector('[data-column-door="board"]')).not.toBeNull();
    expect(nav().querySelector('[data-level-layer]')).toBeNull();
    const row = nav().querySelector(`[data-select-id="${openId}"]`);
    expect(row?.getAttribute('aria-current')).toBe('page');
    expect(levelOf()).toBe('session');
    expect(within(sessionLayer()).queryByText('Stop retried webhooks')).toBeNull();
    expect(within(rail()).queryByRole('button', { name: 'Back to Sessions' })).toBeNull();
    expect(
      pages()
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([
      'Overview',
      'Runs',
      'Orchestrated',
      'Agents',
      'Auto agentsExperimental',
      'Artifacts',
      'Questions',
    ]);
  });

  it('opens another session from its row without changing the main sidebar level', () => {
    seed();
    mountColumn();

    const row = nav().querySelector<HTMLElement>(`[data-select-id="${other.id}"]`);
    expect(row).not.toBeNull();
    act(() => {
      row?.click();
    });

    expect(useAppStore.getState().currentSessionId).toBe(other.id);
    expect(nav().querySelector('[data-column-door="board"]')).not.toBeNull();
    expect(
      nav().querySelector(`[data-select-id="${other.id}"]`)?.getAttribute('aria-current'),
    ).toBe('page');
    expect(levelOf()).toBe('session');
    expect(within(nav()).getAllByText('Ledger export speedup')).toHaveLength(1);
  });

  it('keeps the session level when Command [ is pressed in the rail on its top level', () => {
    seed();
    mountColumn();

    fireEvent.keyDown(within(sessionLayer()).getByRole('button', { name: /^Overview/ }), {
      key: '[',
      metaKey: true,
    });

    expect(levelOf()).toBe('session');
    expect(useAppStore.getState().currentSessionId).toBe(openId);
  });

  it('selects the door and unselects the session row while a studio sits over the session', () => {
    seed();
    mountColumn({ place: 'inbox' });

    expect(nav().querySelector('[data-column-door="inbox"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    const row = nav().querySelector(`[data-select-id="${openId}"]`);
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

  it('lights the selected page icon in its kind color, the label and fill unchanged', () => {
    seed();
    mountColumn();
    const overview = pages().getByRole('button', { name: /^Overview/ });
    expect(overview.getAttribute('data-icon-tone')).toBe('primary');

    fireEvent.click(pages().getByRole('button', { name: /^Questions/ }));

    const questions = pages().getByRole('button', { name: /^Questions/ });
    expect(questions.getAttribute('data-icon-tone')).toBe('warning');
    expect(questions.getAttribute('data-selected')).toBe('true');
    expect(
      pages()
        .getByRole('button', { name: /^Overview/ })
        .hasAttribute('data-icon-tone'),
    ).toBe(false);
  });

  it('shows the running count beside the info dot while one of two runs runs, the total at rest', () => {
    const workflow = workflowOf();
    const first = aWorkflowRun({ ordinal: 0, workflowId: workflow.id });
    const second = aWorkflowRun({ ordinal: 1, workflowId: workflow.id });
    const withRuns: Session = { ...open, workflowRuns: [first, second] };
    seed({ session: withRuns });
    useAppStore.setState({
      sessionWorkflows: { [openId]: [workflow] },
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
    expect(slot?.textContent).toBe('1');
    expect(slot?.getAttribute('data-tone')).toBe('info');

    act(() => useAppStore.setState({ sessionPhaseRuns: { [openId]: [] } }));
    expect(sessionLayer().querySelector('[data-page-value="runs"]')?.textContent).toBe('2');
  });

  it('keeps Questions last with the open count and a warning dot while one is open', () => {
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

  it('shows Changes and a Folder group in a plain folder session', async () => {
    seed({ isBranchless: true });
    const acmeNotes = aProject({
      workspaceId: harborline.id,
      name: 'acme-notes',
      rootPath: '/mock/Documents/acme-notes',
      kind: 'folder',
    });
    useAppStore.setState({
      projects: [acmeNotes],
      folderPurpose: { [acmeNotes.id]: 'documents' },
      sessionProjectMounts: { [openId]: [] },
    });
    stubStoryInvoke({
      file_versions_folder_list_turns: [
        testTurn({
          runId: 'run-memo',
          folderPath: acmeNotes.rootPath,
          changes: [{ relativePath: 'launch-memo.md' }, { relativePath: 'faq.md' }],
        }),
      ],
    });
    mountColumn();

    const folder = within(sessionLayer()).getByRole('group', { name: 'Folder' });
    expect(within(folder).getByText('acme-notes')).toBeDefined();
    expect(within(folder).getByText('Documents · edits in place')).toBeDefined();
    expect(within(sessionLayer()).queryByRole('group', { name: 'Projects' })).toBeNull();
    await vi.waitFor(() => {
      const changes = pages().getByRole('button', { name: /^Changes/ });
      expect(changes.querySelector('[data-page-value="files"]')?.textContent).toBe('2');
    });
    expect(pages().queryByRole('button', { name: /File versions/ })).toBeNull();
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
    expect(within(sessionLayer()).queryByRole('group', { name: 'Folders' })).toBeNull();
    const paymentsRows = within(projects.getByRole('list', { name: 'payments-api worktrees' }));
    const worktree = paymentsRows.getByRole('button', { name: /#418/ });
    expect(worktree.textContent).not.toContain('#418');
    expect(worktree.getAttribute('aria-label')).toContain(`branch goodboy/${openId}`);
    expect(projects.getByRole('list', { name: 'ledger-core worktrees' })).toBeDefined();

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
    expect(linked.getByRole('button', { name: 'Link work' })).toBeDefined();
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
    expect(linked.getByText('Same number in another repository')).toBeDefined();
  });
});

describe('the session rail top row and foot', () => {
  it('holds the fold toggle, then Pin and Refresh as icons, with no menu and no Autopilot', () => {
    seed();
    mountColumn();
    expect(sessionLayer().querySelector('[data-level-identity]')).toBeNull();
    const top = within(elementOf('[data-rail-top]', rail()));

    expect(top.queryByRole('button', { name: 'More session actions' })).toBeNull();
    expect(top.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Fold session rail',
      'Pin session',
      'Refresh session',
    ]);
    expect(top.getByRole('button', { name: 'Pin session' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('pins through the registry action and shows Pin pressed once pinned', async () => {
    seed();
    const pinSession = vi.fn(async () => undefined);
    useAppStore.setState({ pinSession });
    mountColumn();
    const top = within(elementOf('[data-rail-top]', rail()));

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
    const top = within(elementOf('[data-rail-top]', rail()));

    await act(async () => {
      fireEvent.click(top.getByRole('button', { name: 'Pin session' }));
    });
    expect(within(rail()).getByText(/database is locked/)).toBeDefined();
    expect(top.getByRole('button', { name: 'Pin session' }).getAttribute('aria-pressed')).toBe(
      'false',
    );

    await act(async () => {
      fireEvent.click(within(rail()).getByRole('button', { name: 'Retry' }));
    });
    expect(pinSession).toHaveBeenCalledTimes(2);
    expect(within(rail()).queryByText(/database is locked/)).toBeNull();
  });

  it('puts the spend, Archive and Delete on one row, Archive and Delete as icons', () => {
    seed();
    useAppStore.setState({
      sessionBudgets: { [openId]: { sessionId: openId, softCapUsd: 10, onExceed: 'pause' } },
    });
    mountColumn();
    const footRow = elementOf('[data-session-foot]', rail());
    const foot = within(footRow);

    expect(elementOf('[data-session-spend]', footRow).textContent).toBe('$0 / $10');
    expect(elementOf('[data-session-spend]', footRow).getAttribute('aria-label')).toBe(
      'Spend $0 of $10.00 limit',
    );
    const icons = Array.from(footRow.querySelectorAll('[data-session-foot-action]'));
    expect(icons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Archive session',
      'Delete session',
    ]);
    expect(icons.every((button) => button.textContent === '')).toBe(true);
    expect(icons.every((button) => button.querySelector('svg') !== null)).toBe(true);
    expect(footRow.textContent).not.toContain('\u2026');
    expect(foot.getByRole('button', { name: 'Delete session' }).className).toContain('danger');
    expect(foot.getByRole('button', { name: 'Archive session' }).className).not.toContain('danger');
    fireEvent.click(elementOf('[data-session-spend]', footRow));
    expect(screen.getByRole('dialog', { name: 'Session spend' })).toBeDefined();
  });

  it('keeps Delete behind its confirm', async () => {
    seed();
    const deleteTask = vi.fn(async () => undefined);
    useAppStore.setState({ deleteTask });
    mountColumn();
    const foot = within(elementOf('[data-session-foot]', rail()));

    fireEvent.click(foot.getByRole('button', { name: 'Delete session' }));
    const dialog = within(screen.getByRole('dialog', { name: /^Delete .+\?$/ }));
    expect(deleteTask).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(dialog.getByRole('button', { name: 'Delete session' }));
    });
    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(deleteTask).toHaveBeenCalledWith(openId);
  });

  it('asks before Archive, and Cancel leaves the session live', async () => {
    seed();
    const bulkArchiveTask = vi.fn<AppStore['bulkArchiveTask']>();
    useAppStore.setState({ bulkArchiveTask });
    mountColumn();
    const foot = within(elementOf('[data-session-foot]', rail()));

    fireEvent.click(foot.getByRole('button', { name: 'Archive session' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Archive session?' }));
    expect(dialog.getByText(/stay on disk/)).toBeDefined();
    expect(dialog.queryByText(/running/)).toBeNull();
    await act(async () => {
      fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    });

    expect(bulkArchiveTask).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Archive session?' })).toBeNull();
  });

  it('names the running agents in the Archive confirm, archives on confirm and undoes from the toast', async () => {
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
    const foot = within(elementOf('[data-session-foot]', rail()));

    fireEvent.click(foot.getByRole('button', { name: 'Archive session' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Archive session?' }));
    expect(
      dialog.getByText(
        /1 agent is still running in this session and keeps running after you archive it/,
      ),
    ).toBeDefined();
    await act(async () => {
      fireEvent.click(dialog.getByRole('button', { name: 'Archive session' }));
    });
    expect(bulkArchiveTask).toHaveBeenCalledWith([openId]);

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    });
    expect(bulkUnarchiveTask).toHaveBeenCalledWith([openId]);
  });

  it('says why Archive failed at the foot, keeps the session live and retries', async () => {
    seed();
    const bulkArchiveTask = vi
      .fn<AppStore['bulkArchiveTask']>()
      .mockRejectedValueOnce(new Error('database is locked'))
      .mockResolvedValueOnce({ succeeded: [], failed: [] });
    useAppStore.setState({ bulkArchiveTask });
    mountColumn();
    const foot = within(elementOf('[data-session-foot]', rail()));

    fireEvent.click(foot.getByRole('button', { name: 'Archive session' }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Archive session?' })).getByRole('button', {
          name: 'Archive session',
        }),
      );
    });
    const footArea = elementOf('[data-session-foot]', rail()).parentElement ?? rail();
    expect(within(footArea).getByText(/database is locked/)).toBeDefined();
    expect(
      within(elementOf('[data-rail-top]', rail())).queryByText(/database is locked/),
    ).toBeNull();

    await act(async () => {
      fireEvent.click(within(footArea).getByRole('button', { name: 'Retry' }));
    });
    expect(bulkArchiveTask).toHaveBeenCalledTimes(2);
    expect(bulkArchiveTask).toHaveBeenLastCalledWith([openId]);
  });

  it('offers Restore at the foot of an archived session with no confirm and no top row actions', async () => {
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

    const footRow = elementOf('[data-session-foot]', rail());
    expect(
      Array.from(footRow.querySelectorAll('[data-session-foot-action]')).map((button) =>
        button.getAttribute('aria-label'),
      ),
    ).toEqual(['Restore session', 'Delete session']);
    expect(rail().querySelector('[data-session-actions]')).toBeNull();
    await act(async () => {
      fireEvent.click(within(footRow).getByRole('button', { name: 'Restore session' }));
    });
    expect(screen.queryByRole('dialog', { name: 'Archive session?' })).toBeNull();
    expect(bulkUnarchiveTask).toHaveBeenCalledWith([openId]);
  });
});

describe('the session rail as the inner column', () => {
  it('folds and unfolds the rail through the inner column key, remembered', () => {
    seed();
    mountColumn();
    expect(innerColumnStore.current()?.label).toBe('Fold the session rail');

    act(() => {
      innerColumnStore.toggleCurrent();
    });

    expect(rail().hasAttribute('data-rail-folded')).toBe(true);
    expect(innerColumnStore.current()?.label).toBe('Show the session rail');
    act(() => {
      innerColumnStore.toggleCurrent();
    });
    expect(rail().hasAttribute('data-rail-folded')).toBe(false);
  });
});

describe('the folded session rail', () => {
  it('draws one branch icon per worktree with its project, branch and state in the tooltip', () => {
    seed();
    const payments = mountOf({ session: open, project: paymentsApi });
    const github = mountGithubOf({ mount: payments, number: 418 });
    useAppStore.setState({
      sessionProjectMounts: { [openId]: [payments] },
      mountGithub: {
        [payments.mountId]: {
          ...github,
          pr: github.pr === null ? null : { ...github.pr, checks: 'failure' },
        },
      },
    });
    stubStoryInvoke({ worktree_status: () => worktreeStatusOf({}), detect_editors: () => [] });
    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, '1');
    mountColumn();

    const icons = within(elementOf('[data-rail-worktrees]', rail())).getAllByRole('button');
    expect(icons.map((icon) => icon.getAttribute('aria-label'))).toEqual([
      `payments-api, goodboy/${openId}, Open, A check failed`,
    ]);
  });

  it('folds to the page icons and back, and remembers the choice', () => {
    seed();
    const { unmount } = mountColumn();

    fireEvent.click(toggle());

    expect(rail().hasAttribute('data-rail-folded')).toBe(true);
    expect(rail().querySelector('[data-rail-level="session"]')).not.toBeNull();
    expect(within(rail()).getByRole('button', { name: 'Agents' })).toBeDefined();
    expect(within(rail()).queryByRole('button', { name: /^Back to/ })).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.sessionRailCollapsed)).toBe('1');
    expect(nav().querySelector('[data-column-door="board"]')).not.toBeNull();

    unmount();
    mountColumn();
    expect(rail().hasAttribute('data-rail-folded')).toBe(true);

    fireEvent.click(toggle());
    expect(rail().hasAttribute('data-rail-folded')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.sessionRailCollapsed)).toBe('0');
  });

  it('opens a page from its icon', () => {
    seed();
    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, '1');
    mountColumn();

    fireEvent.click(within(rail()).getByRole('button', { name: 'Agents' }));

    expect(useAppStore.getState().activeLens[openId]).toBe('agents');
  });
});
