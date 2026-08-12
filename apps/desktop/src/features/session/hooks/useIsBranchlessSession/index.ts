import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';

type Params = {
  readonly session: Session;
};

export const useIsBranchlessSession = ({ session }: Params): boolean => {
  const sessionId = session.id as SessionId;
  const workspaceKind = useAppStore(
    (s) => s.workspaces?.find((workspace) => workspace.id === session.workspaceId)?.kind ?? 'repo',
  );
  const branch = useAppStore((s) => s.sessionBranches[sessionId]);
  return isBranchlessSession({ workspaceKind, branch });
};
