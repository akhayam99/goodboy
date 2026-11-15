import type { AutoDelegation } from '@goodboy/db';
import { PROVIDER_IDS, type Agent } from '@goodboy/types';
import { EFFORT_LEVELS } from '../chat/utils/chat-constants';

type Params = {
  readonly delegation: Pick<AutoDelegation, 'routing'>;
};

export type AutoChildRouting = Partial<
  Pick<Agent, 'modelOverride' | 'providerOverride' | 'effort'>
>;

type TextParams = Params & {
  readonly key: string;
};

const routingText = ({ delegation, key }: TextParams): string | undefined => {
  const value = delegation.routing[key];
  return typeof value === 'string' ? value : undefined;
};

export const autoChildRoutingOf = ({ delegation }: Params): AutoChildRouting => {
  const model = routingText({ delegation, key: 'model' });
  const providerText = routingText({ delegation, key: 'provider' });
  const effortText = routingText({ delegation, key: 'effort' });
  const provider = PROVIDER_IDS.find((candidate) => candidate === providerText);
  const effort = EFFORT_LEVELS.find((level) => level === effortText);
  return {
    ...(model === undefined ? {} : { modelOverride: model }),
    ...(provider === undefined ? {} : { providerOverride: provider }),
    ...(effort === undefined ? {} : { effort }),
  };
};
