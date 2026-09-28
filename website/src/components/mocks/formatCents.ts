type Params = {
  readonly cents: number;
};

export const formatCents = ({ cents }: Params): string => `$${(cents / 100).toFixed(2)}`;
