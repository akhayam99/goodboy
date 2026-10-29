import { getSessionById, getWorkspaceValue, type Database } from '@goodboy/db';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { parseAutoLevelSetting, type AutoLevelSettings } from './parseAutoLevelSetting';

export type AutoLevelTarget =
  { readonly sessionId: SessionId } | { readonly workspaceId: WorkspaceId };

type Params = { readonly db: Database; readonly target: AutoLevelTarget };

type AutoLevelSetting = Readonly<{
  workspaceId: WorkspaceId;
  raw: string | null;
  value: AutoLevelSettings;
}>;

export const autoLevelSetting = async ({ db, target }: Params): Promise<AutoLevelSetting> => {
  const session = 'sessionId' in target ? await getSessionById(db, target.sessionId) : null;
  const workspaceId = 'workspaceId' in target ? target.workspaceId : session?.workspaceId;
  if (workspaceId === undefined) {
    throw new Error('The session no longer exists.');
  }
  const raw = await getWorkspaceValue({ db, workspaceId, key: 'auto.level' });
  return { workspaceId, raw, value: parseAutoLevelSetting({ raw }) };
};
