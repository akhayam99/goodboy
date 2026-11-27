import { brandId, type Reminder, type ReminderId, type WorkspaceId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertRow } from '../test-helpers/migration-rows';
import {
  fireReminder,
  insertReminder,
  listReminders,
  markReminderDone,
  reopenReminder,
  snoozeReminder,
} from './reminder';

const WORKSPACE = brandId<WorkspaceId>({ value: 'w1' });
const OTHER_WORKSPACE = brandId<WorkspaceId>({ value: 'w2' });

const PING: Reminder = {
  id: brandId<ReminderId>({ value: 'rem-ping' }),
  workspaceId: WORKSPACE,
  text: 'Ping Teo about notify-relay',
  trigger: 'time',
  dueAt: 200,
  target: null,
  snoozedUntil: null,
  doneAt: null,
  createdAt: 10,
};

const MERGE: Reminder = {
  id: brandId<ReminderId>({ value: 'rem-merge' }),
  workspaceId: WORKSPACE,
  text: 'Merge ledger-core when CI is green',
  trigger: 'ci_green',
  dueAt: null,
  target: { kind: 'pull_request', id: 'ledger-core#18' },
  snoozedUntil: null,
  doneAt: null,
  createdAt: 20,
};

type DatabaseParams = {
  readonly db: Database;
};

const seedWorkspaces = async ({ db }: DatabaseParams): Promise<void> => {
  await insertRow({
    db,
    table: 'workspaces',
    row: {
      id: WORKSPACE,
      slug: '/tmp/harborline',
      name: 'Harborline',
      created_at: 1,
      updated_at: 1,
    },
  });
  await insertRow({
    db,
    table: 'workspaces',
    row: {
      id: OTHER_WORKSPACE,
      slug: '/tmp/cascadia',
      name: 'Cascadia',
      created_at: 1,
      updated_at: 1,
    },
  });
};

describe('reminder queries', () => {
  it('lists the reminders of the workspace it names, timed ones first', async () => {
    const db = await makeMigratedTestDatabase();
    await seedWorkspaces({ db });
    await insertReminder({ db, reminder: MERGE });
    await insertReminder({ db, reminder: PING });
    await insertReminder({
      db,
      reminder: {
        ...PING,
        id: brandId<ReminderId>({ value: 'rem-other' }),
        workspaceId: OTHER_WORKSPACE,
      },
    });

    expect(await listReminders({ db, workspaceId: WORKSPACE, doneSince: 0 })).toEqual([
      PING,
      MERGE,
    ]);
  });

  it('marks a reminder done once and leaves out one done before the shown window', async () => {
    const db = await makeMigratedTestDatabase();
    await seedWorkspaces({ db });
    await insertReminder({ db, reminder: PING });

    expect(
      await markReminderDone({ db, workspaceId: WORKSPACE, reminderId: PING.id, doneAt: 300 }),
    ).toBe(true);
    expect(
      await markReminderDone({ db, workspaceId: WORKSPACE, reminderId: PING.id, doneAt: 400 }),
    ).toBe(false);

    expect(await listReminders({ db, workspaceId: WORKSPACE, doneSince: 300 })).toEqual([
      { ...PING, doneAt: 300 },
    ]);
    expect(await listReminders({ db, workspaceId: WORKSPACE, doneSince: 301 })).toEqual([]);
  });

  it('reopens only the done it made, and never in another workspace', async () => {
    const db = await makeMigratedTestDatabase();
    await seedWorkspaces({ db });
    await insertReminder({ db, reminder: PING });
    await markReminderDone({ db, workspaceId: WORKSPACE, reminderId: PING.id, doneAt: 300 });

    expect(
      await reopenReminder({ db, workspaceId: OTHER_WORKSPACE, reminderId: PING.id, doneAt: 300 }),
    ).toBe(false);
    expect(
      await reopenReminder({ db, workspaceId: WORKSPACE, reminderId: PING.id, doneAt: 299 }),
    ).toBe(false);
    expect(
      await reopenReminder({ db, workspaceId: WORKSPACE, reminderId: PING.id, doneAt: 300 }),
    ).toBe(true);

    expect(await listReminders({ db, workspaceId: WORKSPACE, doneSince: 0 })).toEqual([PING]);
  });

  it('snoozes an open reminder and refuses a done one', async () => {
    const db = await makeMigratedTestDatabase();
    await seedWorkspaces({ db });
    await insertReminder({ db, reminder: PING });
    await insertReminder({ db, reminder: MERGE });
    await markReminderDone({ db, workspaceId: WORKSPACE, reminderId: MERGE.id, doneAt: 300 });

    expect(
      await snoozeReminder({ db, workspaceId: WORKSPACE, reminderId: PING.id, snoozedUntil: 900 }),
    ).toBe(true);
    expect(
      await snoozeReminder({ db, workspaceId: WORKSPACE, reminderId: MERGE.id, snoozedUntil: 900 }),
    ).toBe(false);

    expect(await listReminders({ db, workspaceId: WORKSPACE, doneSince: 0 })).toEqual([
      { ...PING, snoozedUntil: 900 },
      { ...MERGE, doneAt: 300 },
    ]);
  });

  it('fires a fact reminder once and never a timed or done one', async () => {
    const db = await makeMigratedTestDatabase();
    await seedWorkspaces({ db });
    await insertReminder({ db, reminder: PING });
    await insertReminder({ db, reminder: MERGE });

    expect(
      await fireReminder({ db, workspaceId: WORKSPACE, reminderId: MERGE.id, firedAt: 400 }),
    ).toBe(true);
    expect(
      await fireReminder({ db, workspaceId: WORKSPACE, reminderId: MERGE.id, firedAt: 500 }),
    ).toBe(false);
    expect(
      await fireReminder({ db, workspaceId: WORKSPACE, reminderId: PING.id, firedAt: 500 }),
    ).toBe(false);
    expect(
      await fireReminder({ db, workspaceId: OTHER_WORKSPACE, reminderId: MERGE.id, firedAt: 500 }),
    ).toBe(false);

    expect(await listReminders({ db, workspaceId: WORKSPACE, doneSince: 0 })).toEqual([
      PING,
      { ...MERGE, dueAt: 400 },
    ]);
  });
});
