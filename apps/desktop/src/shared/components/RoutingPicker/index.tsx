import { useState, type ReactNode } from 'react';
import { withShortcutHint, type ShortcutId } from '../../keyboard/registry';
import { ChevronDown, X } from 'lucide-react';
import { MODEL_CATALOGS } from '@goodboy/core';
import { AnchoredPopover, cn, Tooltip, useDropdown, tintClasses } from '@goodboy/ui';
import type { ProviderId, VerbosityLevel } from '@goodboy/types';
import { TriggerLabel } from './TriggerLabel';
import { AUTO_LABEL, AutoTriggerLabel } from './AutoTriggerLabel';
import type { RecommendationKind } from './RecommendationRow';
import { recommendationSummary } from './recommendationSummary';
import { ROUTING_PICKER_CONSTANTS } from './constants';
import { routingSummary, routingTriggerLabel } from './routingSummary';
import { resolveRouting, type Recommendation } from './resolveRouting';
import { RoutingPickerBody, type EffortSetting } from './RoutingPickerBody';

export type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: EffortSetting;
  readonly disabled: boolean;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly recommendation?: Recommendation;
  readonly recommendationKind?: RecommendationKind;
  readonly footer?: ReactNode;
  readonly verbosity?: VerbosityLevel;
  readonly onVerbosity?: (verbosity: VerbosityLevel) => void;
  readonly onReset?: () => void;
  readonly resetLabel?: string;
  readonly overridden?: boolean;
  readonly defaultSummary?: string;
  readonly variant?: 'field' | 'pill';
  readonly align?: 'start' | 'end';
  readonly disabledTitle?: string;
  readonly ariaLabel?: string;
  readonly openEvent?: string;
  readonly shortcut?: ShortcutId;
  readonly availability?: 'run' | 'setup';
  readonly presentation?: 'popover' | 'inline';
};

export const RoutingPicker = ({
  connectedProviders,
  provider,
  model,
  effort,
  disabled,
  onProvider,
  onModel,
  recommendation,
  recommendationKind,
  footer,
  verbosity,
  onVerbosity,
  onReset,
  resetLabel,
  overridden,
  defaultSummary,
  variant = 'field',
  align = 'start',
  disabledTitle,
  ariaLabel,
  openEvent,
  shortcut,
  availability = 'run',
  presentation = 'popover',
}: Props) => {
  const isInline = presentation === 'inline';
  const [isProviderConnectionInFlight, setIsProviderConnectionInFlight] = useState(false);
  const dropdown = useDropdown({
    disabled,
    align,
    openEvent,
    expectedHeight: 320,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    isEscapeEnabled: isProviderConnectionInFlight === false,
  });
  const { open, close, toggle } = dropdown;
  const effortValue = effort.value ?? 'medium';
  const resetCopy = resetLabel ?? 'reset to default';
  const resetAriaLabel = resetLabel ?? 'Reset routing override';
  const routing = resolveRouting({
    providers: ROUTING_PICKER_CONSTANTS.providers,
    provider,
    model,
    effort: effortValue,
    recommendation,
  });
  const isOverridden = overridden === true;
  const showEffort = !routing.isEffortFixed;
  const routingModel = MODEL_CATALOGS[routing.provider].find(
    (candidate) => candidate.key === routing.model,
  );
  const triggerLabel = routingTriggerLabel({
    model: routingModel ?? null,
    modelId: routing.model,
    selection: routing.selection,
    effort: routing.effort,
    showEffort,
    ...(verbosity != null && { verbosity }),
  });
  const isAuto = recommendationKind === 'auto' && recommendation?.provider != null && !isOverridden;
  const autoSummary =
    recommendation?.provider == null
      ? null
      : recommendationSummary({
          provider: recommendation.provider,
          model: recommendation.model,
          effort: recommendation.effort,
        });
  const summary =
    isAuto && autoSummary != null
      ? `${AUTO_LABEL}, now ${autoSummary}`
      : routingSummary({ provider: routing.provider, label: triggerLabel });

  const body = (
    <RoutingPickerBody
      connectedProviders={connectedProviders}
      provider={provider}
      model={model}
      effort={effort}
      onProvider={onProvider}
      onModel={onModel}
      onClose={close}
      summary={summary}
      availability={availability}
      isInline={isInline}
      onConnectionInFlightChange={setIsProviderConnectionInFlight}
      {...(!isInline && { focusRoot: dropdown.popupRef })}
      {...(recommendation != null && { recommendation })}
      {...(recommendationKind != null && { recommendationKind })}
      {...(verbosity != null && { verbosity })}
      {...(onVerbosity != null && { onVerbosity })}
      {...(onReset != null && { onReset })}
      {...(overridden != null && { overridden })}
      {...(defaultSummary != null && { defaultSummary })}
    />
  );

  if (isInline) {
    return (
      <div
        role="group"
        aria-label={ariaLabel ?? 'model routing'}
        aria-disabled={disabled}
        className={cn('flex min-w-0 flex-col', disabled && 'pointer-events-none opacity-60')}
      >
        {body}
        {footer}
      </div>
    );
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={ariaLabel ?? 'model routing'}
      className="flex max-h-[calc(100vh-1rem)] flex-col bg-subtle"
      anchorClassName={cn('flex items-center gap-1', variant === 'field' && 'w-full')}
      trigger={
        <>
          {onReset != null && isOverridden && !disabled && (
            <Tooltip
              content={defaultSummary != null ? `${resetCopy} (${defaultSummary})` : resetCopy}
            >
              <button
                type="button"
                onClick={onReset}
                aria-label={resetAriaLabel}
                className="shrink-0 rounded-full p-1 text-faint-foreground transition-colors hover:bg-hover hover:text-foreground"
              >
                <X size={10} aria-hidden />
              </button>
            </Tooltip>
          )}
          <Tooltip
            content={
              disabled
                ? (disabledTitle ?? summary)
                : shortcut !== undefined
                  ? withShortcutHint({ label: summary, shortcut })
                  : `${summary}. Click to change.`
            }
            anchorClassName={variant === 'field' ? 'w-full' : undefined}
          >
            <button
              type="button"
              onClick={toggle}
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label={ariaLabel != null ? `${ariaLabel}: ${summary}` : summary}
              className={cn(
                'items-center gap-1.5 text-xs transition-colors',
                variant === 'pill'
                  ? 'inline-flex rounded-full px-2.5 py-0.5'
                  : 'flex w-full rounded-md border px-2 py-1.5 text-left',
                variant === 'field' &&
                  (open
                    ? cn('border-primary', tintClasses('primary').bgSoft)
                    : 'border-border-soft bg-subtle hover:border-border hover:bg-hover'),
                variant === 'pill' &&
                  (isOverridden
                    ? cn(
                        tintClasses('warning').bg,
                        'ring-1',
                        tintClasses('warning').ring,
                        tintClasses('warning').hoverBg,
                      )
                    : 'bg-subtle hover:bg-hover'),
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                {isAuto ? (
                  <AutoTriggerLabel />
                ) : (
                  <TriggerLabel provider={routing.provider} label={triggerLabel} />
                )}
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
          </Tooltip>
        </>
      }
    >
      {body}
      {footer}
    </AnchoredPopover>
  );
};
