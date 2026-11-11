import type { SessionId } from '@goodboy/types';
import { SessionToolsLive } from './SessionToolsLive';
import { ToolRailFrame } from './ToolRailFrame';

type Props = {
  readonly sessionId: SessionId | null;
};

export const SessionTools = ({ sessionId }: Props) =>
  sessionId === null ? (
    <ToolRailFrame session={null} terminalSignal={null} />
  ) : (
    <SessionToolsLive key={sessionId} sessionId={sessionId} />
  );
