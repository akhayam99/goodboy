const MIDNIGHT_SLACK_MS = 50;

type NextMidnightParams = {
  readonly now: number;
};

export const msUntilMidnight = ({ now }: NextMidnightParams): number => {
  const date = new Date(now);
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return midnight - now + MIDNIGHT_SLACK_MS;
};
