type Params = {
  readonly status: number | null;
};

export const isFailedRequest = ({ status }: Params): boolean =>
  status !== null && (status === 0 || status >= 400);

export const networkStatusWordOf = ({ status }: Params): string => {
  if (status === null) {
    return 'loaded';
  }
  return status === 0 ? 'failed' : String(status);
};
