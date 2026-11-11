import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { DrawerEdgeContext } from '@goodboy/ui';
import { SessionTools } from '../../features/session/components/SessionTools';
import { useAppStore } from '../../store';

export const ShellToolRail = () => {
  const edgeHost = useContext(DrawerEdgeContext);
  const sessionId = useAppStore((state) =>
    state.appStudio === null ? state.currentSessionId : null,
  );
  return (
    <>
      <SessionTools sessionId={sessionId} />
      {edgeHost === null ? null : createPortal(<SessionTools sessionId={sessionId} />, edgeHost)}
    </>
  );
};
