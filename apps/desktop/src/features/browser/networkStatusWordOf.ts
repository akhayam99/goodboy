type Params = {
  readonly status: number | null;
};

export const networkStatusWordOf = ({ status }: Params): string =>
  status === null || status === 0 ? 'failed' : String(status);
