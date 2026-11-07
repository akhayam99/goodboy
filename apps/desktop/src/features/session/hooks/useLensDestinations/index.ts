import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { useConnectedIntegrations } from '../../../integrations/hooks/useConnectedIntegrations';
import { lensDestinations, type LensDestination } from '../../lens-destinations';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Params = {
  readonly sessionId: SessionId | null;
};

export const useLensDestinations = ({ sessionId }: Params): ReadonlyArray<LensDestination> => {
  const isBranchless = useAppStore((s) =>
    sessionId === null ? false : isBranchlessSession({ branch: s.sessionBranches[sessionId] }),
  );
  const workspaceId = useAppStore((s) =>
    sessionId === null ? null : (sessionById(s.sessions, sessionId)?.workspaceId ?? null),
  );
  const isArchived = useAppStore((s) =>
    sessionId === null ? false : sessionById(s.sessions, sessionId)?.archivedAt != null,
  );
  const connected = useConnectedIntegrations({ workspaceId });

  return useMemo(
    () =>
      lensDestinations({
        isBranchless,
        isArchived,
        connectedTools: {
          linear: connected.linear,
          gitlab: connected.gitlab,
          jira: connected.jira,
          slack: connected.slack,
        },
      }),
    [isBranchless, isArchived, connected.linear, connected.gitlab, connected.jira, connected.slack],
  );
};
