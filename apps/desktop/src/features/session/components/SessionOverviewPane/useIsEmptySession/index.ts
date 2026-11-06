import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionLoading } from '../../../../../store';

type Params = {
  readonly session: Session;
  readonly hasContent: boolean;
};

export const useIsEmptySession = ({ session, hasContent }: Params): boolean => {
  const agentCount = useAppStore(
    (state) => (state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY).length,
  );
  const isLoading = useSessionLoading(session.id).agents;
  return (
    !isLoading &&
    !hasContent &&
    agentCount === 0 &&
    session.workflowRuns.length === 0 &&
    session.archivedAt == null
  );
};
