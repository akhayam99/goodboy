import type { DockGridSplit } from '@goodboy/ui';
import { useAppStore } from '../../store';
import { selectGridTool } from '../../store/slices/drawer/selectGridTool';

type Params = DockGridSplit;

export const splitShellColumn = ({ keys, share }: Params): void => {
  const state = useAppStore.getState();
  const kinds = keys.map((key) => selectGridTool({ state, kind: key })?.kind ?? null);
  if (kinds.some((kind) => kind === null)) {
    return;
  }
  state.resizeDockRow({ kinds: kinds.filter((kind) => kind !== null), share });
};
