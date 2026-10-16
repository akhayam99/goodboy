import { StageBoard } from '../../../../../features/workspace/components/StageBoard';
import { useSessions } from '../../../../../store';
import { WORKSPACE_ID } from '../workflowSeed';

export const InactiveSessionsPage = () => {
  const sessions = useSessions();
  return <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} />;
};
