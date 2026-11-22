export type WorkOutcome = 'ok' | 'error' | 'cancelled' | 'unfinished';

const STOP_EXIT_CODES: ReadonlyArray<number> = [130, 137, 143];

type Params = {
  readonly endedAt: number | null;
  readonly exitCode: number | null;
};

export const workOutcomeOf = ({ endedAt, exitCode }: Params): WorkOutcome => {
  if (endedAt === null || exitCode === null) {
    return 'unfinished';
  }
  if (exitCode === 0) {
    return 'ok';
  }
  return STOP_EXIT_CODES.includes(exitCode) ? 'cancelled' : 'error';
};
