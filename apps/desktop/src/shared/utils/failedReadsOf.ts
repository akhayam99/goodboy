type Read = {
  readonly label: string;
  readonly error: Error | null;
};

type Params = {
  readonly reads: ReadonlyArray<Read>;
};

type FailedReads = {
  readonly labels: ReadonlyArray<string>;
  readonly error: Error | null;
};

export const failedReadsOf = ({ reads }: Params): FailedReads => {
  const failed = reads.filter((read) => read.error !== null);
  return {
    labels: failed.map((read) => read.label),
    error: failed[0]?.error ?? null,
  };
};
