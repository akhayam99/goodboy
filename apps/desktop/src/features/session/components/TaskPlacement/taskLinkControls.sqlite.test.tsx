import { LinkIssueAction } from '../SessionOverviewPane/LinkIssueAction';
import type { SessionEventId } from '@goodboy/types';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import { UndoToastBridge } from '../../../../app/components/UndoToastBridge';
import { LinkedTaskChip } from '../../../../shared/components/LinkedTaskChip';
import { PutOnBranchPopover } from './PutOnBranchPopover';
import { TASK_KIND } from '../../../actions/kinds/task';
import type { ActionEnv } from '../../../actions/types';
import { useTimelineOpen } from '../../hooks/useTimelineOpen';
import type { TimelineStreamEntry } from '../../timeline/buildTimelineStream';
import { listSessionEvents } from '@goodboy/db';
import { storySqlite } from '../../../../store/storyHarness';
import type { MountId, ProjectId } from '@goodboy/types';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace } from '@goodboy/db';
import type { IsoDateTime, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const SESSION_ID = 'session-ledger-export' as SessionId;

const TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'lin-412',
  identifier: 'HBL-412',
  url: 'https://linear.app/harborline/issue/HBL-412',
  title: 'Duplicate credit on webhook redelivery',
  createdAt: '2026-10-02T09:00:00.000Z' as IsoDateTime,
  scope: 'branch',
  branch: 'hl/ledger-export',
  relation: 'closes',
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  await insertSession(db, aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID }));
  useAppStore.setState({ sessionExternalTasks: {} });
});

const storedLinks = () =>
  rowsOf<{ scope: string; branch: string | null }>({
    sql: 'SELECT scope, branch FROM session_external_tasks ORDER BY scope, branch',
  });

const seed = async () => {
  await useAppStore.getState().linkSessionExternalTask(SESSION_ID, { ...TASK, scope: 'session' });
  await useAppStore.getState().linkSessionExternalTask(SESSION_ID, TASK);
  await useAppStore
    .getState()
    .linkSessionExternalTask(SESSION_ID, { ...TASK, branch: 'hl/notify-retry' });
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type RenderChipParams = {
  readonly branch?: string | null;
};

const renderChip = ({ branch = null }: RenderChipParams = {}) => {
  render(
    <ToastProvider>
      <UndoToastBridge />
      <LinkedTaskChip
        sessionId={SESSION_ID}
        task={TASK}
        branch={branch}
        branches={branch === null ? [TASK.branch ?? '', 'hl/notify-retry'] : [branch]}
      />
    </ToastProvider>,
  );
};

const unlinkEvent = async (): Promise<TimelineStreamEntry> => {
  const event = (await listSessionEvents({ db: storySqlite(), sessionId: SESSION_ID })).find(
    (row) => row.kind === 'issue_unlinked',
  );
  if (event === undefined) {
    throw new Error('Expected unlink event');
  }
  return { kind: 'event', id: event.id, at: event.createdAt, event };
};

describe('task link controls', () => {
  it('opens Link work prefilled for a legacy unlink event', async () => {
    vi.useFakeTimers();
    stubStoryInvoke({ gh_run: () => 'harborline/payments-api' });
    const session = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });
    useAppStore.setState({ sessions: [session] });
    render(
      <ToastProvider>
        <LinkIssueAction session={session} />
      </ToastProvider>,
    );
    const { result } = renderHook(() => useTimelineOpen({ sessionId: SESSION_ID }));
    const entry: TimelineStreamEntry = {
      kind: 'event',
      id: 'legacy-unlink',
      at: TASK.createdAt,
      event: {
        id: 'legacy-unlink' as SessionEventId,
        sessionId: SESSION_ID,
        kind: 'issue_unlinked',
        createdAt: TASK.createdAt,
        payload: { identifier: TASK.identifier, url: TASK.url },
      },
    };
    act(() => {
      result.current({ entry })?.open();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe(TASK.url);
  });

  it('opens the task directly and has no overflow trigger', async () => {
    await seed();
    renderChip();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Open HBL-412/ }));
    });
    expect(useAppStore.getState().activeLens[SESSION_ID]).toBe('linear');
    expect(useAppStore.getState().focusedExternalTask[SESSION_ID]?.externalId).toBe(
      TASK.externalId,
    );
    expect(screen.queryByRole('button', { name: 'Actions for HBL-412' })).toBeNull();
  });

  it('unlinks immediately without a confirmation and restores from the toast', async () => {
    await seed();
    renderChip();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlink HBL-412 from session' }));
    });
    expect(await storedLinks()).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
    screen.getByText('Unlinked HBL-412');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(await storedLinks()).toHaveLength(3);
  });

  it('takes off the last branch through the chip and undoes its generated session placement', async () => {
    await useAppStore.getState().linkSessionExternalTask(SESSION_ID, TASK);
    renderChip({ branch: TASK.branch });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Unlink HBL-412 from ${TASK.branch}` }));
    });
    expect(await storedLinks()).toEqual([{ scope: 'session', branch: TASK.branch }]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: TASK.branch }]);
  });

  it('shows branch placement as a visible action and moves a session task onto that branch', async () => {
    const projectId = 'project-payments-api' as ProjectId;
    await useAppStore
      .getState()
      .linkSessionExternalTask(SESSION_ID, { ...TASK, scope: 'session', projectId });
    render(
      <PutOnBranchPopover
        sessionId={SESSION_ID}
        projectId={projectId}
        mountId={'mount-payments' as MountId}
        branch="hl/refund"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Put on a branch hl/refund' }));
    const picker = screen.getByRole('dialog', { name: 'Put on a branch' });
    within(picker).getByRole('button', { name: 'New worktree for HBL-412' });
    await act(async () => {
      fireEvent.click(within(picker).getByRole('menuitem', { name: /^HBL-412/ }));
    });
    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: 'hl/refund' }]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps placement on another branch when adding the task to this one', async () => {
    const projectId = 'project-payments-api' as ProjectId;
    await useAppStore.getState().linkSessionExternalTask(SESSION_ID, { ...TASK, projectId });
    render(
      <PutOnBranchPopover
        sessionId={SESSION_ID}
        projectId={projectId}
        mountId={'mount-payments' as MountId}
        branch="hl/refund"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Put on a branch hl/refund' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /^HBL-412/ }));
    });
    expect(await storedLinks()).toHaveLength(2);
  });

  it('opens the worktree form from the branch row action', async () => {
    const projectId = 'project-payments-api' as ProjectId;
    await useAppStore
      .getState()
      .linkSessionExternalTask(SESSION_ID, { ...TASK, scope: 'session', projectId });
    render(
      <PutOnBranchPopover
        sessionId={SESSION_ID}
        projectId={projectId}
        mountId={'mount-payments' as MountId}
        branch="hl/refund"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Put on a branch hl/refund' }));
    fireEvent.click(screen.getByRole('button', { name: 'New worktree for HBL-412' }));
    screen.getByRole('textbox', { name: 'Branch name' });
    screen.getByRole('button', { name: 'Create worktree' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    screen.getByRole('menuitem', { name: /^HBL-412/ });
  });

  it('re-links all placements from a persisted Activity event after the Undo stack is gone', async () => {
    await seed();
    await useAppStore
      .getState()
      .unlinkSessionExternalTask(SESSION_ID, TASK.provider, TASK.externalId);
    const entry = await unlinkEvent();
    useAppStore.setState({ undoStack: [] });
    const { result } = renderHook(() => useTimelineOpen({ sessionId: SESSION_ID }));
    const target = result.current({ entry });
    expect(target?.label).toBe('Re-link');
    await act(async () => {
      target?.open();
    });
    expect(await storedLinks()).toHaveLength(3);
  });

  it('refuses persisted Activity Re-link when the task has a new placement', async () => {
    await seed();
    await useAppStore
      .getState()
      .unlinkSessionExternalTask(SESSION_ID, TASK.provider, TASK.externalId);
    const entry = await unlinkEvent();
    useAppStore.setState({ undoStack: [] });
    await useAppStore.getState().linkSessionExternalTask(SESSION_ID, { ...TASK, branch: 'hl/new' });
    const { result } = renderHook(() => useTimelineOpen({ sessionId: SESSION_ID }));
    await act(async () => {
      result.current({ entry })?.open();
    });
    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: 'hl/new' }]);
  });

  it('registry unlink removes only one project and registers a single Undo', async () => {
    const payments = 'project-payments-api' as ProjectId;
    const ledger = 'project-ledger-core' as ProjectId;
    await useAppStore
      .getState()
      .linkSessionExternalTask(SESSION_ID, { ...TASK, projectId: payments });
    await useAppStore
      .getState()
      .linkSessionExternalTask(SESSION_ID, { ...TASK, projectId: ledger });
    const facts = TASK_KIND.facts({
      state: useAppStore.getState(),
      target: {
        kind: 'task',
        sessionId: SESSION_ID,
        provider: TASK.provider,
        externalId: TASK.externalId,
        projectId: payments,
        branch: null,
      },
    });
    if (facts === null) {
      throw new Error('Expected task facts');
    }
    const env: ActionEnv = {
      getState: useAppStore.getState,
      showToast: () => undefined,
      copyText: async () => undefined,
      origin: 'menu',
      anchorKey: null,
      viewing: null,
    };
    await TASK_KIND.actions
      .find((action) => action.id === 'task.unlink')
      ?.run({ facts, env, choice: null });
    expect(
      useAppStore.getState().sessionExternalTasks[SESSION_ID]?.map((row) => row.projectId),
    ).toEqual([ledger]);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    await useAppStore.getState().undoLastOperation({});
    expect(await storedLinks()).toHaveLength(2);
  });
});
