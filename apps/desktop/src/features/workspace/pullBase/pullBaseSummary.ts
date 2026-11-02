import { countNoun } from '../../../shared/utils/countNoun';
import type { PullOutcome } from './pullBaseInRepos';

type SummaryParams = {
  readonly outcomes: ReadonlyArray<PullOutcome>;
};

export type PullSummary = {
  readonly title: string;
  readonly lines: ReadonlyArray<string>;
  readonly kind: 'success' | 'info';
};

const lineOf = (outcome: PullOutcome): string => {
  if (outcome.kind !== 'updated') {
    return `${outcome.name}: ${outcome.reason}`;
  }
  const pulled =
    outcome.commits === 0
      ? `${outcome.base} already up to date`
      : `${outcome.base} updated, ${countNoun({ count: outcome.commits, one: 'new commit' })}`;
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
  const parts = [`Updated ${countNoun({ count: updated, one: 'repo' })}`];
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
