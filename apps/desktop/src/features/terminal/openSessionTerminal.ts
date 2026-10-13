import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { sessionTerminalOwner, terminalOwnerKey } from '../../store/slices/terminal/terminalOwner';

type OpenParams = {
  readonly state: Pick<
    AppStore,
    'addTerminalTab' | 'openDrawer' | 'terminalTabs' | 'setTerminalPrefill'
  >;
  readonly sessionId: SessionId;
  readonly cwd: string | null;
  readonly prefill?: string;
};

export const openSessionTerminal = ({ state, sessionId, cwd, prefill }: OpenParams): void => {
  const owner = sessionTerminalOwner({ sessionId });
  const reusable =
    prefill === undefined
      ? (state.terminalTabs[terminalOwnerKey({ owner })] ?? []).find(
          (tab) => tab.cwd === cwd && tab.status !== 'exited' && tab.openError === undefined,
        )
      : undefined;
  const terminalId = reusable?.id ?? state.addTerminalTab({ owner, cwd });
  if (prefill !== undefined) {
    state.setTerminalPrefill({ owner, tabId: terminalId, prefill });
  }
  state.openDrawer({ kind: 'terminal', sessionId, payload: { terminalId } });
};
