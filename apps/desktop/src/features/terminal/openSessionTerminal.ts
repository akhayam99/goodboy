import type { SessionId } from '@goodboy/types';
import type { TerminalOwner } from '../../shared/types/terminal';
import type { AppStore } from '../../store/store';
import { sessionTerminalOwner, terminalOwnerKey } from '../../store/slices/terminal/terminalOwner';

type OpenParams = {
  readonly state: Pick<
    AppStore,
    | 'addTerminalTab'
    | 'openDrawer'
    | 'terminalTabs'
    | 'setTerminalPrefill'
    | 'rememberTerminalScope'
  >;
  readonly sessionId: SessionId;
  readonly cwd: string | null;
  readonly owner?: TerminalOwner;
  readonly prefill?: string;
  readonly isFresh?: boolean;
};

export const openSessionTerminal = ({
  state,
  sessionId,
  cwd,
  owner = sessionTerminalOwner({ sessionId }),
  prefill,
  isFresh = false,
}: OpenParams): void => {
  const reusable =
    prefill === undefined && !isFresh
      ? (state.terminalTabs[terminalOwnerKey({ owner })] ?? []).find(
          (tab) => tab.cwd === cwd && tab.status !== 'exited' && tab.openError === undefined,
        )
      : undefined;
  const terminalId = reusable?.id ?? state.addTerminalTab({ owner, cwd });
  if (prefill !== undefined) {
    state.setTerminalPrefill({ owner, tabId: terminalId, prefill });
  }
  if (cwd !== null) {
    state.rememberTerminalScope({ sessionId, cwd });
  }
  state.openDrawer({ kind: 'terminal', sessionId, payload: { terminalId } });
};
