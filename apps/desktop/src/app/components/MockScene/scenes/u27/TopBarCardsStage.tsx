import { limitsChipOf } from '@goodboy/core';
import { FactCard } from '@goodboy/ui';
import type { BaseDivergence, IsoDateTime, ProviderLimits } from '@goodboy/types';
import { usageCardOf } from '../../../../../features/chat/components/ProviderUsagePill/usageCardOf';
import { repoEntryCardOf } from '../../../../../features/workspace/components/RepoEntry/repoEntryCardOf';
import { repoEntryFactsOf } from '../../../../../features/workspace/components/RepoEntry/repoEntryFactsOf';
import { LimitsTooltip } from '../../../AppTopBar/LimitsStrip/LimitsTooltip';

type IdParams = {
  readonly value: string;
};

const idOf = <Id extends string>({ value }: IdParams): Id => JSON.parse(JSON.stringify(value));

const NOW_MS = Date.parse('2026-10-19T12:00:00.000Z');

const LIMITS: ProviderLimits = {
  providerId: 'codex',
  plan: 'Plus',
  status: 'reached',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'ok',
      usedFraction: 0.42,
      resetsAt: idOf<IsoDateTime>({ value: '2026-10-19T15:30:00.000Z' }),
    },
    {
      kind: 'weekly',
      model: null,
      status: 'reached',
      usedFraction: 1,
      resetsAt: idOf<IsoDateTime>({ value: '2026-10-22T18:12:00.000Z' }),
    },
  ],
  observedAt: idOf<IsoDateTime>({ value: '2026-10-19T11:57:00.000Z' }),
};

const CHIP = limitsChipOf({ providerId: 'codex', limits: LIMITS, nowMs: NOW_MS });

type ReportParams = {
  readonly state: BaseDivergence['state'];
  readonly behind: number;
};

const reportOf = ({ state, behind }: ReportParams): BaseDivergence => ({
  state,
  base: 'main',
  upstream: 'origin/main',
  ahead: 0,
  behind,
  checkoutBranch: 'main',
  uncommitted: 0,
  message: null,
});

const REPOS = repoEntryFactsOf({
  entries: [
    {
      project: { name: 'payments-api' },
      report: reportOf({ state: 'behind', behind: 3 }),
    },
    {
      project: { name: 'ledger-core' },
      report: reportOf({ state: 'diverged', behind: 2 }),
    },
    {
      project: { name: 'notify-relay' },
      report: reportOf({ state: 'up-to-date', behind: 0 }),
    },
  ],
});

const TRIGGER_CLASSES =
  'inline-flex h-7 items-center justify-center rounded-md border border-border-soft px-2 text-meta text-muted-foreground';

export const TopBarCardsStage = () => (
  <div
    data-testid="top-bar-cards-stage"
    className="grid w-264 grid-cols-3 items-start gap-6 rounded-lg border border-border-soft bg-subtle p-6 pb-72"
  >
    <LimitsTooltip chip={CHIP} nowMs={NOW_MS} isOpen>
      <span className={TRIGGER_CLASSES}>Codex limits</span>
    </LimitsTooltip>
    <FactCard
      isOpen
      card={usageCardOf({
        provider: 'anthropic',
        spentUsd: 72.4,
        capUsd: 100,
        pctUsed: 72,
        reset: 'Nov 1',
      })}
    >
      <span className={TRIGGER_CLASSES}>28% left</span>
    </FactCard>
    <FactCard isOpen card={repoEntryCardOf({ facts: REPOS, repoCount: 3 })}>
      <span className={TRIGGER_CLASSES}>2 repos behind</span>
    </FactCard>
  </div>
);
