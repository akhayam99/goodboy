export type PairingBarTone = 'danger' | 'warning' | 'success';

type Params = {
  readonly remaining: number;
  readonly total: number;
};

export const pairingBarTone = ({ remaining, total }: Params): PairingBarTone => {
  const ratio = total > 0 ? remaining / total : 0;
  if (ratio <= 0.15) {
    return 'danger';
  }
  if (ratio <= 0.35) {
    return 'warning';
  }
  return 'success';
};
