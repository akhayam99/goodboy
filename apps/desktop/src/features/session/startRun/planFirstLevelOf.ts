import type { AutoLevel } from '@goodboy/core/auto';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { tauriDatabase } from '../../../shared/lib/db';
import { readAutoLevel } from '../../../store/runtime/auto/level/readAutoLevel';
import { leadDefaultOf, parseRunDefault, runDefaultKey } from './runDefaultSetting';

type Params = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const planFirstLevelOf = async ({
  sessionId,
  workspaceId,
}: Params): Promise<AutoLevel | null> => {
  const { loadSetting } = useAppStore.getState();
  const [sessionRaw, workspaceRaw] = await Promise.all([
    loadSetting(runDefaultKey({ scope: { kind: 'session', sessionId } })),
    loadSetting(runDefaultKey({ scope: { kind: 'workspace', workspaceId } })),
  ]);
  const shape = parseRunDefault({ raw: sessionRaw }) ?? parseRunDefault({ raw: workspaceRaw });
  if (shape === null || !leadDefaultOf({ shape }).shouldAskPlan) {
    return null;
  }
  const current = await readAutoLevel({ db: tauriDatabase, target: { sessionId } });
  return current === 'run' ? 'plan' : null;
};
