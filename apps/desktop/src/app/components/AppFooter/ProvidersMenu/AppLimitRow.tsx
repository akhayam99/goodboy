import { limitsChipOf } from '@goodboy/core';
import type { ProviderId, ProviderLimits, ProviderLimitWindow } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';
import { LimitMeter } from './LimitMeter';

type Props = {
  readonly id: ProviderId;
  readonly limits: ProviderLimits | undefined;
  readonly nowMs: number;
};

type PickParams = {
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
  readonly kind: ProviderLimitWindow['kind'];
};

const windowOf = ({ windows, kind }: PickParams): ProviderLimitWindow | null =>
  windows.find((window) => window.kind === kind) ?? null;

export const AppLimitRow = ({ id, limits, nowMs }: Props) => {
  const chip = limitsChipOf({ providerId: id, limits, nowMs });
  const hasLimits = chip.state !== 'none' && chip.state !== 'waiting';
  return (
    <li className="flex min-w-0 items-center gap-2 px-2 py-1">
      <ProviderGlyph id={id} size={ICON_SIZE.control} />
      <span className="w-20 shrink-0 truncate text-row text-foreground">{PROVIDER_LABEL[id]}</span>
      {hasLimits ? (
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-0.5">
          <LimitMeter
            label="5h"
            window={windowOf({ windows: chip.windows, kind: 'fiveHour' })}
            nowMs={nowMs}
          />
          <LimitMeter
            label="Week"
            window={
              windowOf({ windows: chip.windows, kind: 'weekly' }) ??
              windowOf({ windows: chip.windows, kind: 'weeklyModel' })
            }
            nowMs={nowMs}
          />
        </span>
      ) : (
        <span className="flex-1 text-secondary text-faint-foreground">
          {chip.state === 'waiting' ? 'Limits not read yet' : 'No limits reported'}
        </span>
      )}
    </li>
  );
};
