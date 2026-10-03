import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectWorkspaceKindRouting } from '../../../store/slices/agents/selectWorkspaceKindRouting';
import type { AgentKind, AgentKindRouting } from '../../../features/session/agent-kind';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly kind: AgentKind;
};

export const useWorkspaceKindRouting = ({ workspaceId, kind }: Params): AgentKindRouting =>
  useAppStore(useShallow((state) => selectWorkspaceKindRouting({ state, workspaceId, kind })));
