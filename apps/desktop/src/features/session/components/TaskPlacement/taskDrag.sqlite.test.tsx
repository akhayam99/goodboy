import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace } from '@goodboy/db';
import type { SessionExternalTask } from '@goodboy/types';
import {
  aProject,
  aSession,
  nextSessionId,
  nextWorkspaceId,
  TEST_NOW,
} from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import { UndoToastBridge } from '../../../../app/components/UndoToastBridge';
import { LinkedTaskChip } from '../../../../shared/components/LinkedTaskChip';
import { SessionDropPill } from '../SessionOverviewPane/SessionDropPill';
import { TaskDragLayer } from '../SessionOverviewPane/TaskDragLayer';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
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

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const PAYMENTS = aProject({ workspaceId: WORKSPACE_ID, name: 'payments-api' });
const LEDGER = aProject({ workspaceId: WORKSPACE_ID, name: 'ledger-core' });

const TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  projectId: PAYMENTS.id,
  provider: 'linear',
  externalId: 'lin-204',
  identifier: 'HL-204',
  url: 'https://linear.app/harborline/issue/HL-204',
  title: 'Round half cents on refunds',
  createdAt: TEST_NOW,
  scope: 'branch',
  branch: 'hl/ledger-rounding',
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
  useAppStore.setState({
    projects: [PAYMENTS, LEDGER],
    sessionExternalTasks: {},
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const storedLinks = () =>
  rowsOf<{ scope: string; branch: string | null }>({
    sql: 'SELECT scope, branch FROM session_external_tasks ORDER BY scope, branch',
  });

const renderStage = ({ branch }: { readonly branch: string | null }) => {
  render(
    <ToastProvider>
      <UndoToastBridge />
      <TaskDragLayer />
      <SessionDropPill />
      <div
        data-testid="own-row"
        data-task-drop="branch"
        data-task-project={PAYMENTS.id}
        data-task-branch="hl/notify-retry"
      />
      <div
        data-testid="other-row"
        data-task-drop="branch"
        data-task-project={LEDGER.id}
        data-task-branch="hl/ledger-core-split"
      />
      <div
        data-testid="here-row"
        data-task-drop="branch"
        data-task-project={PAYMENTS.id}
        data-task-branch="hl/ledger-rounding"
      />
      <LinkedTaskChip
        sessionId={SESSION_ID}
        task={branch === null ? { ...TASK, scope: 'session', branch: undefined } : TASK}
        branch={branch}
        branches={['hl/ledger-rounding']}
      />
    </ToastProvider>,
  );
};

const hoverOver = ({ element }: { readonly element: Element | null }) => {
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(element);
};

const dragTo = ({
  element,
  isAlt = false,
  isReleased = true,
}: {
  readonly element: Element | null;
  readonly isAlt?: boolean;
  readonly isReleased?: boolean;
}) => {
  const chip = screen.getByRole('button', { name: /^Open HL-204/ });
  fireEvent.pointerDown(chip, { button: 0, clientX: 10, clientY: 10 });
  act(() => {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 11, clientY: 11 }));
  });
  hoverOver({ element });
  act(() => {
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 120, clientY: 80, altKey: isAlt }),
    );
  });
  if (isReleased) {
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 120, clientY: 80, altKey: isAlt }),
      );
    });
  }
};

const seedBranchTask = async () => {
  await useAppStore.getState().linkSessionExternalTask(SESSION_ID, TASK);
};

describe('dragging an issue chip', () => {
  it('moves it from a branch to the session in one undoable write', async () => {
    await seedBranchTask();
    renderStage({ branch: 'hl/ledger-rounding' });
    dragTo({ element: null, isReleased: false });
    const pill = screen.getByLabelText('Drop to put on the session');
    expect(pill.textContent).toBe('Session');
    hoverOver({ element: pill });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 130, clientY: 90 }));
    });
    expect(screen.getByTestId('task-drag-ghost').textContent).toContain('Move to the session');
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 130, clientY: 90 }));
    });
    expect(await storedLinks()).toEqual([{ scope: 'session', branch: 'hl/ledger-rounding' }]);
    screen.getByText('HL-204 is on the session again');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: 'hl/ledger-rounding' }]);
  });

  it('copies with Alt held and keeps the source', async () => {
    await seedBranchTask();
    renderStage({ branch: 'hl/ledger-rounding' });
    dragTo({ element: screen.getByTestId('own-row'), isAlt: true, isReleased: false });
    expect(screen.getByTestId('task-drag-ghost').textContent).toContain(
      'Copy to payments-api / hl/notify-retry',
    );
    await act(async () => {
      window.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 120, clientY: 80, altKey: true }),
      );
    });
    expect(await storedLinks()).toEqual([
      { scope: 'branch', branch: 'hl/ledger-rounding' },
      { scope: 'branch', branch: 'hl/notify-retry' },
    ]);
  });

  it('moves to another branch of the same project by default', async () => {
    await seedBranchTask();
    renderStage({ branch: 'hl/ledger-rounding' });
    dragTo({ element: screen.getByTestId('own-row') });
    await act(async () => {
      await Promise.resolve();
    });
    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: 'hl/notify-retry' }]);
  });

  it('refuses a branch of another project with its pill text and writes nothing', async () => {
    await seedBranchTask();
    renderStage({ branch: 'hl/ledger-rounding' });
    dragTo({ element: screen.getByTestId('other-row'), isReleased: false });
    expect(screen.getByTestId('task-drag-ghost').textContent).toContain(
      'Only payments-api branches',
    );
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 120, clientY: 80 }));
    });
    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: 'hl/ledger-rounding' }]);
    expect(screen.queryByText(/is on/)).toBeNull();
  });

  it('says Already here over its own branch and writes nothing', async () => {
    await seedBranchTask();
    renderStage({ branch: 'hl/ledger-rounding' });
    dragTo({ element: screen.getByTestId('here-row') });
    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: 'hl/ledger-rounding' }]);
    expect(screen.getByRole('status').textContent).toBe('HL-204: drag cancelled');
  });

  it('cancels on Escape and on a drop outside any target', async () => {
    await seedBranchTask();
    renderStage({ branch: 'hl/ledger-rounding' });
    dragTo({ element: screen.getByTestId('own-row'), isReleased: false });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
    });
    expect(screen.queryByTestId('task-drag-ghost')).toBeNull();
    expect(screen.queryByLabelText('Drop to put on the session')).toBeNull();
    dragTo({ element: null });
    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: 'hl/ledger-rounding' }]);
  });

  it('keeps a click under 5px opening the issue', async () => {
    await seedBranchTask();
    renderStage({ branch: 'hl/ledger-rounding' });
    const chip = screen.getByRole('button', { name: /^Open HL-204/ });
    fireEvent.pointerDown(chip, { button: 0, clientX: 10, clientY: 10 });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 12, clientY: 11 }));
    });
    await act(async () => {
      fireEvent.click(chip);
    });
    expect(useAppStore.getState().focusedExternalTask[SESSION_ID]?.externalId).toBe(
      TASK.externalId,
    );
  });

  it('does not open the issue when a drag is released over the chip itself', async () => {
    await seedBranchTask();
    renderStage({ branch: 'hl/ledger-rounding' });
    dragTo({ element: null });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Open HL-204/ }));
    });
    expect(useAppStore.getState().focusedExternalTask[SESSION_ID]).toBeUndefined();
  });

  it('announces the start, the target and the result', async () => {
    await seedBranchTask();
    renderStage({ branch: 'hl/ledger-rounding' });
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    const chip = screen.getByRole('button', { name: /^Open HL-204/ });
    fireEvent.pointerDown(chip, { button: 0, clientX: 10, clientY: 10 });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 40, clientY: 40 }));
    });
    expect(status.textContent).toBe('Dragging HL-204');
    hoverOver({ element: screen.getByTestId('own-row') });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 60 }));
    });
    expect(status.textContent).toBe('HL-204: Move to payments-api / hl/notify-retry');
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 60, clientY: 60 }));
    });
    expect(status.textContent).toBe('HL-204: Moved to payments-api / hl/notify-retry');
  });

  it('does not start from the unlink button of the chip', async () => {
    await useAppStore
      .getState()
      .linkSessionExternalTask(SESSION_ID, { ...TASK, branch: 'hl/notify-retry' });
    await seedBranchTask();
    renderStage({ branch: 'hl/ledger-rounding' });
    const unlink = screen.getByRole('button', { name: /^Take off/ });
    fireEvent.pointerDown(unlink, { button: 0, clientX: 10, clientY: 10 });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 90, clientY: 90 }));
    });
    expect(screen.queryByLabelText('Drop to put on the session')).toBeNull();
  });
});
