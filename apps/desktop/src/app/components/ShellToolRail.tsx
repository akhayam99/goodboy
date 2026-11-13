import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { DrawerEdgeContext } from '@goodboy/ui';
import { useBrowserWorkspaceTabs } from '../../shared/hooks/useBrowserWorkspaceTabs';
import { SessionTools } from '../../features/session/components/SessionTools';
import { SESSION_TOOL_RAIL_WIDTH } from '../../features/session/components/SessionTools/sessionToolRailWidth';
import { useAppStore } from '../../store';

export const ShellToolRail = () => {
  const edgeHost = useContext(DrawerEdgeContext);
  const sessionId = useAppStore((state) =>
    state.appStudio === null ? state.currentSessionId : null,
  );
  useBrowserWorkspaceTabs({ isReload: false });
  const tools = <SessionTools sessionId={sessionId} />;
  if (edgeHost === null) {
    return tools;
  }
  return (
    <>
      <div
        aria-hidden
        data-slot="tool-rail-seat"
        style={{ width: SESSION_TOOL_RAIL_WIDTH }}
        className="h-full shrink-0"
      />
      {createPortal(tools, edgeHost)}
    </>
  );
};
