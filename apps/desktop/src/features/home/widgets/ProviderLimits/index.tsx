import { useMemo } from 'react';
import { Button } from '@goodboy/ui';
import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { openDestination } from '../../../../shared/navigation/openDestination';
import { usageWindowFactsOf } from '../../../providers/limits/usageWindowFactsOf';
import { HOME_WIDGETS, type WidgetSize } from '../../grid/homeWidgets';
import type { HomeFacts } from '../../hooks/useHomeFacts';
import { HeroNumber } from '../../WidgetCard/HeroNumber';
import { MoreLink } from '../../WidgetCard/MoreLink';
import { WidgetCard } from '../../WidgetCard';
import { WidgetSkeleton } from '../../WidgetCard/WidgetSkeleton';
import { LimitRow } from './LimitRow';
import { limitRowsOf, tightestOf } from './limitRowsOf';

type Props = {
  readonly facts: HomeFacts;
  readonly size: WidgetSize;
};

type LabelParams = {
  readonly providerId: ProviderId;
};

const CLOCK_MS = 60_000;

const WINDOWS_IN_MEDIUM = 4;

const openConnections = (): void => openDestination({ id: 'connections' });

export const ProviderLimits = ({ facts, size }: Props) => {
  const nowMs = useNow(CLOCK_MS);
  const providers = useAppStore((state) => state.providers);
  const limits = useAppStore((state) => state.providerLimits);
  const rows = useMemo(
    () =>
      limitRowsOf({
        order: PROVIDER_IDS,
        connected: providers
          .filter((provider) => provider.connection === 'connected')
          .map((provider) => provider.id),
        limits,
      }),
    [limits, providers],
  );
  const hasSeveralProviders = new Set(rows.map((row) => row.providerId)).size > 1;
  const labelOf = ({ providerId }: LabelParams): string | null =>
    hasSeveralProviders
      ? (providers.find((provider) => provider.id === providerId)?.label ?? null)
      : null;
  const shown = size === 'L' ? rows.length : WINDOWS_IN_MEDIUM;
  const extra = size === 'S' ? 0 : Math.max(0, rows.length - shown);
  const tightest = tightestOf({ rows });
  const tightestFacts =
    tightest === null
      ? null
      : usageWindowFactsOf({ window: tightest.window, siblings: tightest.siblings, nowMs });
  return (
    <WidgetCard
      id="providerLimits"
      title={HOME_WIDGETS.providerLimits.title}
      icon={CONCEPT_ICONS.providers}
      footer={extra > 0 ? <MoreLink count={extra} onOpen={openConnections} /> : undefined}
    >
      {facts.isLoading ? (
        <WidgetSkeleton label="Loading usage" />
      ) : rows.length === 0 ? (
        <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-2">
          <span className="text-meta text-muted-foreground">
            Connect a provider to see what is left
          </span>
          <Button size="xs" variant="quiet" onClick={openConnections}>
            Connect
          </Button>
        </div>
      ) : size === 'S' && tightest !== null && tightestFacts !== null ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <HeroNumber value={tightestFacts.percentText ?? 'Within limits'} unit="used" />
          <span className="truncate text-meta text-faint-foreground tabular-nums">
            {tightestFacts.resetText}
          </span>
        </div>
      ) : (
        <ul
          className={
            size === 'L'
              ? 'grid min-w-0 flex-1 grid-cols-2 content-start gap-x-4'
              : 'flex min-w-0 flex-1 flex-col justify-between'
          }
        >
          {rows.slice(0, shown).map((row) => (
            <LimitRow
              key={row.key}
              row={row}
              providerLabel={labelOf({ providerId: row.providerId })}
              nowMs={nowMs}
            />
          ))}
        </ul>
      )}
    </WidgetCard>
  );
};
