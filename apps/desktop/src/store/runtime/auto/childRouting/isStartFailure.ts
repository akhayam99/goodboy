type Params = {
  readonly endReason: string | null;
};

export const isStartFailure = ({ endReason }: Params): boolean =>
  endReason === 'kickoff_failed' || endReason?.startsWith('kickoff_failed:') === true;
