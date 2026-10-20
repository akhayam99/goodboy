import { sortLimitWindows, type LimitsChip } from '@goodboy/core';
import type { Fact, FactCardSpec, FactState } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';
import { formatLimitReset } from '../../../../features/providers/limits/formatLimitReset';
import { formatUsedPercent } from '../../../../features/providers/limits/formatUsedPercent';
import { limitsChipHeadline } from '../../../../features/providers/limits/limitsChipHeadline';
import { limitWindowLabel } from '../../../../features/providers/limits/limitWindowLabel';
import { windowTone } from '../../../../features/providers/limits/windowTone';
import { fitCardRows } from '../../../../shared/utils/fitCardRows';
import { formatAge } from '../../../../shared/utils/time/formatAge';

type Params = {
  readonly chip: LimitsChip;
  readonly nowMs: number;
  readonly freeResets: number;
};

type StateParams = {
  readonly chip: LimitsChip;
  readonly nowMs: number;
};

const stateOf = ({ chip, nowMs }: StateParams): FactState => {
  switch (chip.state) {
    case 'normal':
      return { tone: 'ok', words: 'Within limits' };
    case 'warning':
      return { tone: 'warning', words: limitsChipHeadline({ chip, nowMs }) };
    case 'out':
      return { tone: 'danger', words: limitsChipHeadline({ chip, nowMs }) };
    case 'stale':
    case 'reset':
    case 'waiting':
    case 'none':
      return { tone: 'neutral', words: limitsChipHeadline({ chip, nowMs }) };
    default: {
      const exhaustive: never = chip.state;
      return exhaustive;
    }
  }
};

export const limitsCardOf = ({ chip, nowMs, freeResets }: Params): FactCardSpec => {
  const windows = sortLimitWindows({ windows: chip.windows });
  const facts: Array<Fact> = windows.map((window) => {
    const tone = windowTone({ window });
    return {
      label: limitWindowLabel({ window, siblings: windows }),
      value:
        window.usedFraction === null
          ? 'Within limits'
          : `${formatUsedPercent({ usedFraction: window.usedFraction })} used`,
      ...(window.resetsAt === null
        ? {}
        : { note: `resets ${formatLimitReset({ iso: window.resetsAt, nowMs })}` }),
      ...(tone === 'neutral' ? {} : { tone }),
    };
  });
  if (freeResets > 0) {
    facts.push({ label: 'Free resets', value: `${freeResets} available`, tone: 'info' });
  }
  const fitted = fitCardRows({ facts });
  const updated =
    chip.observedAt === null
      ? 'Click for details'
      : `Updated ${formatAge({ from: chip.observedAt, now: nowMs })}. Click for details`;
  return {
    title: PROVIDER_LABEL[chip.providerId],
    ...(chip.plan === null ? {} : { sub: chip.plan }),
    state: stateOf({ chip, nowMs }),
    facts: fitted.facts,
    footnote: fitted.footnote === undefined ? updated : `${fitted.footnote}. ${updated}`,
  };
};
