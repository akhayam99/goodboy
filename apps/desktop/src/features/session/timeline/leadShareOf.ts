import type { LeadSpend } from './leadSpendOf';

type Params = {
  readonly spend: LeadSpend;
};

type LeadShare = Readonly<{
  percent: number;
  isOverMark: boolean;
}>;

const MARK_PERCENT = 25;
const FLOOR_USD = 0.5;

export const leadShareOf = ({ spend }: Params): LeadShare | null => {
  if (spend.runUsd <= 0) {
    return null;
  }
  const percent = Math.round((spend.ownUsd / spend.runUsd) * 100);
  return { percent, isOverMark: spend.runUsd > FLOOR_USD && percent > MARK_PERCENT };
};
