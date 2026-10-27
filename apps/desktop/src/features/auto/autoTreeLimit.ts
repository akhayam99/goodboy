import { AUTO_DEFAULT_TREE_CAP_USD } from '@goodboy/core';
import {
  getWorkspaceValue,
  insertWorkspaceValueIfAbsent,
  replaceWorkspaceValueIfUnchanged,
  type Database,
} from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';

export const AUTO_TREE_LIMIT_DEFAULT_USD = AUTO_DEFAULT_TREE_CAP_USD;

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
  parseAutoTreeLimit({
    raw: await getWorkspaceValue({ db, workspaceId, key: 'auto.treeLimitUsd' }),
  });

type WriteParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly usd: number;
};

const MAX_ATTEMPTS = 2;

export const writeAutoTreeLimit = async ({ db, workspaceId, usd }: WriteParams): Promise<void> => {
  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error('The Auto limit must be more than zero');
  }
  const key = 'auto.treeLimitUsd';
  const value = String(usd);
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    const raw = await getWorkspaceValue({ db, workspaceId, key });
    if (raw === value) {
      return;
    }
    const isWritten =
      raw === null
        ? await insertWorkspaceValueIfAbsent({ db, workspaceId, key, value })
        : await replaceWorkspaceValueIfUnchanged({ db, workspaceId, key, expected: raw, value });
    if (isWritten) {
      return;
    }
  }
  throw new Error('The Auto limit changed in another window, try again');
};
