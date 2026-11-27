import type { LeadSpend } from './leadSpendOf';

type Params = {
  readonly spend: LeadSpend;
};

type LeadShare = Readonly<{
  percent: number;
  isOverMark: boolean;
}>;

const MARK_PERCENT = 25;
const FLOOR_CENTS = 50;

export const leadShareOf = ({ spend }: Params): LeadShare | null => {
  if (spend.runUsd <= 0) {
    return null;
  }
  const percent = Math.round((spend.ownUsd / spend.runUsd) * 100);
  const runCents = Math.round(spend.runUsd * 100);
  return { percent, isOverMark: runCents > FLOOR_CENTS && percent > MARK_PERCENT };
};
