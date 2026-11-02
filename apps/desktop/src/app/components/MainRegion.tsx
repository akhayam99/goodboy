import { useState } from 'react';
import { PaneSwap, type PaneLayer } from '@goodboy/ui';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import { SessionDraftPane } from '../../features/session/components/SessionDraftPane';
import { WorkspaceBoard } from '../../features/workspace/components/StageBoard/WorkspaceBoard';
import { KeepAliveWorkSurface } from './KeepAliveWorkSurface';
import { SessionFrame } from './SessionRail/SessionFrame';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly currentSession: Session | null;
  readonly isDraftShown: boolean;
  readonly renderedIds: ReadonlyArray<SessionId>;
  readonly activeId: SessionId | null;
};

export const MainRegion = ({
  workspaceId,
  currentSession,
  isDraftShown,
  renderedIds,
  activeId,
}: Props) => {
  const [frameSession, setFrameSession] = useState(currentSession);
  if (currentSession !== null && currentSession !== frameSession) {
    setFrameSession(currentSession);
  }
  const activeKey = currentSession !== null ? 'session' : isDraftShown ? 'draft' : 'board';
  const layers: ReadonlyArray<PaneLayer> = [
    { key: 'board', content: <WorkspaceBoard workspaceId={workspaceId} /> },
    ...(frameSession === null
      ? []
      : [
          {
            key: 'session',
            content: (
              <SessionFrame session={frameSession}>
                {renderedIds.map((id) => (
                  <KeepAliveWorkSurface key={id} sessionId={id} isActive={id === activeId} />
                ))}
              </SessionFrame>
            ),
          },
        ]),
    ...(isDraftShown
      ? [{ key: 'draft', content: <SessionDraftPane workspaceId={workspaceId} /> }]
      : []),
  ];
  return <PaneSwap activeKey={activeKey} layers={layers} />;
};
