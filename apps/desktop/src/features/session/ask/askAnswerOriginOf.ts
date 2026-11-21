import { NAMES } from '../../../shared/utils/names';
import { formatAskCost } from './askRightNow';

type Params = Readonly<{
  origin: 'session' | 'model';
  costUsd: number | null;
}>;

export const askAnswerOriginOf = ({ origin, costUsd }: Params): string => {
  if (origin === 'session') {
    return NAMES.fromTheSession;
  }
  return costUsd === null
    ? NAMES.askedTheModel
    : `${NAMES.askedTheModel} · ${formatAskCost(costUsd)}`;
};
