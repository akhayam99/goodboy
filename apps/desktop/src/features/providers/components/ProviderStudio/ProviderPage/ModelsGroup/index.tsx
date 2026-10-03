import { useEffect, useRef } from 'react';
import {
  MODEL_CATALOGS,
  isModelHidden,
  visibleModelCount,
  withModelsVisible,
  type HiddenModels,
} from '@goodboy/core';
import type { CatalogModel, ProviderId } from '@goodboy/types';
import { BAND_ROW_CLASS, Band, Button, Switch, Tooltip, cn } from '@goodboy/ui';
import { PickerChip } from '../../../../../../shared/components/RoutingPicker/PickerChip';
import { useHiddenModels, useSaveHiddenModels } from '../../../../hooks/useHiddenModels';

const LAST_VISIBLE_COPY = 'At least one model stays visible';

type Props = {
  readonly providerId: ProviderId;
  readonly isFocused: boolean;
};

type Family = {
  readonly label: string;
  readonly models: ReadonlyArray<CatalogModel>;
};

type FamiliesParams = {
  readonly providerId: ProviderId;
};

const familiesOf = ({ providerId }: FamiliesParams): ReadonlyArray<Family> => {
  const catalog: ReadonlyArray<CatalogModel> = [...MODEL_CATALOGS[providerId]].sort(
    (left, right) => left.presentation.order - right.presentation.order,
  );
  const byGroup = new Map<string, Array<CatalogModel>>();
  for (const model of catalog) {
    const members = byGroup.get(model.presentation.group) ?? [];
    members.push(model);
    byGroup.set(model.presentation.group, members);
  }
  return [...byGroup.entries()].map(([label, models]) => ({
    label,
    models: [...models].sort((left, right) =>
      right.presentation.version.localeCompare(left.presentation.version, 'en', {
        numeric: true,
      }),
    ),
  }));
};

const versionLabel = (model: CatalogModel): string =>
  model.presentation.checkpoint == null
    ? model.presentation.version
    : `${model.presentation.version} ${model.presentation.checkpoint}`;

export const ModelsGroup = ({ providerId, isFocused }: Props) => {
  const hidden = useHiddenModels();
  const saveHidden = useSaveHiddenModels();
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const families = familiesOf({ providerId });
  const total = MODEL_CATALOGS[providerId].length;
  const shown = visibleModelCount({ provider: providerId, hidden });

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    sectionRef.current?.scrollIntoView?.({ block: 'start' });
  }, [isFocused]);

  const save = (next: HiddenModels) => {
    if (next === hidden) {
      return;
    }
    void saveHidden(next);
  };

  const setVisible = (keys: ReadonlyArray<string>, visible: boolean) =>
    save(withModelsVisible({ provider: providerId, hidden, keys, visible }));

  return (
    <div ref={sectionRef} className="scroll-mt-4">
      <Band
        label="Models in the picker"
        ariaLabel="Models in the picker"
        hint="A model you turn off is hidden from pickers and Auto. A model you pinned keeps running."
        action={
          <div className="flex items-center gap-2">
            <span className="text-secondary text-faint-foreground">
              Showing {shown} of {total}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={shown === total}
              onClick={() => save({ ...hidden, [providerId]: [] })}
            >
              Show all
            </Button>
          </div>
        }
      >
        {families.map((family) => {
          const keys = family.models.map((model) => model.key);
          const visibleKeys = keys.filter(
            (key) => !isModelHidden({ provider: providerId, hidden, key }),
          );
          const isFamilyOn = visibleKeys.length > 0;
          const isOnlyVisibleFamily = isFamilyOn && shown === visibleKeys.length;
          return (
            <div key={family.label} className={cn(BAND_ROW_CLASS, 'gap-3')}>
              <Tooltip content={isOnlyVisibleFamily ? LAST_VISIBLE_COPY : `Show ${family.label}`}>
                <Switch
                  label={<span className="w-24 truncate text-left text-body">{family.label}</span>}
                  checked={isFamilyOn}
                  disabled={isOnlyVisibleFamily}
                  onChange={(next) => setVisible(keys, next)}
                />
              </Tooltip>
              <div
                role="group"
                aria-label={`${family.label} versions`}
                className="flex min-w-0 flex-1 flex-wrap gap-1"
              >
                {family.models.map((model) => {
                  const isVisible = !isModelHidden({
                    provider: providerId,
                    hidden,
                    key: model.key,
                  });
                  const isLastVisible = isVisible && shown === 1;
                  return (
                    <PickerChip
                      key={model.key}
                      label={versionLabel(model)}
                      active={isVisible}
                      disabled={isLastVisible}
                      {...(isLastVisible && { title: LAST_VISIBLE_COPY })}
                      onSelect={() => setVisible([model.key], !isVisible)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </Band>
    </div>
  );
};
