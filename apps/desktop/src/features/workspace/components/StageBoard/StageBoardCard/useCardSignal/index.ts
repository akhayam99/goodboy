import type { Session, SessionStageInfo } from '@goodboy/types';
import type { BoardSignal } from '../../boardSignalOf';
import { useSessionSignal } from '../../useSessionSignal';
import { useWaitingRun } from '../../useWaitingRun';
import type { WaitingRun } from '../../waitingRunOf';
import { useAttentionAction } from '../useAttentionAction';
import type { DynamicAction } from '../useDynamicActions';

type Params = {
  readonly session: Session;
  readonly info: SessionStageInfo;
  readonly isArchived: boolean;
};

export type CardSignal = Readonly<{
  signal: BoardSignal;
  waitingRun: WaitingRun | null;
  attentionAction: DynamicAction | null;
}>;

export const useCardSignal = ({ session, info, isArchived }: Params): CardSignal => {
  const sessionSignal = useSessionSignal({ session, isArchived });
  const waitingRun = useWaitingRun({ session, info, isArchived });
  const attentionAction = useAttentionAction({ session, info, verb: waitingRun?.verb ?? null });
  const signal =
    waitingRun !== null && sessionSignal.kind === 'attention'
      ? { ...sessionSignal, label: waitingRun.words, word: waitingRun.words }
      : sessionSignal;
  return { signal, waitingRun, attentionAction };
};
