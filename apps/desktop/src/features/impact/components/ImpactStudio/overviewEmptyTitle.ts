type Params = {
  readonly todaySpend: number;
  readonly spentLabel: string;
};

const FILLS_IN = 'Impact fills in as sessions finish';

export const overviewEmptyTitle = ({ todaySpend, spentLabel }: Params): string =>
  todaySpend > 0 ? `${spentLabel} spent today so far. ${FILLS_IN}.` : FILLS_IN;
