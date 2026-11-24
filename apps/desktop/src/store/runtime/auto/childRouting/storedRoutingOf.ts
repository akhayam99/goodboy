import type { DelegateChildSpec } from '@goodboy/core/auto';
import type { AutoDelegation } from '@goodboy/db';
import type { AutoRouting } from '@goodboy/types';
import type { AutoContinue } from '../../../../features/auto/delegationContinueOf';
import { textFieldOf } from '../../../../shared/utils/textFieldOf';
import type { RoutingOutcome } from '../ports';
import { routingPickOf } from './routingPickOf';

type Params = {
  readonly outcome: Extract<RoutingOutcome, { kind: 'ready' }>;
  readonly child: DelegateChildSpec;
  readonly retry: AutoDelegation | null;
  readonly continueWith: AutoContinue | null;
};

export const storedRoutingOf = ({ outcome, child, retry, continueWith }: Params): AutoRouting => {
  const modelReason =
    child.modelReason ??
    (retry === null || continueWith === null
      ? null
      : textFieldOf({ source: retry.routing, key: 'modelReason' }));
  return {
    ...routingPickOf({ outcome }),
    requested: { provider: child.provider, model: child.model, effort: child.effort },
    ...(modelReason !== null && { modelReason }),
  };
};
