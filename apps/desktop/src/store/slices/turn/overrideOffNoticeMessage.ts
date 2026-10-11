import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';

export type OverrideScope = 'turn' | 'agent' | 'step';

type Params = {
  readonly provider: ProviderId;
  readonly scope: OverrideScope;
};

const REASON: Readonly<Record<OverrideScope, string>> = {
  turn: 'you picked it for this turn',
  agent: 'you picked it for this agent',
  step: 'this step is set to it',
};

export const overrideOffNoticeMessage = ({ provider, scope }: Params): string =>
  `Running on ${PROVIDER_LABEL[provider]} because ${REASON[scope]}. ${PROVIDER_LABEL[provider]} is Off in Settings.`;
