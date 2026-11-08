const BOT_SUFFIX = '[bot]';

type Params = {
  readonly login: string;
};

export const botKeyOf = ({ login }: Params): string => {
  const lower = login.toLowerCase();
  return lower.endsWith(BOT_SUFFIX) ? lower.slice(0, -BOT_SUFFIX.length) : lower;
};
