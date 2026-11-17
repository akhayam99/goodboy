const NEEDS_RUN_PREFIX = 'needs_run:';

type ReasonParams = {
  readonly reason: string;
};

type StateReasonParams = {
  readonly stateReason: string | null;
};

export const NEEDS_RUN_REASON = {
  stateReasonOf: ({ reason }: ReasonParams): string => `${NEEDS_RUN_PREFIX}${reason}`,
  reasonOf: ({ stateReason }: StateReasonParams): string | null =>
    stateReason?.startsWith(NEEDS_RUN_PREFIX) === true
      ? stateReason.slice(NEEDS_RUN_PREFIX.length)
      : null,
} as const;
