import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getModelProvider } from '@goodboy/core';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { AUTO_LABEL } from '../../../../../shared/components/RoutingPicker/AutoTriggerLabel';
import { recommendationSummary } from '../../../../../shared/components/RoutingPicker/recommendationSummary';

export type FallbackChoice = {
  readonly providerId: ProviderId;
  readonly model: string;
};

type RoutingTarget = {
  readonly provider: ProviderId;
  readonly model: string;
};

type Props = {
  readonly label: string;
  readonly fallback: RoutingTarget | null;
  readonly auto: RoutingTarget;
  readonly effort: EffortLevel;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly onFallback: (fallback: FallbackChoice | null) => void;
};

export const FallbackRow = ({
  label,
  fallback,
  auto,
  effort,
  connectedProviders,
  disabled,
  onFallback,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<ProviderId>(
    fallback?.provider ?? auto.provider,
  );
  const shown =
    fallback == null
      ? AUTO_LABEL
      : recommendationSummary({ provider: fallback.provider, model: fallback.model });
  return (
    <section aria-label="If unavailable" className="flex flex-col">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="flex-1 text-2xs text-faint-foreground">If unavailable</span>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={isOpen}
          aria-label={`${label} if unavailable: ${shown}`}
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex min-w-0 items-center gap-1 rounded-sm px-1 text-2xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {fallback == null ? (
            <CONCEPT_ICONS.autoRouting size={11} aria-hidden className="shrink-0" />
          ) : null}
          <span className="truncate">{shown}</span>
          <ChevronDown
            size={11}
            aria-hidden
            className={cn('shrink-0 transition-transform', isOpen && 'rotate-180')}
          />
        </button>
      </div>
      {isOpen ? (
        <RoutingPicker
          presentation="inline"
          availability="setup"
          ariaLabel={`${label} fallback routing`}
          connectedProviders={connectedProviders}
          provider={fallback?.provider ?? pendingProvider}
          model={fallback?.model ?? ''}
          effort={{ editable: false, value: effort }}
          recommendation={{ provider: auto.provider, model: auto.model }}
          recommendationKind="auto"
          overridden={fallback != null}
          disabled={disabled}
          onProvider={(next) => {
            if (next === '') {
              onFallback(null);
              return;
            }
            setPendingProvider(next);
          }}
          onModel={(nextModel) => {
            if (nextModel === '') {
              onFallback(null);
              return;
            }
            onFallback({
              providerId: getModelProvider(nextModel) ?? pendingProvider,
              model: nextModel,
            });
          }}
        />
      ) : null}
    </section>
  );
};
