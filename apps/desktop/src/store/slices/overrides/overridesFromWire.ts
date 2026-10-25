import { parseProviderPolicy, parseWorkflowRules } from '@goodboy/types';
import type { OverrideSettings } from '@goodboy/types';

export type WireOverrides = Omit<OverrideSettings, 'providerPool' | 'workflowRules'> & {
  readonly providerPool?: unknown;
  readonly workflowRules?: unknown;
};

type Params = {
  readonly wire: WireOverrides;
};

export const overridesFromWire = ({ wire }: Params): OverrideSettings => ({
  ...wire,
  providerPool: parseProviderPolicy({
    value: wire.providerPool,
    defaultProviderId: wire.defaultProviderId,
  }),
  workflowRules: parseWorkflowRules({ value: wire.workflowRules }),
});
