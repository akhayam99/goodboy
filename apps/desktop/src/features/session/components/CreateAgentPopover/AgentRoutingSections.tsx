import { useState } from 'react';
import { MODEL_CATALOGS, modelAxes, modelIdForSelection } from '@goodboy/core';
import { Button, Divider, ScrollFade, cn } from '@goodboy/ui';
import type { ModelSelection, ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../chat/utils/chat-constants';
import { AxesSection } from '../../../../shared/components/RoutingPicker/AxesSection';
import { CatalogGrid } from '../../../../shared/components/RoutingPicker/CatalogGrid';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { ROUTING_PICKER_CONSTANTS } from '../../../../shared/components/RoutingPicker/constants';
import { resolvePickerSelection } from '../../../../shared/components/RoutingPicker/resolvePickerSelection';
import { resolveRouting } from '../../../../shared/components/RoutingPicker/resolveRouting';
import { selectionForModel } from '../../../../shared/components/RoutingPicker/selectionForModel';
import { useCursorMaxModeModels } from '../../../../shared/components/RoutingPicker/useCursorMaxModeModels';
import type { AgentKindRouting } from '../../agent-kind';

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly effective: AgentKindRouting;
  readonly viewProvider: ProviderId;
  readonly onViewProvider: (provider: ProviderId) => void;
  readonly onPickProvider: (provider: ProviderId) => void;
  readonly onPickModel: (model: string, effort: AgentKindRouting['effort']) => void;
  readonly onConnectProvider: (provider: ProviderId) => void;
};

type PickSelectionParams = {
  readonly selection: ModelSelection;
};

export const AgentRoutingSections = ({
  connectedProviders,
  effective,
  viewProvider,
  onViewProvider,
  onPickProvider,
  onPickModel,
  onConnectProvider,
}: Props) => {
  const viewedRouting = resolveRouting({
    providers: ROUTING_PICKER_CONSTANTS.providers,
    provider: viewProvider,
    model: viewProvider === effective.provider ? effective.model : '',
    effort: effective.effort,
    recommendation: undefined,
  });
  const [clampNotice, setClampNotice] = useState(viewedRouting.clamped);
  const isProviderConnected = connectedProviders.includes(viewProvider);
  const onPickSelection = ({ selection }: PickSelectionParams) => {
    const resolved = resolvePickerSelection({
      provider: viewProvider,
      selection,
      fallbackEffort: effective.effort,
    });
    const applied = resolved.effort ?? effective.effort;
    setClampNotice(resolved.notice);
    onPickModel(modelIdForSelection({ provider: viewProvider, selection }), applied);
  };
  const viewedModel =
    viewedRouting.catalog.find((candidate) => candidate.key === viewedRouting.model) ??
    viewedRouting.catalog[0];
  if (viewedModel == null) {
    throw new Error(`provider catalog is empty: ${viewProvider}`);
  }
  const axes = modelAxes({ model: viewedModel, selection: viewedRouting.selection });
  const cursorModels = MODEL_CATALOGS.cursor.map((entry) => entry.key);
  const maxModeModels = useCursorMaxModeModels({ models: cursorModels });
  const advisoryKeys =
    viewProvider === 'cursor' ? maxModeModels : ROUTING_PICKER_CONSTANTS.emptyModelKeys;
  const hasMaxModeAdvisory = viewProvider === 'cursor' && maxModeModels.has(viewedModel.key);

  return (
    <>
      <PickerSection label="Provider" hint="Which CLI agent runs the turn">
        <div className={ROUTING_PICKER_CONSTANTS.providerChipGroupClassName}>
          {ROUTING_PICKER_CONSTANTS.providers.map((id) => {
            const isConnected = connectedProviders.includes(id);
            const isActive = viewProvider === id;
            return (
              <button
                key={id}
                type="button"
                title={PROVIDER_LABEL[id]}
                aria-label={PROVIDER_LABEL[id]}
                aria-pressed={isActive}
                onClick={() => {
                  onViewProvider(id);
                  setClampNotice(undefined);
                  if (!isConnected) {
                    return;
                  }
                  onPickProvider(id);
                }}
                className={cn(
                  'relative inline-flex min-w-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground',
                  isActive && 'bg-background text-foreground shadow-sm',
                )}
              >
                <span className={cn(!isConnected && 'opacity-35')}>
                  <ProviderGlyph id={id} size={15} />
                </span>
                {!isConnected && (
                  <span
                    aria-hidden
                    className="absolute right-1 top-1 size-1.5 rounded-full bg-warning ring-1 ring-subtle"
                  />
                )}
              </button>
            );
          })}
        </div>
      </PickerSection>
      <Divider />
      <PickerSection label="Model" hint="Color shows the cost tier">
        {!isProviderConnected && (
          <div className="flex items-center gap-2 px-2.5 py-1">
            <p className="flex-1 text-xs text-muted-foreground">
              {PROVIDER_LABEL[viewProvider]} is not connected
            </p>
            <Button size="sm" onClick={() => onConnectProvider(viewProvider)}>
              Connect {PROVIDER_LABEL[viewProvider]}
            </Button>
          </div>
        )}
        {isProviderConnected && (
          <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-[15rem]">
            <CatalogGrid
              catalog={viewedRouting.catalog}
              selectedKey={viewedRouting.model}
              recommendedKey={undefined}
              advisoryKeys={advisoryKeys}
              onSelect={(model) =>
                onPickSelection({
                  selection: selectionForModel({ model, effort: viewedRouting.effort }),
                })
              }
            />
          </ScrollFade>
        )}
      </PickerSection>
      {isProviderConnected && (
        <>
          <Divider />
          <AxesSection
            axes={axes}
            effortValue={viewedRouting.effort}
            canEditEffort
            notice={clampNotice}
            hasMaxModeAdvisory={hasMaxModeAdvisory}
            onEffort={(level) =>
              onPickSelection({
                selection: { ...viewedRouting.selection, effort: level },
              })
            }
            onVariant={(id) =>
              onPickSelection({
                selection: { ...viewedRouting.selection, variant: id },
              })
            }
            onToggle={(id) =>
              onPickSelection({
                selection: {
                  ...viewedRouting.selection,
                  toggles: {
                    ...viewedRouting.selection.toggles,
                    [id]: !(viewedRouting.selection.toggles?.[id] ?? false),
                  },
                },
              })
            }
          />
        </>
      )}
    </>
  );
};
