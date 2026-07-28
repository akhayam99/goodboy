import { Search } from 'lucide-react';
import { Input, ScrollFade } from '@goodboy/ui';
import type { CatalogModel } from '@goodboy/types';
import { filterCatalogModels } from './filterCatalogModels';
import { ModelRow } from './ModelRow';

type Props = {
  readonly catalog: ReadonlyArray<CatalogModel>;
  readonly selectedKey: string;
  readonly recommendedKey?: string;
  readonly query: string;
  readonly advisoryModels: ReadonlySet<string>;
  readonly onQuery: (query: string) => void;
  readonly onSelect: (model: CatalogModel, variant?: string) => void;
};

export const ModelList = ({
  catalog,
  selectedKey,
  recommendedKey,
  query,
  advisoryModels,
  onQuery,
  onSelect,
}: Props) => {
  const results = filterCatalogModels({ catalog, query });
  return (
    <section aria-label="Models" className="flex min-h-0 flex-col gap-2 p-3">
      <label className="relative flex items-center">
        <Search
          size={13}
          aria-hidden
          className="pointer-events-none absolute left-2.5 text-muted-foreground"
        />
        <Input
          autoFocus
          aria-label="Search models"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search models"
          className="pl-8"
        />
      </label>
      <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-[15rem]">
        <div className="flex flex-col gap-1">
          {results.map(({ model, variant }) => {
            return (
              <ModelRow
                key={model.key}
                model={model}
                active={selectedKey === model.key}
                matchedVariant={variant}
                hasMaxModeAdvisory={advisoryModels.has(model.key)}
                isRecommended={recommendedKey === model.key}
                onSelect={() => onSelect(model, variant)}
              />
            );
          })}
          {results.length === 0 && (
            <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">
              No matching models
            </p>
          )}
        </div>
      </ScrollFade>
    </section>
  );
};
