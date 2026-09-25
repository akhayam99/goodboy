import { cn } from '@goodboy/ui';
import { PROVIDER_BRAND } from '../../../features/providers/components/provider-brand';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import type { RecommendedRouting } from './recommendationSummary';
import { TriggerLabel } from './TriggerLabel';

type Props = {
  readonly label?: string;
  readonly routing: RecommendedRouting;
  readonly summary: string;
  readonly active: boolean;
  readonly reason?: string;
  readonly onSelect: () => void;
};

export const RecommendationRow = ({
  label = 'Recommended',
  routing,
  summary,
  active,
  reason,
  onSelect,
}: Props) => {
  const ProviderGlyph = PROVIDER_BRAND[routing.provider].icon;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`${label} ${summary}`}
        className={cn(
          'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-xs transition-colors',
          active
            ? 'bg-background font-medium text-foreground'
            : 'text-muted-foreground hover:bg-background hover:text-foreground',
        )}
      >
        <span>{label}</span>
        <span className="flex min-w-0 items-center gap-1 text-2xs font-normal">
          {routing.label === null ? (
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
