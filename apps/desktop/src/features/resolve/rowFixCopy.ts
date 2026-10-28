import { fixedInLine } from './commentOutcomeCopy';
import type { RowFix } from './rowFix';

export const ROW_FIX_COPY = {
  fixing: 'Fixing in the fix run',
  seeDiff: 'See diff',
  seeDiffOf: 'See diff of',
  review: 'Review the fix',
} as const;

type Params = {
  readonly fix: RowFix;
};

export const rowFixLineOf = ({ fix }: Params): string => {
  switch (fix.kind) {
    case 'fixing':
      return ROW_FIX_COPY.fixing;
    case 'fixed':
      return fix.isReview
        ? `${fixedInLine({ sha: fix.sha })} · ${ROW_FIX_COPY.review}`
        : fixedInLine({ sha: fix.sha });
    case 'failed':
      return fix.sentence;
    default: {
      const exhaustive: never = fix;
      return exhaustive;
    }
  }
};
