import {
  deleteSettingIfUnchanged,
  getSetting,
  insertSettingIfAbsent,
  replaceSettingIfUnchanged,
  type Database,
} from '@goodboy/db';
import type { RunRouteShape, SessionId, WorkspaceId } from '@goodboy/types';

export type RunDefault = 'auto' | RunRouteShape;

export type RunDefaultScope =
  | Readonly<{ kind: 'session'; sessionId: SessionId }>
  | Readonly<{ kind: 'workspace'; workspaceId: WorkspaceId }>;

type KeyParams = {
  readonly scope: RunDefaultScope;
};

export const runDefaultKey = ({ scope }: KeyParams): string =>
  scope.kind === 'session'
    ? `runs.defaultShape.session.${scope.sessionId}`
    : `runs.defaultShape.${scope.workspaceId}`;

type RawParams = {
  readonly raw: string | null | undefined;
};

export const parseRunDefault = ({ raw }: RawParams): RunDefault | null =>
  raw === 'auto' || raw === 'plan' || raw === 'lead' ? raw : null;

type WriteParams = {
  readonly db: Database;
  readonly scope: RunDefaultScope;
  readonly shape: RunDefault | null;
};

type StepParams = {
  readonly db: Database;
  readonly key: string;
  readonly raw: string | null;
  readonly shape: RunDefault | null;
};

const MAX_ATTEMPTS = 2;

const writeStep = ({ db, key, raw, shape }: StepParams): Promise<boolean> => {
  if (shape === null) {
    return raw === null
      ? Promise.resolve(true)
      : deleteSettingIfUnchanged({ db, key, expected: raw });
  }
  return raw === null
    ? insertSettingIfAbsent({ db, key, value: shape })
    : replaceSettingIfUnchanged(db, { key, expected: raw, value: shape });
};

export const writeRunDefault = async ({ db, scope, shape }: WriteParams): Promise<void> => {
  const key = runDefaultKey({ scope });
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    const raw = await getSetting(db, key);
    if (raw === shape) {
      return;
    }
    const isWritten = await writeStep({ db, key, raw, shape });
    if (isWritten) {
      return;
    }
  }
  throw new Error('The default changed in another window, try again');
};
