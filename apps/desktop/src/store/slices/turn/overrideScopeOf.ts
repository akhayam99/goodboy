import type { TurnProviderOverride } from '@goodboy/types';
import type { OverrideScope } from './overrideOffNoticeMessage';

type Params = {
  readonly effective: TurnProviderOverride | undefined;
  readonly node: TurnProviderOverride | undefined;
  readonly agent: TurnProviderOverride | undefined;
};

export const overrideScopeOf = ({ effective, node, agent }: Params): OverrideScope => {
  if (effective !== undefined && effective === agent) {
    return 'agent';
  }
  if (effective !== undefined && effective === node) {
    return 'step';
  }
  return 'turn';
};
