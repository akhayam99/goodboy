import { useState, type ReactNode } from 'react';
import { withShortcutHint, type ShortcutId } from '../../keyboard/registry';
import { ChevronDown, X } from 'lucide-react';
import { MODEL_CATALOGS } from '@goodboy/core';
import { AnchoredPopover, cn, Tooltip, useDropdown, tintClasses } from '@goodboy/ui';
import type { ProviderId, VerbosityLevel } from '@goodboy/types';
import { TriggerLabel } from './TriggerLabel';
import { AUTO_LABEL, AutoTriggerLabel } from './AutoTriggerLabel';
import type { RecommendationKind } from './RecommendationRow';
import { recommendationSummary, recommendedRoutingOf } from './recommendationSummary';
import { ROUTING_PICKER_CONSTANTS } from './constants';
import { routingSummary, routingTriggerLabel } from './routingSummary';
import { resolveRouting, type Recommendation } from './resolveRouting';
import { RoutingPickerBody, type EffortSetting, type PickerCommit } from './RoutingPickerBody';
import type { PickedRoute } from './PickedRoute';
import { ICON_SIZE } from '../conceptIcons';

export type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: EffortSetting;
  readonly disabled: boolean;
  readonly onChange: (route: PickedRoute) => void;
  readonly commit?: PickerCommit;
  readonly recommendation?: Recommendation;
  readonly recommendationKind?: RecommendationKind;
  readonly footer?: ReactNode;
  readonly verbosity?: VerbosityLevel;
  readonly onVerbosity?: (verbosity: VerbosityLevel) => void;
  readonly onReset?: () => void;
  readonly resetLabel?: string;
  readonly hasTriggerReset?: boolean;
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
  readonly isEffortHidden?: boolean;
  readonly providerLayout?: 'glyphs' | 'named';
  readonly budget?: ReactNode;
  readonly autoTrigger?: 'word' | 'resolved';
  readonly triggerPrefix?: string;
  readonly quietLabel?: string;
};

export const RoutingPicker = ({
  connectedProviders,
  provider,
  model,
  effort,
  disabled,
  onChange,
  commit,
  recommendation,
  recommendationKind,
  footer,
  verbosity,
  onVerbosity,
  onReset,
  resetLabel,
  hasTriggerReset = true,
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
  isEffortHidden = false,
  providerLayout = 'glyphs',
  budget,
  autoTrigger = 'word',
  triggerPrefix,
  quietLabel,
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
  const showEffort = !routing.isEffortFixed && !isEffortHidden;
  const routingModel = MODEL_CATALOGS[routing.provider].find(
    (candidate) => candidate.key === routing.model,
  );
  const triggerLabel = routingTriggerLabel({
    model: routingModel ?? null,
    modelId: routing.model,
    provider: routing.provider,
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
  const resolvedAuto =
    isAuto && autoTrigger === 'resolved' && recommendation?.provider != null
      ? recommendedRoutingOf({
          provider: recommendation.provider,
          model: recommendation.model,
          effort: recommendation.effort,
        })
      : null;
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
      onChange={onChange}
      onClose={close}
      summary={summary}
      availability={availability}
      isInline={isInline}
      isEffortHidden={isEffortHidden}
      providerLayout={providerLayout}
      onConnectionInFlightChange={setIsProviderConnectionInFlight}
      {...(!isInline && { focusRoot: dropdown.popupRef })}
      {...(commit != null && { commit })}
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
          {onReset != null && hasTriggerReset && isOverridden && !disabled && (
            <Tooltip
              content={defaultSummary != null ? `${resetCopy} (${defaultSummary})` : resetCopy}
            >
              <button
                type="button"
                onClick={onReset}
                aria-label={resetAriaLabel}
                className="shrink-0 rounded-full p-1 text-faint-foreground transition-colors hover:bg-hover hover:text-foreground"
              >
                <X size={ICON_SIZE.mark} aria-hidden />
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
                'items-center gap-2 text-label transition-colors',
                variant === 'pill'
                  ? 'inline-flex rounded-full px-3 py-0.5'
                  : 'flex w-full rounded-md border px-2 py-2 text-left',
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
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {quietLabel != null ? (
                  <span className="text-muted-foreground">{quietLabel}</span>
                ) : triggerPrefix != null ? (
                  <span className="shrink-0 text-muted-foreground">{triggerPrefix}</span>
                ) : null}
                {quietLabel != null ? null : resolvedAuto?.label != null ? (
                  <TriggerLabel provider={resolvedAuto.provider} label={resolvedAuto.label} />
                ) : isAuto ? (
                  <AutoTriggerLabel />
                ) : (
                  <TriggerLabel provider={routing.provider} label={triggerLabel} />
                )}
                {budget}
              </span>
              <ChevronDown
                size={ICON_SIZE.row}
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
