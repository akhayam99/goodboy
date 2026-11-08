import { useAppStore } from '../../store';

type Params = {
  readonly groupKey: string;
  readonly mountPath: string | null;
};

export const markBranchWorkReturn = ({ groupKey, mountPath }: Params): void =>
  useAppStore.getState().amendFocus({ patch: { runGroup: { groupKey, mountPath } } });
