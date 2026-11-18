import { useAppStore } from '../../store';
import { selectGridTool } from '../../store/slices/drawer/selectGridTool';

type Params = {
  readonly key: string;
  readonly width: number;
};

export const resizeShellColumn = ({ key, width }: Params): void => {
  const state = useAppStore.getState();
  const entry = selectGridTool({ state, kind: key });
  if (entry === null) {
    return;
  }
  state.resizeDockColumn({ kind: entry.kind, width });
};
