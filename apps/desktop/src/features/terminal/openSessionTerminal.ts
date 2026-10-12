import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { sessionTerminalOwner, terminalOwnerKey } from '../../store/slices/terminal/terminalOwner';

type OpenParams = {
  readonly state: Pick<AppStore, 'addTerminalTab' | 'openDrawer' | 'terminalTabs'>;
  readonly sessionId: SessionId;
  readonly cwd: string | null;
};

export const openSessionTerminal = ({ state, sessionId, cwd }: OpenParams): void => {
  const owner = sessionTerminalOwner({ sessionId });
  const reusable = (state.terminalTabs[terminalOwnerKey({ owner })] ?? []).find(
    (tab) => tab.cwd === cwd && tab.status !== 'exited' && tab.openError === undefined,
  );
  const terminalId = reusable?.id ?? state.addTerminalTab({ owner, cwd });
  state.openDrawer({ kind: 'terminal', sessionId, payload: { terminalId } });
};
