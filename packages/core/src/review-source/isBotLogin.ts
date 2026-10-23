type Params = {
  readonly login: string;
};

const BOT_SUFFIXES = ['[bot]', '-bot', '_bot'];

export const isBotLogin = ({ login }: Params): boolean => {
  const lower = login.toLowerCase();
  return BOT_SUFFIXES.some((suffix) => lower.endsWith(suffix));
};
