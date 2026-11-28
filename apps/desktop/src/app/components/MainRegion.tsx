import { useState } from 'react';
import { PaneSwap, type PaneLayer } from '@goodboy/ui';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import { HomePage } from '../../features/home/HomePage';
import { useAppStore } from '../../store';
import { selectIsHomeShown } from '../../shared/navigation/selectIsHomeShown';
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

type KeyParams = {
  readonly hasSession: boolean;
  readonly isDraftShown: boolean;
  readonly isHomeShown: boolean;
};

const activeKeyOf = ({ hasSession, isDraftShown, isHomeShown }: KeyParams): string => {
  if (hasSession) {
    return 'session';
  }
  if (isDraftShown) {
    return 'draft';
  }
  return isHomeShown ? 'home' : 'board';
};

export const MainRegion = ({
  workspaceId,
  currentSession,
  isDraftShown,
  renderedIds,
  activeId,
}: Props) => {
  const isHomeShown = useAppStore((state) => selectIsHomeShown({ state }));
  const [frameSession, setFrameSession] = useState(currentSession);
  if (currentSession !== null && currentSession !== frameSession) {
    setFrameSession(currentSession);
  }
  const activeKey = activeKeyOf({ hasSession: currentSession !== null, isDraftShown, isHomeShown });
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
    ...(isHomeShown ? [{ key: 'home', content: <HomePage workspaceId={workspaceId} /> }] : []),
    ...(isDraftShown
      ? [{ key: 'draft', content: <SessionDraftPane workspaceId={workspaceId} /> }]
      : []),
  ];
  return <PaneSwap activeKey={activeKey} layers={layers} />;
};
