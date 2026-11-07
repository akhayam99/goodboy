import type { TranscriptItem } from '../../../utils/transcript-items';
import { turnSummary } from '../../../utils/turnSummary';
import { countNoun } from '../../../../../shared/utils/countNoun';

type AnyRow = {
  readonly kind: string;
  readonly steps?: ReadonlyArray<TranscriptItem>;
};

type Params = {
  readonly rows: ReadonlyArray<AnyRow>;
};

const TURN_FINISHED = 'Reply finished';

export const turnEndAnnouncement = ({ rows }: Params): string => {
  const lastSteps = rows.flatMap((row) =>
    row.kind === 'summary' && row.steps !== undefined ? [row.steps] : [],
  );
  const steps = lastSteps.at(-1);
  const summary = steps === undefined ? null : turnSummary({ steps });
  if (summary === null) {
    return TURN_FINISHED;
  }
  const errors =
    summary.errorCount === 0 ? '' : `, ${countNoun({ count: summary.errorCount, one: 'error' })}`;
  return `${TURN_FINISHED}: ${summary.text}${errors}`;
};
