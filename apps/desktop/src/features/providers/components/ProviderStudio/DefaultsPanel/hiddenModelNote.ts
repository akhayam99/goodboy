import type { ProviderId } from '@goodboy/types';
import { routingShortText } from '../../../../../shared/components/RoutingPicker/routingSummary';

type Params = {
  readonly provider: ProviderId;
  readonly model: string;
};

export const hiddenModelNote = ({ provider, model }: Params): string =>
  `${routingShortText({ provider, model })} · hidden, still runs because you pinned it`;
