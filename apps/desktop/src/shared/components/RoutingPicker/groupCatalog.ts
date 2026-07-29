import type { CatalogModel, ModelFamily } from '@goodboy/types';

type Params = {
  readonly catalog: ReadonlyArray<CatalogModel>;
};

type CatalogRow = {
  readonly group: string | null;
  readonly models: ReadonlyArray<CatalogModel>;
};

export type CatalogFamilySection = {
  readonly family: ModelFamily;
  readonly rows: ReadonlyArray<CatalogRow>;
};

export const groupCatalog = ({ catalog }: Params): ReadonlyArray<CatalogFamilySection> => {
  const sortedModels = [...catalog].sort(
    (left, right) => left.presentation.order - right.presentation.order,
  );
  const familyModels = new Map<ModelFamily, Array<CatalogModel>>();
  for (const model of sortedModels) {
    const models = familyModels.get(model.presentation.family) ?? [];
    models.push(model);
    familyModels.set(model.presentation.family, models);
  }

  return [...familyModels.entries()].map(([family, models]) => {
    const rows: Array<CatalogRow> = [];
    for (const model of models) {
      const group = model.presentation.group;
      if (group == null) {
        const nullRowIndex = rows.findIndex((row) => row.group == null);
        if (nullRowIndex < 0) {
          rows.push({ group: null, models: [model] });
          continue;
        }
        const nullRow = rows[nullRowIndex];
        if (nullRow == null) {
          continue;
        }
        rows[nullRowIndex] = { group: null, models: [...nullRow.models, model] };
        continue;
      }

      const lastRow = rows.at(-1);
      if (lastRow?.group === group) {
        rows[rows.length - 1] = { group, models: [...lastRow.models, model] };
        continue;
      }
      rows.push({ group, models: [model] });
    }
    return { family, rows };
  });
};
