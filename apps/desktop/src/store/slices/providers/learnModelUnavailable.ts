import { isSameUnavailableModel } from './isSameUnavailableModel';
import type { UnavailableModel } from './unavailableModelsSetting';
import type { UnavailableModelsWrite } from './unavailableModelsWriter';

type Params = {
  readonly write: UnavailableModelsWrite;
};

export const learnModelUnavailable = ({ write }: Params) => {
  return async ({
    providerId,
    accountId,
    modelKey,
    plan,
    source,
    checkedAt,
  }: UnavailableModel): Promise<void> => {
    const model = { providerId, accountId, modelKey, plan, source, checkedAt };
    await write({
      change: ({ current }) => [
        ...current.filter((entry) => !isSameUnavailableModel({ entry, model })),
        model,
      ],
    });
  };
};
