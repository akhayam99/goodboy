import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { useConnectedIntegrations } from '../../../integrations/hooks/useConnectedIntegrations';
import { useRemoteHostKind } from '../../../worktree/useRemoteHostKind';
import { lensDestinations, type LensDestination } from '../../lens-destinations';

type Params = {
  readonly sessionId: SessionId | null;
};

const NO_SESSION = '' as SessionId;

export const useLensDestinations = ({ sessionId }: Params): ReadonlyArray<LensDestination> => {
  const isBranchless = useAppStore((s) =>
    sessionId === null ? false : isBranchlessSession({ branch: s.sessionBranches[sessionId] }),
  );
  const workspaceId = useAppStore((s) =>
    sessionId === null
      ? null
      : (s.sessions.find((session) => session.id === sessionId)?.workspaceId ?? null),
  );
  const hasGithubPr = useAppStore((s) =>
    sessionId === null ? false : (s.sessionGithub[sessionId]?.pr ?? null) !== null,
  );
  const hasOtherHost = useAppStore((s) =>
    sessionId === null
      ? false
      : (s.sessionGitlabMr[sessionId]?.mr ?? null) !== null ||
        (s.sessionBitbucketPr[sessionId]?.pr ?? null) !== null,
  );
  const remoteKind = useRemoteHostKind({ sessionId: sessionId ?? NO_SESSION });
  const connected = useConnectedIntegrations({ workspaceId });
  const isGithubCodeHost = !hasOtherHost && (remoteKind === 'github' || hasGithubPr);

  return useMemo(
    () =>
      lensDestinations({
        isBranchless,
        isGithubCodeHost,
        connectedTools: {
          linear: connected.linear,
          gitlab: connected.gitlab,
          jira: connected.jira,
          slack: connected.slack,
        },
      }),
    [
      isBranchless,
      isGithubCodeHost,
      connected.linear,
      connected.gitlab,
      connected.jira,
      connected.slack,
    ],
  );
};
