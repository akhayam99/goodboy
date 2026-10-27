import { resolveSlot } from '@goodboy/core';
import type { MountId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { selectModelContext } from '../../../store/runtime/models/selectModelContext';
import { resolveSessionRepo } from '../../../store/slices/worktrees/resolveSessionRepo';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const checkRoutingOf = ({ state, sessionId, mountId }: Params) => {
  const repo = resolveSessionRepo({ state, sessionId, mountId });
  const scope = selectModelContext({
    state:
      repo === null
        ? state
        : {
            ...state,
            sessionActiveProject: { ...state.sessionActiveProject, [sessionId]: repo.projectId },
          },
    sessionId,
  });
  const resolution = resolveSlot({
    slot: { kind: 'role', id: 'investigator' },
    layers: scope.layers,
    context: scope.context,
  });
  return {
    provider: resolution.provider,
    model: resolution.model,
    effort: resolution.effort ?? 'medium',
    isBlocked: resolution.isBlockedByHidden,
  };
};
