import type { DockFold } from '@goodboy/ui';
import { useAppStore } from '../../store';
import { dockFoldMessageOf } from './dockFoldMessageOf';
import { toolKindOf } from './toolKindOf';

type LabelParams = {
  readonly key: string;
};

type Params = {
  readonly fold: DockFold;
  readonly labelOf: (params: LabelParams) => string;
};

export const announceShellFold = ({ fold, labelOf }: Params): void => {
  const opened = toolKindOf({ key: fold.opened });
  if (opened === undefined) {
    return;
  }
  const state = useAppStore.getState();
  state.announceDockFold({
    sessionId: state.currentSessionId,
    opened,
    message: dockFoldMessageOf({ fold, labelOf }),
  });
};
