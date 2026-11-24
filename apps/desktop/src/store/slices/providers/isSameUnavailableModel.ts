import type { UnavailableModel } from './unavailableModelsSetting';

type Params = {
  readonly entry: UnavailableModel;
  readonly model: UnavailableModel;
};

export const isSameUnavailableModel = ({ entry, model }: Params): boolean =>
  entry.providerId === model.providerId &&
  entry.accountId === model.accountId &&
  entry.modelKey === model.modelKey;
