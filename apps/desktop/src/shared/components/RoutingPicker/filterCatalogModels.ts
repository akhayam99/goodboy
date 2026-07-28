import type { CatalogModel } from '@goodboy/types';

type ModelSearchResult = {
  readonly model: CatalogModel;
  readonly variant?: string;
};

type Params = {
  readonly catalog: ReadonlyArray<CatalogModel>;
  readonly query: string;
};

export const filterCatalogModels = ({
  catalog,
  query,
}: Params): ReadonlyArray<ModelSearchResult> => {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized === '') {
    return catalog.map((model) => ({ model }));
  }
  return catalog.flatMap((model) => {
    const modelText = `${model.label} ${model.key}`.toLocaleLowerCase();
    if (modelText.includes(normalized)) {
      return [{ model }];
    }
    if (model.provider !== 'codex') {
      return [];
    }
    const variant = model.variants.find((candidate) =>
      `${candidate.label} ${candidate.id} ${candidate.cliId}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
    return variant == null ? [] : [{ model, variant: variant.id }];
  });
};
