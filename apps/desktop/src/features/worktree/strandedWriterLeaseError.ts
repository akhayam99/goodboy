export type StrandedWriterLeaseNotice = Readonly<{
  waitedMs: number;
  holder: string;
  resource: string;
}>;

const STRANDED_RE =
  /gave up after waiting (\d+)ms for a writer lease on (.+), held by (.+) in state unknown/;

export const matchStrandedWriterLease = ({
  message,
}: {
  readonly message: string;
}): StrandedWriterLeaseNotice | null => {
  const match = STRANDED_RE.exec(message);
  if (match === null) {
    return null;
  }
  const [, waitedMs, resource, holder] = match;
  if (waitedMs === undefined || resource === undefined || holder === undefined) {
    return null;
  }
  return { waitedMs: Number(waitedMs), holder, resource };
};
