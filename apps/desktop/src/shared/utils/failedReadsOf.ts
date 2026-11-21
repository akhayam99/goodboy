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
  const failed = reads.flatMap((read) =>
    read.error === null ? [] : [{ label: read.label, error: read.error }],
  );
  const [only] = failed;
  return {
    labels: failed.map((read) => read.label),
    error:
      failed.length > 1
        ? new Error(failed.map((read) => `${read.label}: ${read.error.message}`).join('; '))
        : (only?.error ?? null),
  };
};
