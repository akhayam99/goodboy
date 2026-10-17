const DEFAULT_MINUTES = 5;
const ALLOWED_MINUTES: ReadonlyArray<number> = [0, 5, 15, 30];

type Params = {
  readonly value: string | undefined;
};

export const repoCheckMinutesOf = ({ value }: Params): number => {
  if (value === undefined) {
    return DEFAULT_MINUTES;
  }
  const minutes = Number(value);
  return ALLOWED_MINUTES.includes(minutes) ? minutes : DEFAULT_MINUTES;
};
