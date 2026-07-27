import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import { Button, Divider, ScrollFade, cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { EFFORT_LABEL, PROVIDER_LABEL, modelLabel } from '../../../chat/utils/chat-constants';
import { ModelGrid } from '../../../../shared/components/RoutingPicker/ModelGrid';
import { PickerChip } from '../../../../shared/components/RoutingPicker/PickerChip';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { RecommendationRow } from '../../../../shared/components/RoutingPicker/RecommendationRow';
import { orderedEffortLevels } from '../../../../shared/components/RoutingPicker/orderedEffortLevels';
import { recommendationSummary } from '../../../../shared/components/RoutingPicker/recommendationSummary';
import { resolveRouting } from '../../../../shared/components/RoutingPicker/resolveRouting';
import type { AgentKindRouting } from '../../agent-kind';

const PROVIDER_CHIP_GROUP_CLASS = 'flex gap-1.5 px-2.5 [&>button]:h-7 [&>button]:flex-1';
const CHIP_GROUP_CLASS = 'flex flex-wrap gap-1 px-2.5';
const PROVIDERS = Object.keys(PROVIDER_CAPABILITIES).filter(
  (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
);

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly recommended: AgentKindRouting;
  readonly routing: AgentKindRouting | null;
  readonly viewProvider: ProviderId;
  readonly onViewProvider: (provider: ProviderId) => void;
  readonly onPickProvider: (provider: ProviderId) => void;
  readonly onPickModel: (model: string) => void;
  readonly onPickEffort: (effort: AgentKindRouting['effort']) => void;
  readonly onUseRecommended: () => void;
  readonly onConnectProvider: (provider: ProviderId) => void;
};

export const AgentRoutingSections = ({
  connectedProviders,
  recommended,
  routing,
  viewProvider,
  onViewProvider,
  onPickProvider,
  onPickModel,
  onPickEffort,
  onUseRecommended,
  onConnectProvider,
}: Props) => {
  const isAuto = routing == null;
  const isViewingPicked = !isAuto && routing.provider === viewProvider;
  const viewedRouting = resolveRouting({
    providers: PROVIDERS,
    provider: viewProvider,
    model: isViewingPicked ? routing.model : '',
    effort: routing?.effort ?? recommended.effort,
    recommendation: undefined,
  });
  const isProviderConnected = connectedProviders.includes(viewProvider);

  return (
    <>
      <RecommendationRow
        summary={recommendationSummary({
          provider: recommended.provider,
          model: recommended.model,
        })}
        active={isAuto}
        onSelect={onUseRecommended}
      />
      <Divider />
      <PickerSection label="Provider" hint="Which CLI agent runs the turn">
        <div className={PROVIDER_CHIP_GROUP_CLASS}>
          {PROVIDERS.map((id) => {
            const isConnected = connectedProviders.includes(id);
            const isActive = !isAuto && viewProvider === id;
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
          <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-[13rem]">
            <ModelGrid
              ids={viewedRouting.models}
              value={viewedRouting.model}
              isRecommended={isAuto}
              onSelect={onPickModel}
            />
          </ScrollFade>
        )}
      </PickerSection>
      {isProviderConnected && viewedRouting.effortLevels != null && (
        <>
          <Divider />
          <PickerSection label="Effort" hint="How hard the model thinks before answering">
            <div className={CHIP_GROUP_CLASS}>
              {orderedEffortLevels({ levels: viewedRouting.effortLevels }).map((level) => (
                <PickerChip
                  key={level}
                  label={EFFORT_LABEL[level]}
                  active={viewedRouting.effort === level}
                  onSelect={() => onPickEffort(level)}
                />
              ))}
            </div>
          </PickerSection>
        </>
      )}
      {isProviderConnected && viewedRouting.effortLevels == null && (
        <>
          <Divider />
          <PickerSection label="Effort">
            <p className="px-2.5 text-2xs leading-relaxed text-muted-foreground/60">
              {modelLabel(viewedRouting.model)} runs at a fixed effort.
            </p>
          </PickerSection>
        </>
      )}
    </>
  );
};
