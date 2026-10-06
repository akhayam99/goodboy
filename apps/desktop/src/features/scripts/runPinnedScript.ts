import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../store';
import { buildSessionScripts } from './buildSessionScripts';
import { parseScriptPins } from './parseScriptPins';
import { scriptPinId } from './scriptPinId';
import { scriptPinsKey } from './scriptPinsKey';
import type { ScriptRunResult } from './scripts';
import { startRunnableScript } from './startRunnableScript';

type Params = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
  readonly pinId: string;
};

type PinnedScriptRun =
  { readonly kind: 'not-here' } | { readonly kind: 'ran'; readonly result: ScriptRunResult };

const findPinned = ({ sessionId, workspaceId, projectId, pinId }: Params) => {
  const state = useAppStore.getState();
  const groups = buildSessionScripts({
    mounts: state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY,
    projects: state.projects,
    saved: state.projectScripts[workspaceId] ?? EMPTY_ARRAY,
    discovered: state.discoveredScripts[sessionId],
    pins: { [projectId]: parseScriptPins({ raw: state.settings[scriptPinsKey({ projectId })] }) },
  });
  const group = groups.find((candidate) => candidate.projectId === projectId && candidate.isReady);
  const script = group?.scripts.find((candidate) => scriptPinId(candidate) === pinId);
  return { group, script };
};

export const runPinnedScript = async (params: Params): Promise<PinnedScriptRun> => {
  const first = findPinned(params);
  if (first.group === undefined) {
    return { kind: 'not-here' };
  }
  if (first.script === undefined) {
    await useAppStore.getState().loadDiscoveredScripts({
      sessionId: params.sessionId,
      worktreePath: first.group.worktreePath,
    });
  }
  const { group, script } = first.script === undefined ? findPinned(params) : first;
  if (group === undefined || script === undefined) {
    return { kind: 'not-here' };
  }
  const result = await startRunnableScript({
    sessionId: params.sessionId,
    script,
    mountId: group.mountId,
    worktreePath: group.worktreePath,
  });
  return { kind: 'ran', result };
};
