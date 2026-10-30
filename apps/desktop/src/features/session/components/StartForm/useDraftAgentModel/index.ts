import { useCallback } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import type { PickedRoute } from '../../../../../shared/components/RoutingPicker/PickedRoute';
import { useWorkspaceKindRouting } from '../../../../../shared/hooks/useWorkspaceKindRouting';
import { agentRoutingOfPin } from '../../../startRun/runModelPin';
import type { RunModelView } from '../../StartRun/useRunModel';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly base: RunModelView;
};

export const useDraftAgentModel = ({ workspaceId, base }: Params): RunModelView => {
  const routing = useAppStore((state) => selectSessionDraft({ state, workspaceId }).agentRouting);
  const kind = useAppStore((state) => selectSessionDraft({ state, workspaceId }).agentKind);
  const suggestion = useWorkspaceKindRouting({ workspaceId, kind });
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const pick = useCallback(
    (route: PickedRoute | null): void => {
      patchSessionDraft({
        workspaceId,
        patch: {
          agentRouting:
            route === null || route.provider === ''
              ? null
              : agentRoutingOfPin({
                  pin: { provider: route.provider, model: route.model, effort: route.effort },
                }),
        },
      });
    },
    [patchSessionDraft, workspaceId],
  );
  return {
    ...base,
    suggestion,
    effective: routing ?? suggestion,
    isPinned: routing !== null,
    pick,
  };
};
