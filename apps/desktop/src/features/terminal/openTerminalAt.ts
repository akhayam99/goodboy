import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import type { TerminalOwner } from '../../shared/types/terminal';

type OpenParams = {
  readonly state: Pick<AppStore, 'addTerminalTab' | 'switchStudio'>;
  readonly owner: TerminalOwner;
  readonly cwd: string | null;
  readonly sessionId: SessionId | null;
};

export const openTerminalAt = ({ state, owner, cwd, sessionId }: OpenParams): void => {
  const terminalId = state.addTerminalTab({ owner, cwd });
  state.switchStudio({ studio: { kind: 'terminal', terminalId, sessionId } });
};
