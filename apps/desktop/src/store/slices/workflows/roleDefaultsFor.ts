import {
  ROLE_REGISTRY,
  SELECTABLE_AGENT_ROLES,
  roleModelSetMenu,
  skippedPinNote,
  type OrchestratorModelOption,
  type OrchestratorRoleDefault,
} from '@goodboy/core';
import type { RoleModelPreferences, SessionId } from '@goodboy/types';
import { RESOLVE_NAMES } from '../../../features/providers/resolveNames';
import { rolePicks } from '../workflowRouting/rolePicks';
import type { GetFn } from './types';

type RoleDefaultsParams = {
  readonly state: ReturnType<GetFn>;
  readonly sessionId: SessionId;
  readonly roleModels: RoleModelPreferences | null;
  readonly menu: ReadonlyArray<OrchestratorModelOption>;
};

export const roleDefaultsFor = ({
  state,
  sessionId,
  roleModels,
  menu,
}: RoleDefaultsParams): ReadonlyArray<OrchestratorRoleDefault> =>
  SELECTABLE_AGENT_ROLES.filter((role) => ROLE_REGISTRY[role].workflowEligible).map((role) => {
    const { resolution } = rolePicks({ state, sessionId, role });
    const setMenu =
      resolution.source === 'auto' ? null : roleModelSetMenu({ menu, role, prefs: roleModels });
    const pinNote = skippedPinNote({ resolution, names: RESOLVE_NAMES });
    return {
      role,
      provider: resolution.provider,
      model: resolution.model,
      effort: resolution.effort ?? 'medium',
      ...(setMenu !== null && {
        models: setMenu.map((option) => ({ provider: option.provider, model: option.model })),
      }),
      ...(pinNote !== null && {
        skippedPin: `${RESOLVE_NAMES.model({ provider: resolution.provider, model: resolution.model })} (${pinNote})`,
      }),
    };
  });
