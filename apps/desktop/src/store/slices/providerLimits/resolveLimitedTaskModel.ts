import { resolveTaskModel } from '@goodboy/core';
import type { TaskModelPreference } from '@goodboy/types';
import type { AutoLimitContext } from './autoLimitContext';

type Params = Parameters<typeof resolveTaskModel>[0] & {
  readonly limitContext: AutoLimitContext | null;
};

export const resolveLimitedTaskModel = ({
  limitContext,
  ...params
}: Params): TaskModelPreference => {
  if (limitContext === null) {
    return resolveTaskModel(params);
  }
  return resolveTaskModel({
    ...params,
    connectedProviders: params.connectedProviders ?? limitContext.connected,
    atLimitProviders: limitContext.atLimit,
  });
};
