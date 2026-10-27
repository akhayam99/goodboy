import { workspacesInitialState } from '../../store/slices/workspaces/state';
import { terminalInitialState } from '../../store/slices/terminal/state';

export const sliceInitialStates = () => ({
  ...workspacesInitialState,
  ...terminalInitialState,
});
