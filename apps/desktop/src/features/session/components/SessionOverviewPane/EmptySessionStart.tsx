import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionLoading } from '../../../../store';
import { StartRun } from '../StartRun/StartRun';

type Props = {
  readonly session: Session;
};

const PLACEHOLDER = 'What should it do?';

const HINT = 'Describe what you want done. Goodboy opens a branch for it.';

export const EmptySessionStart = ({ session }: Props) => {
  const agentCount = useAppStore(
    (state) => (state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY).length,
  );
  const isLoading = useSessionLoading(session.id).agents;
  if (
    isLoading ||
    agentCount > 0 ||
    session.workflowRuns.length > 0 ||
    session.archivedAt != null
  ) {
    return null;
  }
  return (
    <StartRun
      workspaceId={session.workspaceId}
      sessionId={session.id}
      placeholder={PLACEHOLDER}
      hint={HINT}
    />
  );
};
