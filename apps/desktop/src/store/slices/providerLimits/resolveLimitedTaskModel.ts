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
  const isLimited = limitContext.atLimit.length > 0;
  return resolveTaskModel({
    ...params,
    ...(isLimited && {
      connectedProviders: params.connectedProviders ?? limitContext.connected,
      atLimitProviders: limitContext.atLimit,
    }),
    ...(limitContext.hidden != null && { hiddenModels: limitContext.hidden }),
    ...(limitContext.cliVersions != null && { cliVersions: limitContext.cliVersions }),
  });
};
