import type { PrCheckConclusion, PrCheckRun } from '@goodboy/types';
import type { FactCardSpec, FactState } from '@goodboy/ui';
import { formatDuration } from '../../../../../shared/utils/time/formatDuration';

type Params = {
  readonly check: PrCheckRun;
  readonly footnote: string;
};

type StateParams = {
  readonly conclusion: PrCheckConclusion;
};

type FootnoteParams = {
  readonly detailsUrl: string | null;
};

const stateOf = ({ conclusion }: StateParams): FactState => {
  switch (conclusion) {
    case 'success':
      return { tone: 'ok', words: 'Passed' };
    case 'failure':
      return { tone: 'danger', words: 'Failed' };
    case 'timed_out':
      return { tone: 'danger', words: 'Timed out' };
    case 'cancelled':
      return { tone: 'neutral', words: 'Cancelled' };
    case 'action_required':
      return { tone: 'warning', words: 'Needs action' };
    case 'pending':
      return { tone: 'info', words: 'Running', isRunning: true };
    case 'skipped':
      return { tone: 'neutral', words: 'Skipped' };
    case 'neutral':
      return { tone: 'neutral', words: 'Neutral' };
    case 'stale':
      return { tone: 'neutral', words: 'Out of date' };
    case 'unknown':
      return { tone: 'neutral', words: 'No result yet' };
    default: {
      const exhaustive: never = conclusion;
      return exhaustive;
    }
  }
};

export const checkFootnoteOf = ({ detailsUrl }: FootnoteParams): string =>
  detailsUrl === null ? 'Click to open the checks page' : 'Click to open the log';

export const checkCardOf = ({ check, footnote }: Params): FactCardSpec => {
  const tookMs = check.durationMs;
  const took = tookMs === null ? null : formatDuration({ durationMs: tookMs });
  return {
    title: check.name,
    state: stateOf({ conclusion: check.conclusion }),
    facts: took === null ? [] : [{ label: 'Took', value: took }],
    footnote,
  };
};
