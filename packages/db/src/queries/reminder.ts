import {
  brandId,
  REMINDER_TARGET_KINDS,
  REMINDER_TRIGGERS,
  type Reminder,
  type ReminderId,
  type ReminderTarget,
  type ReminderTargetKind,
  type ReminderTrigger,
  type WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

type ReminderRow = {
  readonly id: string;
  readonly workspace_id: string;
  readonly text: string;
  readonly trigger_kind: string;
  readonly due_at: number | null;
  readonly target_kind: string | null;
  readonly target_id: string | null;
  readonly snoozed_until: number | null;
  readonly done_at: number | null;
  readonly created_at: number;
};

type ValueParams = {
  readonly value: string;
};

const triggerOf = ({ value }: ValueParams): ReminderTrigger | null =>
  REMINDER_TRIGGERS.find((trigger) => trigger === value) ?? null;

const targetKindOf = ({ value }: ValueParams): ReminderTargetKind | null =>
  REMINDER_TARGET_KINDS.find((kind) => kind === value) ?? null;

type RowParams = {
  readonly row: ReminderRow;
};

const targetOf = ({ row }: RowParams): ReminderTarget | null => {
  if (row.target_kind === null || row.target_id === null) {
    return null;
  }
  const kind = targetKindOf({ value: row.target_kind });
  return kind === null ? null : { kind, id: row.target_id };
};

const reminderOf = ({ row }: RowParams): Reminder | null => {
  const trigger = triggerOf({ value: row.trigger_kind });
  if (trigger === null) {
    return null;
  }
  return {
    id: brandId<ReminderId>({ value: row.id }),
    workspaceId: brandId<WorkspaceId>({ value: row.workspace_id }),
    text: row.text,
    trigger,
    dueAt: row.due_at,
    target: targetOf({ row }),
    snoozedUntil: row.snoozed_until,
    doneAt: row.done_at,
    createdAt: row.created_at,
  };
};

type ListParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly doneSince: number;
};

export const listReminders = async ({
  db,
  workspaceId,
  doneSince,
}: ListParams): Promise<ReadonlyArray<Reminder>> => {
  const rows = await db.select<ReminderRow>(
    `SELECT id, workspace_id, text, trigger_kind, due_at, target_kind, target_id,
       snoozed_until, done_at, created_at
     FROM reminders
     WHERE workspace_id = ? AND (done_at IS NULL OR done_at >= ?)
     ORDER BY due_at IS NULL, due_at, created_at, id`,
    [workspaceId, doneSince],
  );
  return rows.flatMap((row) => {
    const reminder = reminderOf({ row });
    return reminder === null ? [] : [reminder];
  });
};

type ReadParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly reminderId: ReminderId;
};

export const readReminder = async ({
  db,
  workspaceId,
  reminderId,
}: ReadParams): Promise<Reminder | null> => {
  const rows = await db.select<ReminderRow>(
    `SELECT id, workspace_id, text, trigger_kind, due_at, target_kind, target_id,
       snoozed_until, done_at, created_at
     FROM reminders
     WHERE id = ? AND workspace_id = ?`,
    [reminderId, workspaceId],
  );
  return rows[0] === undefined ? null : reminderOf({ row: rows[0] });
};

type InsertParams = {
  readonly db: Database;
  readonly reminder: Reminder;
};

export const insertReminder = async ({ db, reminder }: InsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO reminders
       (id, workspace_id, text, trigger_kind, due_at, target_kind, target_id,
        snoozed_until, done_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reminder.id,
      reminder.workspaceId,
      reminder.text,
      reminder.trigger,
      reminder.dueAt,
      reminder.target?.kind ?? null,
      reminder.target?.id ?? null,
      reminder.snoozedUntil,
      reminder.doneAt,
      reminder.createdAt,
      reminder.createdAt,
    ],
  );
};

type MarkParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly reminderId: ReminderId;
  readonly doneAt: number;
};

export const markReminderDone = async ({
  db,
  workspaceId,
  reminderId,
  doneAt,
}: MarkParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE reminders SET done_at = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ? AND done_at IS NULL`,
    [doneAt, doneAt, reminderId, workspaceId],
  );
  return result.rowsAffected > 0;
};

export const reopenReminder = async ({
  db,
  workspaceId,
  reminderId,
  doneAt,
}: MarkParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE reminders SET done_at = NULL, updated_at = ?
     WHERE id = ? AND workspace_id = ? AND done_at = ?`,
    [Date.now(), reminderId, workspaceId, doneAt],
  );
  return result.rowsAffected > 0;
};

type SnoozeParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly reminderId: ReminderId;
  readonly snoozedUntil: number;
};

export const snoozeReminder = async ({
  db,
  workspaceId,
  reminderId,
  snoozedUntil,
}: SnoozeParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE reminders SET snoozed_until = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ? AND done_at IS NULL`,
    [snoozedUntil, Date.now(), reminderId, workspaceId],
  );
  return result.rowsAffected > 0;
};

type FireParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly reminderId: ReminderId;
  readonly firedAt: number;
};

export const fireReminder = async ({
  db,
  workspaceId,
  reminderId,
  firedAt,
}: FireParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE reminders SET due_at = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ? AND due_at IS NULL AND done_at IS NULL
       AND trigger_kind <> 'time'`,
    [firedAt, firedAt, reminderId, workspaceId],
  );
  return result.rowsAffected > 0;
};
