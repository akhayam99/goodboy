import type { FactCardSpec, FactModel } from './types';

export type CappedModel = {
  readonly label: string;
  readonly model: FactModel;
};

type Params = {
  readonly card: FactCardSpec;
};

type MoreParams = {
  readonly count: number;
};

const moreModelsLabel = ({ count }: MoreParams): string =>
  count === 1 ? '+ 1 model' : `+ ${count} models`;

export const cappedModels = ({ card }: Params): ReadonlyArray<CappedModel> => {
  const models = card.models ?? [];
  const first = models[0];
  const last = models[models.length - 1];
  if (first === undefined || last === undefined) {
    return [];
  }
  if (models.length === 1) {
    return [{ label: 'Model', model: first }];
  }
  if (models.length === 2) {
    return [
      { label: 'Models', model: first },
      { label: '', model: last },
    ];
  }
  return [
    { label: 'Models', model: first },
    { label: moreModelsLabel({ count: models.length - 2 }), model: last },
  ];
};
