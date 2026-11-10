import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openPaneOf } from '../../panes/openPaneOf';
import { waitingPaneOf } from '../../panes/waitingPaneOf';
import { ToolRailFrame } from './ToolRailFrame';
import { useScriptsSignal } from './useScriptsSignal';
import { useTerminalFinishSignal } from './useTerminalFinishSignal';
import { useToolSignal } from './useToolSignal';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionToolsLive = ({ sessionId }: Props) => {
  const openPane = useAppStore((state) => openPaneOf({ state, sessionId }));
  const waitingPane = useAppStore((state) => waitingPaneOf({ state, sessionId }));
  const contextSignal = useToolSignal({ sessionId, isContextOpen: openPane === 'context' });
  const scriptsSignal = useScriptsSignal({ sessionId });
  const terminalSignal = useTerminalFinishSignal({
    sessionId,
    isTerminalOpen: openPane === 'terminal',
  });
  return (
    <ToolRailFrame
      session={{
        sessionId,
        openPane,
        waitingPane,
        signalOf: { context: contextSignal, scripts: scriptsSignal },
      }}
      terminalSignal={terminalSignal}
    />
  );
};
