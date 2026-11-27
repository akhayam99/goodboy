import type { LeadSpend } from '../timeline/leadSpendOf';
import { spendTextOf } from './spendTextOf';

type Params = {
  readonly spend: LeadSpend;
  readonly isLead: boolean;
};

export type LeadSpendTexts = Readonly<{
  spend: string | null;
  spendTotal: string | null;
}>;

export const leadSpendTextsOf = ({ spend, isLead }: Params): LeadSpendTexts => {
  const total = spendTextOf({ spentUsd: spend.runUsd });
  if (!isLead || !spend.hasHelpers) {
    return { spend: total, spendTotal: null };
  }
  const own = spendTextOf({ spentUsd: spend.ownUsd });
  return {
    spend: own === null ? null : `Lead ${own}`,
    spendTotal: total === null ? null : `Run total ${total}`,
  };
};
