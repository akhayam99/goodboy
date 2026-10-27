import type { Workspace } from '@goodboy/types';
import { useWorkspaceHasUnread } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAdaptiveAge } from '../../../../shared/utils/time/formatAdaptiveAge';

export type WorkspaceRowFacts = {
  readonly lastSeen: string;
  readonly hasUnread: boolean;
};

type Params = {
  readonly workspace: Workspace;
};

export const useWorkspaceRowFacts = ({ workspace }: Params): WorkspaceRowFacts => {
  const now = useNow(30_000);
  const hasUnread = useWorkspaceHasUnread(workspace.id);
  const lastSeen =
    workspace.lastAccessedAt === undefined
      ? ''
      : formatAdaptiveAge({ at: workspace.lastAccessedAt, now });
  return { lastSeen, hasUnread };
};
