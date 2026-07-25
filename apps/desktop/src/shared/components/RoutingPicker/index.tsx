import { ChevronDown, RotateCcw } from 'lucide-react';
import { Divider, Popover, ScrollFade, cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import {
  EFFORT_DOT,
  EFFORT_LABEL,
  PROVIDER_LABEL,
  modelLabel,
  type EffortLevel,
} from '../../../features/chat/utils/chat-constants';
import {
  VERBOSITY_DOT,
  VERBOSITY_LABEL,
  VERBOSITY_LEVELS,
  type VerbosityLevel,
} from '../../../features/settings/verbosity';
import { useDropdown } from '../../hooks/useDropdown';
import { ModelOptions } from './ModelOptions';
import { OptionRow } from './OptionRow';
import { PickerSection } from './PickerSection';
import { ProviderGlyph } from './ProviderGlyph';
import { TriggerLabel } from './TriggerLabel';
import { resolveRouting } from './resolveRouting';

export type Props = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort?: EffortLevel;
  readonly disabled: boolean;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly onEffort?: (effort: EffortLevel) => void;
  readonly recommendedProvider?: ProviderId;
  readonly recommendedModel?: string;
  readonly connectedProviders?: ReadonlyArray<ProviderId>;
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
  providers,
  provider,
  model,
  effort = 'medium',
  disabled,
  onProvider,
  onModel,
  onEffort,
  recommendedProvider,
  recommendedModel,
  connectedProviders,
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
    width: variant === 'pill' ? 'w-80' : 'w-full min-w-[15rem]',
  });
  const routing = resolveRouting({
    providers,
    provider,
    model,
    effort,
    recommendedProvider,
    recommendedModel,
  });
  const showEffort = onEffort != null && routing.effortLevels != null;
  const isModelRecommended = routing.isModelRecommended && recommendedModel != null;
  const summary = `${PROVIDER_LABEL[routing.provider]} · ${modelLabel(routing.model)}${
    showEffort ? ` · ${EFFORT_LABEL[routing.effort]} effort` : ''
  }`;

  const onPickProvider = (next: ProviderId | '') => {
    onProvider(next);
    close();
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
            isModelRecommended={isModelRecommended}
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
          className={cn(popupClassName, 'flex max-h-[24rem] flex-col bg-subtle')}
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
          <ScrollFade fadeFrom="subtle" className="min-h-0 flex-1">
            <PickerSection label="Provider" hint="Which CLI agent runs the turn">
              {(recommendedProvider != null || provider === '') && (
                <OptionRow
                  label={
                    recommendedProvider != null ? PROVIDER_LABEL[recommendedProvider] : 'Default'
                  }
                  active={routing.isProviderRecommended}
                  onSelect={() => onPickProvider('')}
                  glyph={
                    recommendedProvider != null ? (
                      <ProviderGlyph id={recommendedProvider} />
                    ) : (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                        aria-hidden
                      />
                    )
                  }
                  tag={recommendedProvider != null ? 'recommended' : undefined}
                />
              )}
              {providers
                .filter((id) => id !== recommendedProvider)
                .map((id) => {
                  const unavailable =
                    connectedProviders != null && !connectedProviders.includes(id);
                  return (
                    <OptionRow
                      key={id}
                      label={PROVIDER_LABEL[id]}
                      active={!routing.isProviderRecommended && routing.provider === id}
                      onSelect={() => onPickProvider(id)}
                      glyph={<ProviderGlyph id={id} />}
                      note={unavailable ? 'connect' : undefined}
                      title={unavailable ? 'not connected, click to connect' : undefined}
                    />
                  );
                })}
            </PickerSection>
            <Divider />
            <PickerSection label="Model" hint="Cost tier shown next to each variant">
              <ModelOptions
                ids={routing.models}
                value={routing.model}
                recommendedModel={recommendedModel}
                isRecommended={isModelRecommended}
                onSelect={(next) => {
                  onModel(next);
                  close();
                }}
              />
            </PickerSection>
            <Divider />
            <PickerSection label="Effort" hint="How hard the model thinks before answering">
              {onEffort == null && (
                <p className="px-2.5 text-2xs leading-relaxed text-muted-foreground/60">
                  This task always runs at the model default effort.
                </p>
              )}
              {onEffort != null && routing.effortLevels == null && (
                <p className="px-2.5 text-2xs leading-relaxed text-muted-foreground/60">
                  {modelLabel(routing.model)} answers in a single pass, so it has no thinking levels
                  to set.
                </p>
              )}
              {onEffort != null &&
                routing.effortLevels?.map((level) => (
                  <OptionRow
                    key={level}
                    label={EFFORT_LABEL[level]}
                    active={routing.effort === level}
                    onSelect={() => {
                      onEffort(level);
                      close();
                    }}
                    glyph={
                      <span
                        className={cn('size-1.5 shrink-0 rounded-full', EFFORT_DOT[level])}
                        aria-hidden
                      />
                    }
                  />
                ))}
            </PickerSection>
            {verbosity != null && onVerbosity != null && (
              <>
                <Divider />
                <PickerSection label="Replies" hint="How detailed the answers should be">
                  {VERBOSITY_LEVELS.map((level) => (
                    <OptionRow
                      key={level}
                      label={VERBOSITY_LABEL[level]}
                      active={verbosity === level}
                      onSelect={() => {
                        onVerbosity(level);
                        close();
                      }}
                      glyph={
                        <span
                          className={cn('size-1.5 shrink-0 rounded-full', VERBOSITY_DOT[level])}
                          aria-hidden
                        />
                      }
                    />
                  ))}
                </PickerSection>
              </>
            )}
          </ScrollFade>
        </Popover>
      )}
    </div>
  );
};
