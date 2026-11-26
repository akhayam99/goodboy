import { selectLimitsChips, type LimitsChip } from '@goodboy/core/providers';
import { formatUsd } from '@goodboy/ui';
import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { spendFigures } from '../../budget/spendFigures';
import { PROVIDER_LABEL } from '../../providers/providerLabel';
import { spendSources } from '../../../shared/utils/spendSources';
import type { AppState } from '../../../store/types';
import type { LimitChip, NeedsYouChips } from '../contract/projections';

const MIN_SHOWN_SPEND = 0.01;

type Params = {
  readonly state: AppState;
  readonly now: number;
};

type ChipParams = {
  readonly chip: LimitsChip;
};

const limitChipOf = ({ chip }: ChipParams): LimitChip | null => {
  if (chip.usedFraction === null || chip.state === 'none') {
    return null;
  }
  const left = Math.max(0, Math.round((1 - chip.usedFraction) * 100));
  let tone: LimitChip['tone'] = 'neutral';
  if (chip.state === 'warning') {
    tone = 'warning';
  }
  if (chip.state === 'out') {
    tone = 'danger';
  }
  return { providerLabel: PROVIDER_LABEL[chip.providerId], leftText: `${left}% left`, tone };
};

export const chipsOfState = ({ state, now }: Params): NeedsYouChips => {
  const dormant =
    state.dormantSpend === null || state.dormantSpend.workspaceId !== state.currentWorkspaceId
      ? []
      : state.dormantSpend.entries;
  const records = spendSources({
    sessions: state.sessions,
    telemetryMap: state.sessionTelemetry,
    dormant,
  }).flatMap((source) => source.records);
  const today = spendFigures({ records, nowMs: now, sinceMs: null }).today.usd;
  const connected: ReadonlyArray<ProviderId> = state.providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id);
  const chips = selectLimitsChips({
    order: PROVIDER_IDS,
    connected,
    limits: state.providerLimits,
    nowMs: now,
  });
  return {
    spendToday: today < MIN_SHOWN_SPEND ? null : formatUsd(today),
    limits: chips.flatMap((chip) => {
      const mapped = limitChipOf({ chip });
      return mapped === null ? [] : [mapped];
    }),
  };
};
