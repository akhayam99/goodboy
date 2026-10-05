import { useAppStore } from '../../store/store';

type Params = Parameters<ReturnType<typeof useAppStore.getState>['undoable']>[0];

export const undoable = ({ ...params }: Params): string => useAppStore.getState().undoable(params);
