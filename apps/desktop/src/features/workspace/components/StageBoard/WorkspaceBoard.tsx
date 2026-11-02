import type { WorkspaceId } from '@goodboy/types';
import { useSessions } from '../../../../store';
import { StageBoard } from './index';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceBoard = ({ workspaceId }: Props) => {
  const sessions = useSessions();
  return <StageBoard workspaceId={workspaceId} sessions={sessions} />;
};
