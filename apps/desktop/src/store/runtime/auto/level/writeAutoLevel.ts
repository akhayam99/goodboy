import type { AutoLevel } from '@goodboy/core';
import {
  getWorkspaceValue,
  insertWorkspaceValueIfAbsent,
  replaceWorkspaceValueIfUnchanged,
  type Database,
} from '@goodboy/db';
import { autoLevelSetting, type AutoLevelTarget } from './autoLevelSetting';
import { parseAutoLevelSetting } from './parseAutoLevelSetting';

type Params = {
  readonly db: Database;
  readonly target: AutoLevelTarget;
  readonly level: AutoLevel;
};

const MAX_ATTEMPTS = 2;

export const writeAutoLevel = async ({ db, target, level }: Params): Promise<void> => {
  const initial = await autoLevelSetting({ db, target });
  const workspaceId = initial.workspaceId;
  const key = 'auto.level';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const raw = attempt === 0 ? initial.raw : await getWorkspaceValue({ db, workspaceId, key });
    const current = parseAutoLevelSetting({ raw });
    const previous =
      'sessionId' in target ? current.sessions[target.sessionId] : current.defaultLevel;
    if (previous === level) {
      return;
    }
    const next =
      'sessionId' in target
        ? { ...current, sessions: { ...current.sessions, [target.sessionId]: level } }
        : { ...current, defaultLevel: level };
    const value = JSON.stringify(next);
    const isWritten =
      raw === null
        ? await insertWorkspaceValueIfAbsent({ db, workspaceId, key, value })
        : await replaceWorkspaceValueIfUnchanged({ db, workspaceId, key, expected: raw, value });
    if (isWritten) {
      return;
    }
  }
  throw new Error('The Auto level changed in another window. Pick it again.');
};
