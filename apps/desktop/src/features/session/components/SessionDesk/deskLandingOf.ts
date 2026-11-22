import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../../../store/types';
import {
  landingOf,
  type DeskToolKind,
  type Landing,
  type LandingDoor,
  type LandingMove,
} from '../../../../store/slices/navigation/landingOf';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { deskToolsOf } from './deskToolsOf';
import { deskLines } from './useDeskOwner/deskLines';

export const DESK_OPENS: ReadonlySet<DeskToolKind> = new Set<DeskToolKind>(['terminal']);

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly door: LandingDoor;
  readonly move: LandingMove | null;
  readonly next: ReadonlyArray<LandingMove>;
};

export const deskLandingOf = ({ state, sessionId, door, move, next }: Params): Landing => {
  const workspaceId = sessionById(state.sessions, sessionId)?.workspaceId ?? null;
  const firstMount = (state.sessionProjectMounts[sessionId] ?? []).find(
    (mount) => mount.isAttached && mount.diskState === 'present',
  );
  const nowAgent = (state.sessionPhaseRuns[sessionId] ?? []).find(
    (agent) => agent.status === 'running',
  );
  return landingOf({
    door,
    move,
    lastFace: state.sessionFace[sessionId] ?? null,
    hasKept: deskToolsOf({ state }).length > 0 || deskLines.keptOf({ sessionId }).length > 0,
    next,
    nowAgentId: nowAgent?.id ?? null,
    firstMountId: firstMount?.mountId ?? null,
    hasWorkspaceFolder:
      isBranchlessSession({ branch: state.sessionBranches[sessionId] }) ||
      (workspaceId !== null &&
        (state.projects.some((project) => project.workspaceId === workspaceId) ||
          (state.terminalFolderOverrides[workspaceId] ?? null) !== null)),
    canOpen: DESK_OPENS,
  });
};
