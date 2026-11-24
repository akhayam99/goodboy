import { isSameUnavailableModel } from './isSameUnavailableModel';
import type { UnavailableModel } from './unavailableModelsSetting';
import type { UnavailableModelsWrite } from './unavailableModelsWriter';

type Params = {
  readonly write: UnavailableModelsWrite;
};

export const clearModelUnavailable = ({ write }: Params) => {
  return async ({ providerId, accountId, modelKey }: UnavailableModel): Promise<void> => {
    const model = { providerId, accountId, modelKey };
    await write({
      change: ({ current }) =>
        current.some((entry) => isSameUnavailableModel({ entry, model }))
          ? current.filter((entry) => !isSameUnavailableModel({ entry, model }))
          : null,
    });
  };
};
