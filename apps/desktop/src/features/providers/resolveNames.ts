import type { ResolveNames } from '@goodboy/core/providers';
import {
  routingLabelParts,
  routingNameText,
} from '../../shared/components/RoutingPicker/routingSummary';
import { PROVIDER_LABEL } from './providerLabel';

export const RESOLVE_NAMES: ResolveNames = {
  provider: (provider) => PROVIDER_LABEL[provider],
  model: ({ provider, model }) => routingNameText(routingLabelParts({ provider, model })),
};
