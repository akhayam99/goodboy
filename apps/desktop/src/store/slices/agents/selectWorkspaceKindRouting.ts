import type { WorkspaceId } from '@goodboy/types';
import type { AgentKind, AgentKindRouting } from '../../../features/session/agent-kind';
import type { AppStore } from '../../store';
import { selectWorkspaceResolvedSettings } from '../overrides/selectResolvedSettings';
import { scopedKindRouting } from './scopedKindRouting';

type Params = {
  readonly state: AppStore;
  readonly workspaceId: WorkspaceId;
  readonly kind: AgentKind;
};

export const selectWorkspaceKindRouting = ({
  state,
  workspaceId,
  kind,
}: Params): AgentKindRouting =>
  scopedKindRouting({
    state,
    settings: selectWorkspaceResolvedSettings({ state, workspaceId }),
    kind,
  });
