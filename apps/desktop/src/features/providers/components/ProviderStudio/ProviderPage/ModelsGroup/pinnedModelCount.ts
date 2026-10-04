import { roleModelChoices } from '@goodboy/core';
import type { OverrideSettings, ProviderId } from '@goodboy/types';

type Params = {
  readonly overrides: OverrideSettings | null;
  readonly chatProvider: ProviderId | null;
  readonly providerId: ProviderId;
};

export const pinnedModelCount = ({ overrides, chatProvider, providerId }: Params): number => {
  const taskCount = Object.values(overrides?.taskModels ?? {}).filter(
    (preference) => preference.providerId === providerId,
  ).length;
  const roleCount = Object.values(overrides?.roleModels ?? {}).filter((preference) =>
    roleModelChoices({ preference }).some((choice) => choice.providerId === providerId),
  ).length;
  return taskCount + roleCount + (chatProvider === providerId ? 1 : 0);
};
