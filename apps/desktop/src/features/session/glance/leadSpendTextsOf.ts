import type { LeadSpend } from '../timeline/leadSpendOf';
import { leadShareOf } from '../timeline/leadShareOf';
import { spendTextOf } from './spendTextOf';

type Params = {
  readonly spend: LeadSpend;
  readonly isLead: boolean;
};

export type LeadShareText = Readonly<{
  text: string;
  isOverMark: boolean;
}>;

export type LeadSpendTexts = Readonly<{
  spend: string | null;
  spendTotal: string | null;
  share: LeadShareText | null;
}>;

export const leadSpendTextsOf = ({ spend, isLead }: Params): LeadSpendTexts => {
  const total = spendTextOf({ spentUsd: spend.runUsd });
  if (!isLead || !spend.hasHelpers) {
    return { spend: total, spendTotal: null, share: null };
  }
  const own = spendTextOf({ spentUsd: spend.ownUsd });
  const share = total === null ? null : leadShareOf({ spend });
  return {
    spend: own === null ? null : `Lead ${own}`,
    spendTotal: total === null ? null : `Run total ${total}`,
    share:
      share === null
        ? null
        : {
            text: share.isOverMark
              ? `Lead used ${share.percent}% of this run`
              : `Lead share ${share.percent}%`,
            isOverMark: share.isOverMark,
          },
  };
};
