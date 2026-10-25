import type { InvokeArgs } from '@tauri-apps/api/core';
import { mockSceneIpc } from './mockSceneIpc';
import { payloadString } from './audit/ipcPayload';

type SettingRow = {
  readonly key: string;
  readonly value: string;
  readonly updated_at: number;
};

type FallbackParams = {
  readonly command: string;
  readonly payload: InvokeArgs | undefined;
};

type Seed = {
  readonly settings?: Readonly<Record<string, string>>;
  readonly workspaceValues?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly liveSessionIds?: (workspaceId: string) => ReadonlyArray<string>;
  readonly liveAutoTrees?: number;
  readonly fallback?: (params: FallbackParams) => unknown;
};

const SETTING_BY_KEY = /FROM settings WHERE key = \?/;
const WORKSPACE_VALUE = /FROM workspace_values WHERE workspace_id = \? AND key = \?/;
const WORKSPACE_VALUE_INSERT_IF_ABSENT = /INSERT INTO workspace_values[\s\S]*DO NOTHING/;
const WORKSPACE_VALUE_UPSERT = /INSERT INTO workspace_values[\s\S]*DO UPDATE/;
const WORKSPACE_VALUE_REPLACE_IF_UNCHANGED =
  /UPDATE workspace_values SET value = \?, updated_at = \? WHERE workspace_id = \? AND key = \? AND value = \?/;
const SETTINGS_BY_PREFIX = /FROM settings WHERE substr\(key, 1, \?\) = \?/;
const LIVE_AUTO_TREES = /FROM auto_trees WHERE phase IN/;
const LIVE_SESSIONS = /FROM sessions WHERE workspace_id = \? AND deleted_at IS NULL/;
const INSERT_IF_ABSENT = /INSERT INTO settings[\s\S]*ON CONFLICT\(key\) DO NOTHING/;
const UPSERT = /INSERT INTO settings[\s\S]*DO UPDATE/;
const REPLACE_IF_UNCHANGED =
  /UPDATE settings SET value = \?, updated_at = \? WHERE key = \? AND value = \?/;
const DELETE_SETTING = /DELETE FROM settings WHERE key = \?/;

const paramsOf = ({
  payload,
}: {
  readonly payload: InvokeArgs | undefined;
}): ReadonlyArray<unknown> => {
  if (payload === undefined || Array.isArray(payload) || payload instanceof ArrayBuffer) {
    return [];
  }
  if (payload instanceof Uint8Array) {
    return [];
  }
  const params = payload['params'];
  return Array.isArray(params) ? params : [];
};

type SlotParams = {
  readonly workspaceId: unknown;
  readonly key: unknown;
};

const slotOf = ({ workspaceId, key }: SlotParams): string =>
  `${String(workspaceId)}\u0000${String(key)}`;

const normalized = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

const rowOf = ({
  key,
  value,
}: {
  readonly key: unknown;
  readonly value: unknown;
}): SettingRow | null =>
  typeof key === 'string' && typeof value === 'string'
    ? { key, value, updated_at: Date.now() }
    : null;

export const installSceneDatabase = ({
  settings = {},
  workspaceValues = {},
  liveSessionIds,
  liveAutoTrees = 0,
  fallback,
}: Seed = {}): void => {
  const database = {
    settings: new Map<string, SettingRow>(
      Object.entries(settings).map(([key, value]) => [key, { key, value, updated_at: 0 }]),
    ),
  };

  const values = new Map<string, string>(
    Object.entries(workspaceValues).flatMap(([workspaceId, held]) =>
      Object.entries(held).map(([key, value]) => [slotOf({ workspaceId, key }), value] as const),
    ),
  );

  const select = ({
    sql,
    params,
  }: {
    readonly sql: string;
    readonly params: ReadonlyArray<unknown>;
  }) => {
    if (WORKSPACE_VALUE.test(sql)) {
      const value = values.get(slotOf({ workspaceId: params[0], key: params[1] }));
      return value === undefined ? [] : [{ value }];
    }
    if (SETTING_BY_KEY.test(sql)) {
      const row = database.settings.get(String(params[0]));
      return row === undefined ? [] : [row];
    }
    if (SETTINGS_BY_PREFIX.test(sql)) {
      const prefix = String(params[1]);
      return [...database.settings.values()].filter((row) => row.key.startsWith(prefix));
    }
    if (LIVE_AUTO_TREES.test(sql)) {
      return [{ live: liveAutoTrees }];
    }
    if (LIVE_SESSIONS.test(sql)) {
      return (liveSessionIds?.(String(params[0])) ?? []).map((id) => ({ id }));
    }
    return undefined;
  };

  const execute = ({
    sql,
    params,
  }: {
    readonly sql: string;
    readonly params: ReadonlyArray<unknown>;
  }) => {
    if (WORKSPACE_VALUE_INSERT_IF_ABSENT.test(sql)) {
      const slot = slotOf({ workspaceId: params[0], key: params[1] });
      if (typeof params[2] !== 'string' || values.has(slot)) {
        return { rowsAffected: 0 };
      }
      values.set(slot, params[2]);
      return { rowsAffected: 1 };
    }
    if (WORKSPACE_VALUE_UPSERT.test(sql)) {
      if (typeof params[2] !== 'string') {
        return { rowsAffected: 0 };
      }
      values.set(slotOf({ workspaceId: params[0], key: params[1] }), params[2]);
      return { rowsAffected: 1 };
    }
    if (WORKSPACE_VALUE_REPLACE_IF_UNCHANGED.test(sql)) {
      const slot = slotOf({ workspaceId: params[2], key: params[3] });
      if (typeof params[0] !== 'string' || values.get(slot) !== params[4]) {
        return { rowsAffected: 0 };
      }
      values.set(slot, params[0]);
      return { rowsAffected: 1 };
    }
    if (INSERT_IF_ABSENT.test(sql)) {
      const row = rowOf({ key: params[0], value: params[1] });
      if (row === null || database.settings.has(row.key)) {
        return { rowsAffected: 0 };
      }
      database.settings.set(row.key, row);
      return { rowsAffected: 1 };
    }
    if (UPSERT.test(sql)) {
      const row = rowOf({ key: params[0], value: params[1] });
      if (row === null) {
        return { rowsAffected: 0 };
      }
      database.settings.set(row.key, row);
      return { rowsAffected: 1 };
    }
    if (REPLACE_IF_UNCHANGED.test(sql)) {
      const current = database.settings.get(String(params[2]));
      const row = rowOf({ key: params[2], value: params[0] });
      if (current === undefined || row === null || current.value !== params[3]) {
        return { rowsAffected: 0 };
      }
      database.settings.set(row.key, row);
      return { rowsAffected: 1 };
    }
    if (DELETE_SETTING.test(sql)) {
      return { rowsAffected: database.settings.delete(String(params[0])) ? 1 : 0 };
    }
    return { rowsAffected: 1 };
  };

  mockSceneIpc((command, payload) => {
    const sql = normalized(payloadString({ payload, key: 'sql' }) ?? '');
    const params = paramsOf({ payload });
    if (command === 'db_select') {
      return select({ sql, params });
    }
    if (command === 'db_execute') {
      return execute({ sql, params });
    }
    return fallback?.({ command, payload });
  });
};
