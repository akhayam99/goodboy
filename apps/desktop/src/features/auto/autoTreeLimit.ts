import { AUTO_DEFAULT_TREE_CAP_USD } from '@goodboy/core';
import {
  getSetting,
  insertSettingIfAbsent,
  replaceSettingIfUnchanged,
  type Database,
} from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';

export const AUTO_TREE_LIMIT_DEFAULT_USD = AUTO_DEFAULT_TREE_CAP_USD;

type KeyParams = {
  readonly workspaceId: WorkspaceId;
};

export const autoTreeLimitKey = ({ workspaceId }: KeyParams): string =>
  `auto.treeLimitUsd.${workspaceId}`;

type RawParams = {
  readonly raw: string | null | undefined;
};

export const parseAutoTreeLimit = ({ raw }: RawParams): number | null => {
  if (raw === null || raw === undefined) {
    return null;
  }
  const amount = Number.parseFloat(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

type ReadParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const readAutoTreeLimit = async ({ db, workspaceId }: ReadParams): Promise<number | null> =>
  parseAutoTreeLimit({ raw: await getSetting(db, autoTreeLimitKey({ workspaceId })) });

type WriteParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly usd: number;
};

const MAX_ATTEMPTS = 2;

export const writeAutoTreeLimit = async ({ db, workspaceId, usd }: WriteParams): Promise<void> => {
  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error('The Auto spend cap must be more than zero');
  }
  const key = autoTreeLimitKey({ workspaceId });
  const value = String(usd);
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    const raw = await getSetting(db, key);
    if (raw === value) {
      return;
    }
    const isWritten =
      raw === null
        ? await insertSettingIfAbsent({ db, key, value })
        : await replaceSettingIfUnchanged(db, { key, expected: raw, value });
    if (isWritten) {
      return;
    }
  }
  throw new Error('The Auto spend cap changed in another window, try again');
};
