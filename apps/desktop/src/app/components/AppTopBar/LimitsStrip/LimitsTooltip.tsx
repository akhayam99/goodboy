import { sortLimitWindows, type LimitsChip } from '@goodboy/core';
import { cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';
import { formatLimitReset } from '../../../../features/providers/limits/formatLimitReset';
import { formatUsedPercent } from '../../../../features/providers/limits/formatUsedPercent';
import { limitsChipHeadline } from '../../../../features/providers/limits/limitsChipHeadline';
import { limitWindowLabel } from '../../../../features/providers/limits/limitWindowLabel';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { WINDOW_TONE_TEXT, windowTone } from '../../../../features/providers/limits/windowTone';

type Props = {
  readonly chip: LimitsChip;
  readonly nowMs: number;
};

export const LimitsTooltip = ({ chip, nowMs }: Props) => {
  const windows = sortLimitWindows({ windows: chip.windows });
  const freeResets = useAppStore((state) =>
    chip.providerId === 'codex' && chip.state === 'out'
      ? (state.codexResetCredits?.availableCount ?? 0)
      : 0,
  );
  const footer =
    chip.observedAt === null
      ? 'Click for details'
      : `Updated ${formatAge({ from: chip.observedAt, now: nowMs })} · Click for details`;
  return (
    <span className="flex flex-col gap-2">
      <span className="flex items-baseline gap-2">
        <span className="font-semibold">{PROVIDER_LABEL[chip.providerId]}</span>
        {chip.plan === null ? null : <span className="text-faint-foreground">{chip.plan}</span>}
      </span>
      <span className="text-muted-foreground">{limitsChipHeadline({ chip, nowMs })}</span>
      {windows.length > 0 ? (
        <span className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-0.5 tabular-nums">
          {windows.map((window) => (
            <span key={`${window.kind}:${window.model ?? ''}`} className="contents">
              <span className="text-muted-foreground">
                {limitWindowLabel({ window, siblings: windows })}
              </span>
              <span className={cn('text-right', WINDOW_TONE_TEXT[windowTone({ window })])}>
                {window.usedFraction === null
                  ? 'within limits'
                  : `${formatUsedPercent({ usedFraction: window.usedFraction })} used`}
              </span>
              <span className="text-faint-foreground">
                {window.resetsAt === null
                  ? ''
                  : `resets ${formatLimitReset({ iso: window.resetsAt, nowMs })}`}
              </span>
            </span>
          ))}
        </span>
      ) : null}
      {freeResets > 0 ? (
        <span className="text-primary">
          {freeResets === 1 ? '1 free reset available' : `${freeResets} free resets available`}
        </span>
      ) : null}
      <span className="text-faint-foreground">{footer}</span>
    </span>
  );
};
