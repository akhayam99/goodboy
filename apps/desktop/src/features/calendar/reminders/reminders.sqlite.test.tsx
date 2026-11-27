// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { insertWorkspace, listReminders } from '@goodboy/db';
import {
  brandId,
  type CalendarEvent,
  type CalendarSourceId,
  type IsoDateTime,
  type PullRequestState,
  type Reminder,
  type ReminderTarget,
  type ReminderTrigger,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, anAgent, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { runObjectAction } from '../../actions/registry';
import { bindTarget } from '../../actions/registry';
import type { ActionEnv, ObjectTarget } from '../../actions/types';
import { useReminderTriggers } from './hooks/useReminderTriggers';
import { useDueReminders } from './ReminderNeedsYouCards/useDueReminders';
import { pullRequestReminderIdOf } from './pullRequestReminderIdOf';
import { ReminderNeedsYouCards } from './ReminderNeedsYouCards';
import { snoozeTimesOf } from './snoozeTimesOf';

const HOUR_MS = 3_600_000;
const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const PR_NUMBER = 412;

let useAppStore: StoryStore;
let workspaceId: WorkspaceId;

const prOf = ({ checks }: { readonly checks: PullRequestState['checks'] }): PullRequestState => ({
  number: PR_NUMBER,
  title: 'Settle the duplicate credit',
  url: 'https://github.com/harborline/payments-api/pull/412',
  state: 'open',
  mergeable: true,
  checks,
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-11-27T10:00:00.000Z',
});

const setChecks = ({ checks }: { readonly checks: PullRequestState['checks'] }): void => {
  useAppStore.setState({
    sessionGithub: {
      [SESSION]: {
        pr: prOf({ checks }),
        linkedIssues: [],
        fetchedAt: null,
        failedAt: null,
        loading: false,
        error: null,
        detail: null,
        detailFetchedAt: null,
        detailLoading: false,
        detailError: null,
      },
    },
  });
};

const CALL: CalendarEvent = {
  id: 'src-northwind:standup:1000',
  sourceId: brandId<CalendarSourceId>({ value: 'src-northwind' }),
  calendarId: 'team',
  uid: 'standup@northwind',
  title: 'ledger-core standup',
  start: 0,
  end: 0,
  isAllDay: false,
  location: '',
  callLink: null,
  isCallLinkTrusted: false,
  attendees: [],
  status: 'confirmed',
  isBusyOnly: false,
};

const setCallEnd = ({ end }: { readonly end: number }): void => {
  useAppStore.setState({
    calendarDay: {
      range: { from: 0, to: end + HOUR_MS },
      events: [{ ...CALL, start: end - HOUR_MS, end }],
      failedSources: [],
    },
  });
};

type AddParams = {
  readonly text: string;
  readonly trigger: ReminderTrigger;
  readonly dueAt?: number | null;
  readonly target?: ReminderTarget | null;
};

const add = async ({ text, trigger, dueAt = null, target = null }: AddParams) => {
  const added = await useAppStore
    .getState()
    .addReminder({ workspaceId, text, trigger, dueAt, target });
  if (!added.isOk) {
    throw new Error('reminder not added');
  }
  return added.value;
};

const PR_TARGET: ReminderTarget = {
  kind: 'pull_request',
  id: pullRequestReminderIdOf({ sessionId: SESSION, mountId: null, prNumber: PR_NUMBER }),
};

const stored = async (): Promise<ReadonlyArray<Reminder>> =>
  listReminders({ db: storySqlite(), workspaceId, doneSince: 0 });

const countFires = () => {
  const db = storySqlite();
  const original = db.execute.bind(db);
  const fires: Array<string> = [];
  vi.spyOn(db, 'execute').mockImplementation(async (sql, params) => {
    if (sql.includes('due_at IS NULL')) {
      fires.push(sql);
    }
    return original(sql, params);
  });
  return fires;
};

const dueTexts = () => {
  const { result } = renderHook(() => useDueReminders({ workspaceId }));
  return result.current.map((reminder) => reminder.text);
};

const envOf = (): ActionEnv => ({
  getState: useAppStore.getState,
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
});

const reminderTarget = ({ reminder }: { readonly reminder: Reminder }): ObjectTarget => ({
  kind: 'reminder',
  workspaceId,
  reminderId: reminder.id,
});

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  workspaceId = nextWorkspaceId();
  await insertWorkspace({ db, workspace: buildStoryWorkspace({ id: workspaceId }) });
  useAppStore.setState({
    currentWorkspaceId: workspaceId,
    sessions: [aSession({ id: SESSION, workspaceId, goal: 'Settle the duplicate credit' })],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('reminders that land in needs you', () => {
  it('shows a timed reminder only once its time has come', async () => {
    await add({ text: 'Ping Teo about notify-relay', trigger: 'time', dueAt: Date.now() - 1000 });
    await add({ text: 'Review payments-api', trigger: 'time', dueAt: Date.now() + HOUR_MS });

    expect(dueTexts()).toEqual(['Ping Teo about notify-relay']);
  });

  it('fires a CI green reminder once, and it stays when the checks turn red again', async () => {
    setChecks({ checks: 'pending' });
    await add({ text: 'CI is green on #412', trigger: 'ci_green', target: PR_TARGET });
    const fires = countFires();
    renderHook(() => useReminderTriggers({}));
    expect(dueTexts()).toEqual([]);

    act(() => setChecks({ checks: 'success' }));
    await vi.waitFor(() => expect(dueTexts()).toEqual(['CI is green on #412']));
    act(() => setChecks({ checks: 'failure' }));
    act(() => setChecks({ checks: 'success' }));

    expect(dueTexts()).toEqual(['CI is green on #412']);
    expect(fires).toHaveLength(1);
    expect((await stored())[0]?.dueAt).not.toBeNull();
  });

  it('fires an agent done reminder once, after the agent that was running finished', async () => {
    await add({
      text: 'Read the ledger-core plan',
      trigger: 'agent_done',
      target: { kind: 'session', id: SESSION },
    });
    const fires = countFires();
    const agent = anAgent({ sessionId: SESSION, kind: 'implementer', status: 'running' });
    useAppStore.setState({ sessionPhaseRuns: { [SESSION]: [agent] } });
    renderHook(() => useReminderTriggers({}));
    expect(dueTexts()).toEqual([]);

    const finishedAt = brandId<IsoDateTime>({ value: new Date(Date.now() + 1000).toISOString() });
    act(() =>
      useAppStore.setState({
        sessionPhaseRuns: {
          [SESSION]: [{ ...agent, status: 'completed', lastFinishedAt: finishedAt }],
        },
      }),
    );
    await vi.waitFor(() => expect(dueTexts()).toEqual(['Read the ledger-core plan']));
    act(() => useAppStore.setState({ sessionPhaseRuns: { [SESSION]: [{ ...agent }] } }));

    expect(fires).toHaveLength(1);
  });

  it('fires a call end reminder once the call has ended', async () => {
    setCallEnd({ end: Date.now() + HOUR_MS });
    await add({
      text: 'Send the Northwind notes',
      trigger: 'call_end',
      target: { kind: 'event', id: CALL.id },
    });
    const fires = countFires();
    renderHook(() => useReminderTriggers({}));
    expect(dueTexts()).toEqual([]);

    act(() => setCallEnd({ end: Date.now() - HOUR_MS }));

    await vi.waitFor(() => expect(dueTexts()).toEqual(['Send the Northwind notes']));
    expect(fires).toHaveLength(1);
  });

  it('keeps a fact reminder waiting when the write fails', async () => {
    setChecks({ checks: 'success' });
    await add({ text: 'CI is green on #412', trigger: 'ci_green', target: PR_TARGET });
    const db = storySqlite();
    const original = db.execute.bind(db);
    vi.spyOn(db, 'execute').mockImplementation(async (sql, params) => {
      if (sql.includes('due_at IS NULL')) {
        throw new Error('disk unavailable');
      }
      return original(sql, params);
    });

    renderHook(() => useReminderTriggers({}));

    await vi.waitFor(() =>
      expect(
        useAppStore
          .getState()
          .notifications.filter((notification) => notification.kind === 'error')
          .map((notification) => notification.title),
      ).toContain("Couldn't bring the reminder to Needs you"),
    );
    expect(dueTexts()).toEqual([]);
    expect((await stored())[0]?.dueAt).toBeNull();
  });

  it('snoozes a due reminder for an hour from its row menu', async () => {
    const reminder = await add({
      text: 'Ping Teo about notify-relay',
      trigger: 'time',
      dueAt: Date.now() - 1000,
    });

    await runObjectAction({
      target: reminderTarget({ reminder }),
      actionId: 'reminder.snoozeHour',
      env: envOf(),
    });

    expect(dueTexts()).toEqual([]);
    const snoozed = (await stored())[0]?.snoozedUntil ?? 0;
    expect(snoozed).toBeGreaterThan(Date.now() + HOUR_MS - 60_000);
  });

  it('snoozes a due reminder until tomorrow at nine', async () => {
    const reminder = await add({
      text: 'Ping Teo about notify-relay',
      trigger: 'time',
      dueAt: Date.now() - 1000,
    });

    await runObjectAction({
      target: reminderTarget({ reminder }),
      actionId: 'reminder.snoozeTomorrow',
      env: envOf(),
    });

    expect(dueTexts()).toEqual([]);
    expect((await stored())[0]?.snoozedUntil).toBe(
      snoozeTimesOf({ now: Date.now() }).tomorrowMorning,
    );
  });

  it('marks a due reminder done from its row and brings it back with undo', async () => {
    const reminder = await add({
      text: 'Ping Teo about notify-relay',
      trigger: 'time',
      dueAt: Date.now() - 1000,
    });

    await runObjectAction({
      target: reminderTarget({ reminder }),
      actionId: 'reminder.markDone',
      env: envOf(),
    });
    expect(dueTexts()).toEqual([]);

    expect(await useAppStore.getState().undoLastOperation()).toBe(true);
    expect(dueTexts()).toEqual(['Ping Teo about notify-relay']);
  });

  it('opens the pull request a reminder names', async () => {
    setChecks({ checks: 'success' });
    const reminder = await add({
      text: 'CI is green on #412',
      trigger: 'ci_green',
      dueAt: Date.now() - 1000,
      target: PR_TARGET,
    });
    const navigate = vi.spyOn(useAppStore.getState(), 'navigate');

    render(<ReminderNeedsYouCards workspaceId={workspaceId} reminders={[reminder]} />);
    screen.getByText('Settle the duplicate credit');
    screen.getByRole('button', { name: 'Open CI is green on #412, reminder' }).click();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(navigate.mock.calls[0]?.[0].to).toMatchObject({ at: 'session', sessionId: SESSION });
  });

  it('falls back to plain text and opens Calendar when the target is gone', async () => {
    const reminder = await add({
      text: 'Read the ledger-core plan',
      trigger: 'agent_done',
      dueAt: Date.now() - 1000,
      target: { kind: 'session', id: 'session-gone' },
    });

    render(<ReminderNeedsYouCards workspaceId={workspaceId} reminders={[reminder]} />);
    expect(document.querySelector('[data-slot="card-context"]')).toBeNull();
    screen.getByRole('button', { name: 'Open Read the ledger-core plan, reminder' }).click();

    await vi.waitFor(() =>
      expect(useAppStore.getState().appStudio).toMatchObject({ kind: 'calendar' }),
    );
  });

  it('adds a CI green reminder from the pull request menu once', async () => {
    setChecks({ checks: 'pending' });
    const target: ObjectTarget = { kind: 'pullRequest', sessionId: SESSION, prNumber: PR_NUMBER };
    const entryIds = () =>
      bindTarget({ state: useAppStore.getState(), target })
        ?.resolve()
        .map((action) => action.id) ?? [];
    expect(entryIds()).toContain('pullRequest.remindWhenGreen');

    await runObjectAction({ target, actionId: 'pullRequest.remindWhenGreen', env: envOf() });

    expect(
      (await stored()).map((reminder) => [reminder.text, reminder.trigger, reminder.target]),
    ).toEqual([['CI is green on #412', 'ci_green', PR_TARGET]]);
    expect(entryIds()).not.toContain('pullRequest.remindWhenGreen');
  });
});
