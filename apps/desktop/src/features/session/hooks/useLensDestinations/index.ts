import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { useConnectedIntegrations } from '../../../integrations/hooks/useConnectedIntegrations';
import { lensDestinations, type LensDestination } from '../../lens-destinations';

type Params = {
  readonly sessionId: SessionId | null;
};

export const useLensDestinations = ({ sessionId }: Params): ReadonlyArray<LensDestination> => {
  const isBranchless = useAppStore((s) =>
    sessionId === null ? false : isBranchlessSession({ branch: s.sessionBranches[sessionId] }),
  );
  const workspaceId = useAppStore((s) =>
    sessionId === null
      ? null
      : (s.sessions.find((session) => session.id === sessionId)?.workspaceId ?? null),
  );
  const connected = useConnectedIntegrations({ workspaceId });

  return useMemo(
    () =>
      lensDestinations({
        isBranchless,
        connectedTools: {
          linear: connected.linear,
          gitlab: connected.gitlab,
          jira: connected.jira,
          slack: connected.slack,
        },
      }),
    [isBranchless, connected.linear, connected.gitlab, connected.jira, connected.slack],
  );
};
