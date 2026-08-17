import { useState } from 'react';
import { MODEL_CATALOGS, modelAxes, modelIdForSelection } from '@goodboy/core';
import { Divider } from '@goodboy/ui';
import type { ModelSelection, ProviderId } from '@goodboy/types';
import { AxesSection } from '../../../../shared/components/RoutingPicker/AxesSection';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
import { ProviderGrid } from '../../../../shared/components/RoutingPicker/ProviderGrid';
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
  const hasMaxModeAdvisory = viewProvider === 'cursor' && maxModeModels.has(viewedModel.key);

  return (
    <>
      <PickerSection label="Provider">
        {connectedProviders.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">No providers connected</p>
        ) : (
          <ProviderGrid
            connectedProviders={connectedProviders}
            activeProvider={viewProvider}
            onSelect={(provider) => {
              onViewProvider(provider);
              setClampNotice(undefined);
              onPickProvider(provider);
            }}
          />
        )}
      </PickerSection>
      <Divider />
      <div>
        {!isProviderConnected && (
          <p className="px-2.5 py-1 text-xs text-muted-foreground">
            Selected provider is not connected
          </p>
        )}
      </div>
      {isProviderConnected && (
        <>
          <Divider />
          <AxesSection
            axes={axes}
            effortValue={viewedRouting.effort}
            canEditEffort
            notice={clampNotice}
            hasMaxModeAdvisory={hasMaxModeAdvisory}
            onModel={(modelKey) => {
              const model = viewedRouting.catalog.find((candidate) => candidate.key === modelKey);
              if (model == null) {
                return;
              }
              onPickSelection({
                selection: selectionForModel({ model, effort: viewedRouting.effort }),
              });
            }}
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
