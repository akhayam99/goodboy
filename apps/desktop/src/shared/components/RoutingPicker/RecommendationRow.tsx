import { Check } from 'lucide-react';
import { CONCEPT_ICONS } from '../conceptIcons';
import { cn } from '@goodboy/ui';
import { PROVIDER_BRAND } from '../../../features/providers/components/provider-brand';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { AUTO_LABEL } from './AutoTriggerLabel';
import type { RecommendedRouting } from './recommendationSummary';
import { TriggerLabel } from './TriggerLabel';

export type RecommendationKind = 'auto' | 'suggested';

type Props = {
  readonly kind?: RecommendationKind;
  readonly label?: string;
  readonly routing: RecommendedRouting;
  readonly summary: string;
  readonly active: boolean;
  readonly reason?: string;
  readonly onSelect: () => void;
};

export const RecommendationRow = ({
  kind = 'suggested',
  label = 'Recommended',
  routing,
  summary,
  active,
  reason,
  onSelect,
}: Props) => {
  const isAuto = kind === 'auto';
  const ProviderGlyph = PROVIDER_BRAND[routing.provider].icon;
  const shownLabel = isAuto ? AUTO_LABEL : label;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        aria-label={isAuto ? `${AUTO_LABEL}, now ${summary}` : `${label} ${summary}`}
        className={cn(
          'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-xs transition-colors',
          active
            ? 'bg-background font-medium text-foreground'
            : 'text-muted-foreground hover:bg-background hover:text-foreground',
        )}
      >
        <span className="flex shrink-0 items-center gap-1.5">
          {isAuto ? (
            <CONCEPT_ICONS.autoRouting
              size={12}
              className="shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : (
            <Check
              size={12}
              aria-hidden
              className={cn('shrink-0 text-primary', active ? 'opacity-100' : 'opacity-0')}
            />
          )}
          {shownLabel}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-2xs font-normal">
          {isAuto ? (
            <span className="truncate text-faint-foreground">Now: {summary}</span>
          ) : routing.label === null ? (
            <>
              <ProviderGlyph size={12} className="shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate text-muted-foreground">
                {PROVIDER_LABEL[routing.provider]}
              </span>
            </>
          ) : (
            <TriggerLabel provider={routing.provider} label={routing.label} />
          )}
        </span>
      </button>
      {reason != null && reason !== '' ? (
        <p className="px-2.5 pb-1.5 text-2xs leading-relaxed text-muted-foreground">{reason}</p>
      ) : null}
    </div>
  );
};
