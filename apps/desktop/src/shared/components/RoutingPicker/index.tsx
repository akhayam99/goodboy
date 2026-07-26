import { useEffect, useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import { Button, Divider, Popover, ScrollFade, cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  modelLabel,
  type EffortLevel,
} from '../../../features/chat/utils/chat-constants';
import {
  VERBOSITY_LABEL,
  VERBOSITY_LEVELS,
  type VerbosityLevel,
} from '../../../features/settings/verbosity';
import { useDropdown } from '../../hooks/useDropdown';
import { ModelGrid } from './ModelGrid';
import { PickerChip } from './PickerChip';
import { PickerSection } from './PickerSection';
import { ProviderGlyph } from './ProviderGlyph';
import { TriggerLabel } from './TriggerLabel';
import { resolveRouting } from './resolveRouting';

const CHIP_GROUP_CLASS_NAME = 'flex flex-wrap gap-1 bg-subtle px-2.5';
const PROVIDERS = Object.keys(PROVIDER_CAPABILITIES).filter(
  (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
);

type PickProviderParams = {
  readonly next: ProviderId | '';
  readonly viewedProvider: ProviderId;
};

export type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort?: EffortLevel;
  readonly disabled: boolean;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly onEffort?: (effort: EffortLevel) => void;
  readonly recommendedProvider?: ProviderId;
  readonly recommendedModel?: string;
  readonly verbosity?: VerbosityLevel;
  readonly onVerbosity?: (verbosity: VerbosityLevel) => void;
  readonly onReset?: () => void;
  readonly overridden?: boolean;
  readonly defaultSummary?: string;
  readonly variant?: 'field' | 'pill';
  readonly align?: 'start' | 'end';
  readonly disabledTitle?: string;
  readonly ariaLabel?: string;
  readonly openEvent?: string;
};

export const RoutingPicker = ({
  connectedProviders,
  provider,
  model,
  effort = 'medium',
  disabled,
  onProvider,
  onModel,
  onEffort,
  recommendedProvider,
  recommendedModel,
  verbosity,
  onVerbosity,
  onReset,
  overridden = false,
  defaultSummary,
  variant = 'field',
  align = 'start',
  disabledTitle,
  ariaLabel,
  openEvent,
}: Props) => {
  const { open, close, toggle, containerRef, popupClassName } = useDropdown({
    disabled,
    align,
    openEvent,
    expectedHeight: 320,
    width: 'w-80 max-w-[calc(100vw-2rem)]',
  });
  const routing = resolveRouting({
    providers: PROVIDERS,
    provider,
    model,
    effort,
    recommendedProvider,
    recommendedModel,
  });
  const [viewProvider, setViewProvider] = useState(routing.provider);
  const [isViewingAuto, setIsViewingAuto] = useState(routing.isProviderRecommended);
  const isViewingRoutingProvider = viewProvider === routing.provider;
  const viewedRouting = resolveRouting({
    providers: PROVIDERS,
    provider: viewProvider,
    model: isViewingRoutingProvider ? model : '',
    effort,
    recommendedProvider: isViewingRoutingProvider ? recommendedProvider : undefined,
    recommendedModel: isViewingRoutingProvider ? recommendedModel : undefined,
  });
  const viewedRecommendedModel = isViewingRoutingProvider ? recommendedModel : undefined;
  const isViewProviderConnected = connectedProviders.includes(viewProvider);
  const showEffort = onEffort != null && routing.effortLevels != null;
  const showViewedEffort = onEffort != null && viewedRouting.effortLevels != null;
  const isModelRecommended =
    isViewingRoutingProvider && routing.isModelRecommended && recommendedModel != null;
  const summary = `${PROVIDER_LABEL[routing.provider]} · ${modelLabel(routing.model)}${
    showEffort ? ` · ${EFFORT_LABEL[routing.effort]} effort` : ''
  }`;

  useEffect(() => {
    if (open) {
      return;
    }
    setViewProvider(routing.provider);
    setIsViewingAuto(routing.isProviderRecommended);
  }, [open, routing.isProviderRecommended, routing.provider]);

  const onPickProvider = ({ next, viewedProvider }: PickProviderParams) => {
    onProvider(next);
    setViewProvider(viewedProvider);
    setIsViewingAuto(next === '');
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative flex items-center gap-1', variant === 'field' && 'w-full')}
    >
      {onReset != null && overridden && !disabled && (
        <button
          type="button"
          onClick={onReset}
          title={
            defaultSummary != null ? `reset to default (${defaultSummary})` : 'reset to default'
          }
          aria-label="reset routing override"
          className="shrink-0 rounded-full p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw size={10} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        title={disabled ? disabledTitle : `${summary}. Click to change.`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'items-center gap-1.5 text-xs transition-colors',
          variant === 'pill'
            ? 'inline-flex rounded-full px-2.5 py-0.5'
            : 'flex w-full rounded-md border px-2 py-1.5 text-left',
          variant === 'field' &&
            (open
              ? 'border-primary bg-primary/5'
              : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50'),
          variant === 'pill' &&
            (overridden
              ? 'bg-warning/10 ring-1 ring-warning/30 hover:bg-warning/15'
              : 'bg-subtle hover:bg-muted'),
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <TriggerLabel
            provider={routing.provider}
            model={routing.model}
            effort={routing.effort}
            showEffort={showEffort}
            verbosity={verbosity}
          />
        </span>
        <ChevronDown
          size={11}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <Popover
          role="dialog"
          ariaLabel={ariaLabel ?? 'model routing'}
          className={cn(popupClassName, 'flex flex-col bg-subtle')}
        >
          {defaultSummary != null && (
            <div className="flex items-start gap-1.5 px-2.5 py-2 text-2xs leading-relaxed">
              <span
                className={cn(
                  'font-semibold uppercase tracking-wide',
                  overridden ? 'text-warning' : 'text-muted-foreground/70',
                )}
              >
                {overridden ? 'override' : 'default'}
              </span>
              <span className="flex-1 text-muted-foreground">
                {overridden ? summary : defaultSummary}
              </span>
              {onReset != null && overridden && (
                <button
                  type="button"
                  onClick={() => {
                    onReset();
                    close();
                  }}
                  className="font-medium text-warning underline-offset-2 hover:underline"
                >
                  reset
                </button>
              )}
            </div>
          )}
          <PickerSection label="Provider" hint="Which CLI agent runs the turn">
            <div className={CHIP_GROUP_CLASS_NAME}>
              {(recommendedProvider != null || provider === '') && (
                <PickerChip
                  label="auto"
                  active={isViewingAuto}
                  onSelect={() =>
                    onPickProvider({
                      next: '',
                      viewedProvider: routing.provider,
                    })
                  }
                  glyph={
                    recommendedProvider != null ? (
                      <ProviderGlyph id={recommendedProvider} size={15} />
                    ) : (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                        aria-hidden
                      />
                    )
                  }
                  note={
                    recommendedProvider != null ? PROVIDER_LABEL[recommendedProvider] : undefined
                  }
                />
              )}
              {PROVIDERS.map((id) => {
                const isConnected = connectedProviders.includes(id);
                const isActive = !isViewingAuto && viewProvider === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={PROVIDER_LABEL[id]}
                    aria-label={PROVIDER_LABEL[id]}
                    aria-pressed={isActive}
                    onClick={() => {
                      setViewProvider(id);
                      setIsViewingAuto(false);
                      if (!isConnected) {
                        return;
                      }
                      onProvider(id);
                    }}
                    className={cn(
                      'relative inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground',
                      isActive && 'bg-background text-foreground shadow-sm',
                    )}
                  >
                    <span className={cn(!isConnected && 'opacity-35')}>
                      <ProviderGlyph id={id} size={15} />
                    </span>
                    {!isConnected && (
                      <span
                        className="absolute right-1 top-1 size-1.5 rounded-full bg-warning ring-1 ring-subtle"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </PickerSection>
          <Divider />
          <PickerSection label="Model" hint="Premium variants marked with $$">
            {!isViewProviderConnected && (
              <div className="flex items-center gap-2 px-2.5 py-1">
                <p className="flex-1 text-xs text-muted-foreground">
                  {PROVIDER_LABEL[viewProvider]} is not connected
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('goodboy:open-provider-studio', {
                        detail: { providerId: viewProvider },
                      }),
                    );
                    close();
                  }}
                >
                  Connect {PROVIDER_LABEL[viewProvider]}
                </Button>
              </div>
            )}
            {isViewProviderConnected && (
              <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-[15rem]">
                <ModelGrid
                  ids={viewedRouting.models}
                  value={viewedRouting.model}
                  recommendedModel={viewedRecommendedModel}
                  isRecommended={isModelRecommended}
                  onSelect={onModel}
                />
              </ScrollFade>
            )}
          </PickerSection>
          {isViewProviderConnected && (
            <>
              <Divider />
              <PickerSection label="Effort" hint="How hard the model thinks before answering">
                {onEffort == null && (
                  <p className="px-2.5 text-2xs leading-relaxed text-muted-foreground/60">
                    This task always runs at the model default effort.
                  </p>
                )}
                {onEffort != null && viewedRouting.effortLevels == null && (
                  <p className="px-2.5 text-2xs leading-relaxed text-muted-foreground/60">
                    {modelLabel(viewedRouting.model)} answers in a single pass, so it has no
                    thinking levels to set.
                  </p>
                )}
                {showViewedEffort && viewedRouting.effortLevels != null && (
                  <div className={CHIP_GROUP_CLASS_NAME}>
                    {viewedRouting.effortLevels.map((level) => (
                      <PickerChip
                        key={level}
                        label={EFFORT_LABEL[level]}
                        active={viewedRouting.effort === level}
                        onSelect={() => onEffort(level)}
                      />
                    ))}
                  </div>
                )}
              </PickerSection>
              {verbosity != null && onVerbosity != null && (
                <>
                  <Divider />
                  <PickerSection label="Replies" hint="How detailed the answers should be">
                    <div className={CHIP_GROUP_CLASS_NAME}>
                      {VERBOSITY_LEVELS.map((level) => (
                        <PickerChip
                          key={level}
                          label={VERBOSITY_LABEL[level]}
                          active={verbosity === level}
                          onSelect={() => onVerbosity(level)}
                        />
                      ))}
                    </div>
                  </PickerSection>
                </>
              )}
            </>
          )}
        </Popover>
      )}
    </div>
  );
};
