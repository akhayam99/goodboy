import type { CatalogModel } from '@goodboy/types';
import { FAMILY_SECTION_LABEL } from '../../../features/chat/utils/chat-constants';
import { groupCatalog } from './groupCatalog';
import { VersionChip } from './VersionChip';

type Props = {
  readonly catalog: ReadonlyArray<CatalogModel>;
  readonly selectedKey: string;
  readonly recommendedKey?: string;
  readonly advisoryKeys: ReadonlySet<string>;
  readonly onSelect: (model: CatalogModel) => void;
};

export const CatalogGrid = ({
  catalog,
  selectedKey,
  recommendedKey,
  advisoryKeys,
  onSelect,
}: Props) => {
  const sections = groupCatalog({ catalog });
  const showFamilyHeaders = sections.length > 1;
  return (
    <section aria-label="Models" className="flex flex-col gap-1 py-3">
      {sections.map((section) => (
        <div key={section.family} className="flex flex-col gap-0.5">
          {showFamilyHeaders && (
            <span className="px-2.5 pt-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground/50">
              {FAMILY_SECTION_LABEL[section.family]}
            </span>
          )}
          {section.rows.map((row, rowIndex) =>
            row.group == null ? (
              <div
                key={`${section.family}-ungrouped-${rowIndex}`}
                className="flex flex-wrap gap-1 px-2.5"
              >
                {row.models.map((model) => (
                  <VersionChip
                    key={model.key}
                    model={model}
                    active={model.key === selectedKey}
                    isRecommended={model.key === recommendedKey}
                    hasMaxModeAdvisory={advisoryKeys.has(model.key)}
                    onSelect={() => onSelect(model)}
                  />
                ))}
              </div>
            ) : (
              <div
                key={`${section.family}-${row.group}-${rowIndex}`}
                className="flex items-center gap-2 px-2.5 py-0.5"
              >
                <span className="flex-1 text-2xs text-muted-foreground/70">{row.group}</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {row.models.map((model) => (
                    <VersionChip
                      key={model.key}
                      model={model}
                      active={model.key === selectedKey}
                      isRecommended={model.key === recommendedKey}
                      hasMaxModeAdvisory={advisoryKeys.has(model.key)}
                      onSelect={() => onSelect(model)}
                    />
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      ))}
    </section>
  );
};
