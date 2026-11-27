import { catalogModelForId, MODEL_CATALOGS } from '@goodboy/core/providers';
import type { ModelKey, ProviderId } from '@goodboy/types';
import { isSameUnavailableModel } from './isSameUnavailableModel';
import type { UnavailableModel } from './unavailableModelsSetting';
import type { UnavailableModelsWrite } from './unavailableModelsWriter';

type Params = {
  readonly write: UnavailableModelsWrite;
};

type ListedModels = {
  readonly providerId: ProviderId;
  readonly accountId: string;
  readonly plan: string | null;
  readonly listed: ReadonlyArray<string>;
  readonly checkedAt: number;
};

type KeysParams = Pick<ListedModels, 'providerId' | 'listed'>;

const listedKeysOf = ({ providerId, listed }: KeysParams): ReadonlySet<ModelKey> =>
  new Set(
    listed.flatMap((modelId) => {
      const model = catalogModelForId({ provider: providerId, modelId });
      return model === null ? [] : [model.key];
    }),
  );

export const learnListedModels = ({ write }: Params) => {
  return async ({
    providerId,
    accountId,
    plan,
    listed,
    checkedAt,
  }: ListedModels): Promise<void> => {
    const listedKeys = listedKeysOf({ providerId, listed });
    if (accountId === '' || listedKeys.size === 0) {
      return;
    }
    const unlisted = MODEL_CATALOGS[providerId]
      .map((model) => model.key)
      .filter((modelKey) => !listedKeys.has(modelKey));
    await write({
      change: ({ current }) => {
        const kept = current.filter(
          (entry) =>
            entry.source !== 'unlisted' ||
            entry.providerId !== providerId ||
            entry.accountId !== accountId,
        );
        const learned = unlisted.flatMap((modelKey): ReadonlyArray<UnavailableModel> => {
          const model = { providerId, accountId, modelKey };
          return kept.some((entry) => isSameUnavailableModel({ entry, model }))
            ? []
            : [{ ...model, plan, source: 'unlisted', checkedAt }];
        });
        return [...kept, ...learned];
      },
    });
  };
};
