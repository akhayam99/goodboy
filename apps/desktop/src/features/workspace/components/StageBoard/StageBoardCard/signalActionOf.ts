import type { BoardSignal } from '../boardSignalOf';
import type { WaitingRun } from '../waitingRunOf';
import type { DynamicAction } from './useDynamicActions';

type Params = {
  readonly signal: BoardSignal;
  readonly action: DynamicAction | undefined;
  readonly isArchived: boolean;
  readonly waitingRun: WaitingRun | null;
};

export const signalActionOf = ({
  signal,
  action,
  isArchived,
  waitingRun,
}: Params): DynamicAction | null => {
  if (isArchived || waitingRun !== null || action === undefined || signal.kind !== 'attention') {
    return null;
  }
  const isForReason =
    action.key === `attention:${signal.reason}` ||
    (action.key === 'questions' && signal.reason === 'open-question');
  return isForReason ? action : null;
};
