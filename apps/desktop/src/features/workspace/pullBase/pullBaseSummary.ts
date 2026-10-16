import type { PullOutcome } from './pullBaseInRepos';

type SummaryParams = {
  readonly outcomes: ReadonlyArray<PullOutcome>;
};

export type PullSummary = {
  readonly title: string;
  readonly lines: ReadonlyArray<string>;
  readonly kind: 'success' | 'info';
};

type CountParams = {
  readonly count: number;
  readonly noun: string;
};

const plural = ({ count, noun }: CountParams): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const lineOf = (outcome: PullOutcome): string => {
  if (outcome.kind !== 'updated') {
    return `${outcome.name}: ${outcome.reason}`;
  }
  const pulled =
    outcome.commits === 0
      ? `${outcome.base} already up to date`
      : `${outcome.base} updated, ${plural({ count: outcome.commits, noun: 'new commit' })}`;
  const stays =
    outcome.checkoutBranch === null || outcome.checkoutBranch === outcome.base
      ? ''
      : `, your checkout stays on ${outcome.checkoutBranch}`;
  return `${outcome.name}: ${pulled}${stays}`;
};

export const pullBaseSummary = ({ outcomes }: SummaryParams): PullSummary => {
  const updated = outcomes.filter((outcome) => outcome.kind === 'updated').length;
  const skipped = outcomes.filter((outcome) => outcome.kind === 'skipped').length;
  const failed = outcomes.filter((outcome) => outcome.kind === 'failed').length;
  const parts = [`Updated ${plural({ count: updated, noun: 'repo' })}`];
  if (skipped > 0) {
    parts.push(`${skipped} skipped`);
  }
  if (failed > 0) {
    parts.push(`${failed} failed`);
  }
  return {
    title: parts.join(' · '),
    lines: outcomes.map(lineOf),
    kind: skipped + failed > 0 ? 'info' : 'success',
  };
};
