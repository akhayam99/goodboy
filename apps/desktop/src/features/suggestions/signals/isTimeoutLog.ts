type Params = {
  readonly log: string;
};

const TIMEOUT_PATTERNS: ReadonlyArray<RegExp> = [
  /the job running on runner .* has exceeded the maximum execution time/i,
  /the operation was canceled\.?\s*$/im,
  /timed out after \d+/i,
  /ETIMEDOUT|ECONNRESET|deadline exceeded/,
  /##\[error\].*time(?:d)? ?out/i,
  /exceeded the (?:maximum )?(?:execution )?time/i,
];

export const isTimeoutLog = ({ log }: Params): boolean =>
  TIMEOUT_PATTERNS.some((pattern) => pattern.test(log));
