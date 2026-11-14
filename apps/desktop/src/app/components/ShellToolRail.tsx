import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { DrawerEdgeContext } from '@goodboy/ui';
import { useBrowserWorkspaceTabs } from '../../shared/hooks/useBrowserWorkspaceTabs';
import { SessionTools } from '../../features/session/components/SessionTools';
import { useAppStore } from '../../store';

export const ShellToolRail = () => {
  const railHost = useContext(DrawerEdgeContext);
  const sessionId = useAppStore((state) =>
    state.appStudio === null ? state.currentSessionId : null,
  );
  useBrowserWorkspaceTabs({ isReload: false });
  const tools = <SessionTools sessionId={sessionId} />;
  if (railHost === null) {
    return tools;
  }
  return createPortal(tools, railHost);
};
