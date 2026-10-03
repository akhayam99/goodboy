import type { ProviderId } from '@goodboy/types';
import { routingShortText } from '../../../../../shared/components/RoutingPicker/routingSummary';

type Params = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly isPinned: boolean;
  readonly job: string;
};

export const hiddenModelNote = ({ provider, model, isPinned, job }: Params): string => {
  const name = routingShortText({ provider, model });
  return isPinned
    ? `${name} · hidden, still runs because you pinned it`
    : `${name} · hidden, still used for ${job.toLowerCase()}`;
};
