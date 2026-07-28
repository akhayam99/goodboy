import {
  PROVIDER_CAPABILITIES,
  modelIdForSelection,
  resolveModelArgs,
  resolveStoredModelSelection,
} from '@goodboy/core';
import { Button, Divider, ScrollFade, cn } from '@goodboy/ui';
import type { ModelSelection, ProviderId } from '@goodboy/types';
import { EFFORT_LABEL, PROVIDER_LABEL } from '../../../chat/utils/chat-constants';
import { ModelGrid } from '../../../../shared/components/RoutingPicker/ModelGrid';
import { PickerChip } from '../../../../shared/components/RoutingPicker/PickerChip';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { orderedEffortLevels } from '../../../../shared/components/RoutingPicker/orderedEffortLevels';
import { resolveRouting } from '../../../../shared/components/RoutingPicker/resolveRouting';
import type { AgentKindRouting } from '../../agent-kind';

const PROVIDER_CHIP_GROUP_CLASS = 'flex gap-1.5 px-2.5 [&>button]:h-7 [&>button]:flex-1';
const CHIP_GROUP_CLASS = 'flex flex-wrap gap-1 px-2.5';
const PROVIDERS = Object.keys(PROVIDER_CAPABILITIES).filter(
  (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
);

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly effective: AgentKindRouting;
  readonly viewProvider: ProviderId;
  readonly onViewProvider: (provider: ProviderId) => void;
  readonly onPickProvider: (provider: ProviderId) => void;
  readonly onPickModel: (model: string, effort: AgentKindRouting['effort']) => void;
  readonly onPickEffort: (effort: AgentKindRouting['effort']) => void;
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
  onPickEffort,
  onConnectProvider,
}: Props) => {
  const viewedRouting = resolveRouting({
    providers: PROVIDERS,
    provider: viewProvider,
    model: viewProvider === effective.provider ? effective.model : '',
    effort: effective.effort,
    recommendation: undefined,
  });
  const isProviderConnected = connectedProviders.includes(viewProvider);
  const onPickSelection = ({ selection }: PickSelectionParams) => {
    const resolved = resolveModelArgs({ provider: viewProvider, selection });
    const applied = resolved.clamped?.applied ?? selection.effort ?? effective.effort;
    onPickModel(modelIdForSelection({ provider: viewProvider, selection }), applied);
  };
  const onSelectModel = (model: string) => {
    const selection = resolveStoredModelSelection({
      provider: viewProvider,
      id: model,
      effort: effective.effort,
    }).selection;
    onPickSelection({ selection });
  };

  return (
    <>
      <PickerSection label="Provider" hint="Which CLI agent runs the turn">
        <div className={PROVIDER_CHIP_GROUP_CLASS}>
          {PROVIDERS.map((id) => {
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
            <ModelGrid
              provider={viewProvider}
              ids={viewedRouting.models}
              value={viewedRouting.model}
              selection={viewedRouting.selection}
              isRecommended={false}
              onSelect={onSelectModel}
              onSelection={(selection) => onPickSelection({ selection })}
            />
          </ScrollFade>
        )}
      </PickerSection>
      {isProviderConnected && (
        <>
          <Divider />
          <PickerSection label="Effort" hint="How hard the model thinks before answering">
            <div className={CHIP_GROUP_CLASS}>
              {viewedRouting.isEffortFixed ? (
                <PickerChip label="Default" active disabled onSelect={() => undefined} />
              ) : (
                orderedEffortLevels({ levels: viewedRouting.effortLevels }).map((level) => (
                  <PickerChip
                    key={level}
                    label={EFFORT_LABEL[level]}
                    active={viewedRouting.effort === level}
                    onSelect={() =>
                      onPickSelection({
                        selection: { ...viewedRouting.selection, effort: level },
                      })
                    }
                  />
                ))
              )}
              {viewedRouting.hasThinkingToggle && (
                <PickerChip
                  label="Thinking"
                  active={viewedRouting.selection.toggles?.thinking === true}
                  onSelect={() =>
                    onPickSelection({
                      selection: {
                        ...viewedRouting.selection,
                        toggles: {
                          ...viewedRouting.selection.toggles,
                          thinking: viewedRouting.selection.toggles?.thinking !== true,
                        },
                      },
                    })
                  }
                />
              )}
              {viewedRouting.hasFastToggle && (
                <PickerChip
                  label="Fast"
                  active={viewedRouting.selection.toggles?.fast === true}
                  onSelect={() =>
                    onPickSelection({
                      selection: {
                        ...viewedRouting.selection,
                        toggles: {
                          ...viewedRouting.selection.toggles,
                          fast: viewedRouting.selection.toggles?.fast !== true,
                        },
                      },
                    })
                  }
                />
              )}
            </div>
          </PickerSection>
        </>
      )}
    </>
  );
};
