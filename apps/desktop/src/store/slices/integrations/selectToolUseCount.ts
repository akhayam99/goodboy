import type { IntegrationBindingProvider, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { ToolUse } from './toolUses';

type Params = {
  readonly state: Pick<AppStore, 'toolUseCounts'>;
  readonly workspaceId: WorkspaceId;
  readonly tool: IntegrationBindingProvider;
  readonly use: ToolUse;
};

export const selectToolUseCount = ({ state, workspaceId, tool, use }: Params): number | null =>
  state.toolUseCounts[workspaceId]?.[tool]?.[use] ?? null;
