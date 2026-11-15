import { useShallow } from 'zustand/react/shallow';
import type { Session, SessionStageInfo } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { waitingRunOf, type WaitingRun } from '../waitingRunOf';

type Params = {
  readonly session: Session;
  readonly info: SessionStageInfo;
  readonly isArchived: boolean;
};

export const useWaitingRun = ({ session, info, isArchived }: Params): WaitingRun | null => {
  const reason = !isArchived && info.stage === 'attention' ? info.attention : null;
  return useAppStore(
    useShallow((state) => (reason === null ? null : waitingRunOf({ state, session, reason }))),
  );
};
