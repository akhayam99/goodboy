import type { ProviderLimitWindow } from '@goodboy/types';
import { Meter } from '@goodboy/ui';
import { formatUsedPercent } from '../../../providers/limits/formatUsedPercent';
import { windowTone } from '../../../providers/limits/windowTone';

type Props = {
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
};

const SHORT_LABEL: Readonly<Partial<Record<ProviderLimitWindow['kind'], string>>> = {
  fiveHour: '5h',
  weekly: 'Week',
};

export const UsageMeters = ({ windows }: Props) => (
  <span className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
    {windows.flatMap((window) => {
      const label = SHORT_LABEL[window.kind];
      if (label === undefined) {
        return [];
      }
      const used = window.status === 'reached' ? 1 : (window.usedFraction ?? 0);
      const percent = formatUsedPercent({ usedFraction: used });
      return [
        <span key={`${window.kind}-label`} className="text-meta text-muted-foreground">
          {label}
        </span>,
        <Meter
          key={`${window.kind}-meter`}
          label={`${label} window, ${percent} used`}
          value={used * 100}
          tone={windowTone({ window })}
          size="xs"
        />,
        <span key={`${window.kind}-value`} className="text-meta tabular-nums text-foreground">
          {percent}
        </span>,
      ];
    })}
  </span>
);
