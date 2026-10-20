import type { SessionId } from '@goodboy/types';
import { autoChecksKey } from '../../../features/scripts/autoChecksKey';
import {
  buildSessionScripts,
  type RunnableScript,
  type SessionScriptGroup,
} from '../../../features/scripts/buildSessionScripts';
import { parseScriptPins } from '../../../features/scripts/parseScriptPins';
import { scriptPinId } from '../../../features/scripts/scriptPinId';
import type { AppStore } from '../../store';

export type ResolveCheckScriptsParams = Readonly<{
  getState: () => AppStore;
  sessionId: SessionId;
  mountId: string;
}>;

export type CheckScripts = Readonly<{
  group: SessionScriptGroup;
  scripts: ReadonlyArray<RunnableScript>;
  tickedCount: number;
}>;

type GroupParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly mountId: string;
};

const tickedOf = ({ state, sessionId, mountId }: GroupParams): ReadonlyArray<string> => {
  const mount = (state.sessionProjectMounts[sessionId] ?? []).find(
    (candidate) => candidate.mountId === mountId,
  );
  if (mount === undefined) {
    return [];
  }
  return parseScriptPins({ raw: state.settings[autoChecksKey({ projectId: mount.projectId })] });
};

const groupOf = ({ state, sessionId, mountId }: GroupParams): CheckScripts | null => {
  const mount = (state.sessionProjectMounts[sessionId] ?? []).find(
    (candidate) => candidate.mountId === mountId,
  );
  if (mount === undefined) {
    return null;
  }
  const ticked = tickedOf({ state, sessionId, mountId });
  const groups = buildSessionScripts({
    mounts: [mount],
    projects: state.projects,
    saved: Object.values(state.projectScripts).flat(),
    discovered: state.discoveredScripts[sessionId],
    pins: { [mount.projectId]: ticked },
  });
  const group = groups[0];
  if (group === undefined || !group.isReady) {
    return null;
  }
  return {
    group,
    scripts: group.scripts.filter((script) => ticked.includes(scriptPinId(script))),
    tickedCount: ticked.length,
  };
};

export const resolveCheckScripts = async ({
  getState,
  sessionId,
  mountId,
}: ResolveCheckScriptsParams): Promise<CheckScripts | null> => {
  await getState().loadScriptPins();
  const first = groupOf({ state: getState(), sessionId, mountId });
  if (first === null || first.scripts.length >= first.tickedCount) {
    return first;
  }
  await getState().loadDiscoveredScripts({ sessionId, worktreePath: first.group.worktreePath });
  return groupOf({ state: getState(), sessionId, mountId });
};
