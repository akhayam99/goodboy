import type { WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';

type Params = {
  readonly state: Pick<AppStore, 'openSecurityFindings'>;
  readonly workspaceId: WorkspaceId | null;
};

export const selectSecurityFindingsAttention = ({ state, workspaceId }: Params): string | null => {
  if (workspaceId === null) {
    return null;
  }
  const count = state.openSecurityFindings[workspaceId]?.length ?? 0;
  return count === 0 ? null : `${count} open`;
};
