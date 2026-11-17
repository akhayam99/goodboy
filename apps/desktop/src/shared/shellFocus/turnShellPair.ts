import { useAppStore } from '../../store';
import { selectGridTool } from '../../store/slices/drawer/selectGridTool';

type Params = {
  readonly key: string;
};

export const turnShellPair = ({ key }: Params): void => {
  const state = useAppStore.getState();
  const entry = selectGridTool({ state, kind: key });
  if (entry === null) {
    return;
  }
  state.turnDockPair({ entry });
};
