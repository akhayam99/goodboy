import type { UnavailableModelKey } from './unavailableModelsSetting';

type Params = {
  readonly entry: UnavailableModelKey;
  readonly model: UnavailableModelKey;
};

export const isSameUnavailableModel = ({ entry, model }: Params): boolean =>
  entry.providerId === model.providerId &&
  entry.accountId === model.accountId &&
  entry.modelKey === model.modelKey;
