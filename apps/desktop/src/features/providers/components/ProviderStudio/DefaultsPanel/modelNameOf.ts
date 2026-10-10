import type { ProviderId } from '@goodboy/types';
import {
  routingLabelParts,
  routingNameText,
} from '../../../../../shared/components/RoutingPicker/routingSummary';

type Params = {
  readonly provider: ProviderId;
  readonly model: string;
};

export const modelNameOf = ({ provider, model }: Params): string =>
  routingNameText(routingLabelParts({ provider, model }));
