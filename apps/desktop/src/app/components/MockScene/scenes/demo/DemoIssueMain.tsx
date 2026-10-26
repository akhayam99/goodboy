import type { Session } from '@goodboy/types';
import { SessionDraftPane } from '../../../../../features/session/components/SessionDraftPane';
import { StageBoard } from '../../../../../features/workspace/components/StageBoard';
import { BoardSessionView } from '../BoardSessionView';
import { WORKSPACE_ID } from '../BoardScene';

type Props = {
  readonly isDraftOpen: boolean;
  readonly session: Session | null;
  readonly sessions: ReadonlyArray<Session>;
};

export const DemoIssueMain = ({ isDraftOpen, session, sessions }: Props) => {
  if (isDraftOpen) {
    return <SessionDraftPane workspaceId={WORKSPACE_ID} />;
  }
  if (session !== null) {
    return <BoardSessionView session={session} />;
  }
  return <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} />;
};
