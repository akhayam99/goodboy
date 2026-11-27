type Params = {
  readonly at: number;
  readonly settledAt: number | null;
};

export const isFailureSettled = ({ at, settledAt }: Params): boolean =>
  settledAt !== null && at < settledAt;
