import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openPaneOf } from '../../panes/openPaneOf';
import { ToolRailFrame } from './ToolRailFrame';
import { useTerminalFinishSignal } from './useTerminalFinishSignal';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionToolsLive = ({ sessionId }: Props) => {
  const openPane = useAppStore((state) => openPaneOf({ state, sessionId }));
  const terminalSignal = useTerminalFinishSignal({
    sessionId,
    isTerminalOpen: openPane === 'terminal',
  });
  return <ToolRailFrame terminalSignal={terminalSignal} />;
};
