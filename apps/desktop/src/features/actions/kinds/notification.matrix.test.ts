import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertNotification, insertWorkspace, type Notification } from '@goodboy/db';
import type { IsoDateTime, WorkspaceId } from '@goodboy/types';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import { brandedId } from '../../history/testing/brandedId';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  OPEN_REPORT_SHEET_EVENT,
  type OpenReportSheetDetail,
} from '../../bug-report/openReportSheet';
import { bindTarget } from '../registry';
import type { ActionEnv } from '../types';
import { NOTIFICATION_KIND, type NotificationFacts } from './notification';
import { NOTIFICATIONS_KIND, type NotificationsFacts } from './notifications';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });

const at = ({ minute }: { readonly minute: number }): IsoDateTime =>
  brandedId<IsoDateTime>({ value: new Date(Date.UTC(2026, 9, 2, 9, minute)).toISOString() });

type RowParams = {
  readonly overrides: Partial<Notification>;
};

const row = ({ overrides }: RowParams): Notification => ({
  id: 'n-1',
  ts: at({ minute: 0 }),
  kind: 'error',
  title: 'Webhook redelivery failed',
  body: 'payments-api returned 502',
  severity: 'error',
  sessionId: null,
  workspaceId: WORKSPACE_ID,
  read: false,
  action: null,
  coalesceKey: null,
  actedAt: null,
  ...overrides,
});

const facts = (overrides: Partial<NotificationFacts>): NotificationFacts => ({
  ids: ['n-1'],
  unreadIds: ['n-1'],
  title: 'Webhook redelivery failed',
  body: 'payments-api returned 502',
  severity: 'error',
  open: { label: 'Retry', run: vi.fn() },
  ...overrides,
});

const notificationsFacts = (overrides: Partial<NotificationsFacts>): NotificationsFacts => ({
  totalCount: 6,
  workspaceName: 'Harborline',
  onDeleteAll: vi.fn(async () => undefined),
  unreadCount: 4,
  onMarkAllRead: vi.fn(async () => undefined),
  ...overrides,
});

const inertEnv: ActionEnv = {
  getState: () => {
    throw new Error('this verb does not read the store');
  },
  showToast: vi.fn(),
  copyText: vi.fn(async () => undefined),
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const OPEN = 'notification.open menu';
const MARK_READ = 'notification.markRead hover';
const MARK_UNREAD = 'notification.markUnread menu';
const REPORT = 'notification.report menu';
const COPY = 'notification.copyText menu';
const DELETE = 'notification.delete menu';

const STATES: ReadonlyArray<{
  readonly name: string;
  readonly facts: NotificationFacts;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'unread error with an action',
    facts: facts({}),
    expected: [OPEN, MARK_READ, REPORT, COPY, DELETE],
  },
  {
    name: 'unread warning, no action',
    facts: facts({ severity: 'warning', open: null }),
    expected: [MARK_READ, REPORT, COPY, DELETE],
  },
  {
    name: 'read info, no action',
    facts: facts({ severity: 'info', unreadIds: [], open: null }),
    expected: [MARK_UNREAD, COPY, DELETE],
  },
  {
    name: 'read success with an action',
    facts: facts({ severity: 'success', unreadIds: [] }),
    expected: [OPEN, MARK_UNREAD, COPY, DELETE],
  },
  {
    name: 'group with one unread entry',
    facts: facts({ ids: ['n-3', 'n-2', 'n-1'], unreadIds: ['n-3'], severity: 'info' }),
    expected: [OPEN, MARK_READ, COPY, DELETE],
  },
];

describe('notification kind matrix', () => {
  it.each(STATES)('$name', ({ facts: given, expected }) => {
    expect(matrixOf({ definitions: NOTIFICATION_KIND.actions, facts: given })).toEqual(expected);
  });

  it('labels Open with the verb of the action', () => {
    const open = NOTIFICATION_KIND.actions.find((action) => action.id === 'notification.open');

    expect(open?.shortLabel?.({ facts: facts({}) })).toBe('Retry');
    expect(open?.shortLabel?.({ facts: facts({ open: null }) })).toBe('Open');
  });
});

describe('notifications kind, Mark all read', () => {
  const idsOf = ({ given }: { readonly given: NotificationsFacts }) =>
    matrixOf({ definitions: NOTIFICATIONS_KIND.actions, facts: given });

  it('comes before Delete all and names the scope', () => {
    expect(idsOf({ given: notificationsFacts({}) })).toEqual([
      'notifications.markAllRead menu',
      'notifications.deleteAll menu',
    ]);
    const [markAll] = NOTIFICATIONS_KIND.actions;
    expect(markAll?.description?.({ facts: notificationsFacts({}) })).toBe('In Harborline');
    expect(markAll?.description?.({ facts: notificationsFacts({ workspaceName: null }) })).toBe(
      'In every workspace',
    );
  });

  it('is hidden with nothing unread or without a handler', () => {
    expect(idsOf({ given: notificationsFacts({ unreadCount: 0 }) })).toEqual([
      'notifications.deleteAll menu',
    ]);
    expect(idsOf({ given: notificationsFacts({ onMarkAllRead: undefined }) })).toEqual([
      'notifications.deleteAll menu',
    ]);
    expect(
      idsOf({
        given: {
          totalCount: 2,
          workspaceName: null,
          onDeleteAll: async () => undefined,
        },
      }),
    ).toEqual(['notifications.deleteAll menu']);
  });

  it('asks nothing and runs the handler of the page', async () => {
    const onMarkAllRead = vi.fn(async () => undefined);
    const [markAll] = NOTIFICATIONS_KIND.actions;

    expect(markAll?.confirm).toBeUndefined();
    await markAll?.run({
      facts: notificationsFacts({ onMarkAllRead }),
      env: inertEnv,
      choice: null,
    });

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it('lets a failed write reach the menu so it can say why', async () => {
    const [markAll] = NOTIFICATIONS_KIND.actions;

    await expect(
      markAll?.run({
        facts: notificationsFacts({
          onMarkAllRead: () => Promise.reject(new Error('database is locked')),
        }),
        env: inertEnv,
        choice: null,
      }),
    ).rejects.toThrow('database is locked');
  });
});

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
  await insertNotification(db, row({ overrides: { id: 'n-1', coalesceKey: 'error:webhook' } }));
  await insertNotification(
    db,
    row({
      overrides: {
        id: 'n-2',
        ts: at({ minute: 5 }),
        coalesceKey: 'error:webhook',
      },
    }),
  );
  await insertNotification(
    db,
    row({ overrides: { id: 'n-3', title: 'Sync stalled', read: true, coalesceKey: 'sync' } }),
  );
  useAppStore.setState({ currentWorkspaceId: WORKSPACE_ID, undoStack: [] });
  await useAppStore.getState().loadNotifications();
});

const env = (): ActionEnv => ({
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: vi.fn(async () => undefined),
  origin: 'overflow',
  anchorKey: null,
  viewing: null,
});

type BoundParams = {
  readonly given: NotificationFacts;
};

const bound = ({ given }: BoundParams) => {
  const found = bindTarget({
    state: useAppStore.getState(),
    target: { kind: 'notification', facts: given },
  });
  if (found === null) {
    throw new Error('the notification target did not bind');
  }
  return found;
};

const storedReads = async () =>
  Object.fromEntries(
    (await rowsOf<{ id: string; read: number }>({ sql: 'SELECT id, read FROM notifications' })).map(
      (stored) => [stored.id, stored.read === 1],
    ),
  );

describe('notification verbs write after the database answers', () => {
  it('marks every unread entry of a group read, in the table and in the store', async () => {
    await bound({
      given: facts({ ids: ['n-2', 'n-1'], unreadIds: ['n-2', 'n-1'], open: null }),
    }).run({ actionId: 'notification.markRead', env: env() });

    expect(await storedReads()).toEqual({ 'n-1': true, 'n-2': true, 'n-3': true });
    expect(useAppStore.getState().notifications.every((n) => n.read)).toBe(true);
  });

  it('marks only the newest entry of a read group unread', async () => {
    await useAppStore.getState().markNotificationRead('n-1');
    await useAppStore.getState().markNotificationRead('n-2');

    await bound({
      given: facts({ ids: ['n-2', 'n-1'], unreadIds: [], open: null }),
    }).run({ actionId: 'notification.markUnread', env: env() });

    expect(await storedReads()).toEqual({ 'n-1': true, 'n-2': false, 'n-3': true });
    expect(useAppStore.getState().notifications.find((n) => n.id === 'n-2')?.read).toBe(false);
  });

  it('keeps the row as it was and rejects when the write fails', async () => {
    useAppStore.setState({
      markNotificationRead: vi.fn(() => Promise.reject(new Error('database is locked'))),
    });

    await expect(
      bound({ given: facts({ open: null }) }).run({
        actionId: 'notification.markRead',
        env: env(),
      }),
    ).rejects.toThrow('database is locked');

    expect(useAppStore.getState().notifications.find((n) => n.id === 'n-1')?.read).toBe(false);
    expect(await storedReads()).toEqual({ 'n-1': false, 'n-2': false, 'n-3': true });
  });

  it('deletes the whole group at once and offers one undo', async () => {
    await bound({
      given: facts({ ids: ['n-2', 'n-1'], unreadIds: ['n-2', 'n-1'], open: null }),
    }).run({ actionId: 'notification.delete', env: env() });

    expect(Object.keys(await storedReads())).toEqual(['n-3']);
    expect(useAppStore.getState().notifications.map((n) => n.id)).toEqual(['n-3']);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
  });

  it('lets a failed delete reach the menu and keeps both rows', async () => {
    useAppStore.setState({
      dismissNotificationGroup: vi.fn(() => Promise.reject(new Error('database is locked'))),
    });

    await expect(
      bound({ given: facts({ ids: ['n-1'], open: null }) }).run({
        actionId: 'notification.delete',
        env: env(),
      }),
    ).rejects.toThrow('database is locked');

    expect(Object.keys(await storedReads())).toEqual(['n-1', 'n-2', 'n-3']);
  });

  it('runs the page action for Open', async () => {
    const run = vi.fn();

    await bound({ given: facts({ open: { label: 'Retry', run } }) }).run({
      actionId: 'notification.open',
      env: env(),
    });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('hands the notice to the report sheet', async () => {
    const heard: Array<OpenReportSheetDetail> = [];
    const listener = (event: Event) => {
      if (event instanceof CustomEvent) {
        heard.push(event.detail);
      }
    };
    window.addEventListener(OPEN_REPORT_SHEET_EVENT, listener);

    await bound({ given: facts({}) }).run({ actionId: 'notification.report', env: env() });
    window.removeEventListener(OPEN_REPORT_SHEET_EVENT, listener);

    expect(heard).toEqual([
      { notice: { title: 'Webhook redelivery failed', body: 'payments-api returned 502' } },
    ]);
  });

  it('copies the title and the body', async () => {
    const copyText = vi.fn(async () => undefined);

    await bound({ given: facts({ body: 'payments-api returned 502' }) }).run({
      actionId: 'notification.copyText',
      env: { ...env(), copyText },
    });
    await bound({ given: facts({ body: null }) }).run({
      actionId: 'notification.copyText',
      env: { ...env(), copyText },
    });

    expect(copyText.mock.calls).toEqual([
      [{ text: 'Webhook redelivery failed\npayments-api returned 502' }],
      [{ text: 'Webhook redelivery failed' }],
    ]);
  });

  it('does not bind a group with no entries', () => {
    expect(
      bindTarget({
        state: useAppStore.getState(),
        target: { kind: 'notification', facts: facts({ ids: [], unreadIds: [] }) },
      }),
    ).toBeNull();
  });
});
