import { useAppStore } from '../../store';
import { sessionPlace } from '../../store/slices/navigation/place';
import type { ElsewhereShell } from './elsewhereShellsOf';

type Params = {
  readonly shell: ElsewhereShell;
};

export const pickElsewhereShell = ({ shell }: Params): void => {
  const state = useAppStore.getState();
  if (shell.path !== null) {
    state.rememberTerminalScope({ sessionId: shell.sessionId, cwd: shell.path });
  }
  state.navigate({ to: sessionPlace({ sessionId: shell.sessionId }) });
};
