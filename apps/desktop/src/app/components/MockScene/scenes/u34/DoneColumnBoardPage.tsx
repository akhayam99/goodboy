import { StageBoard } from '../../../../../features/workspace/components/StageBoard';
import { useSessions } from '../../../../../store';
import { WORKSPACE_ID } from '../BoardScene';

export const DoneColumnBoardPage = () => {
  const sessions = useSessions();
  return <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} />;
};
