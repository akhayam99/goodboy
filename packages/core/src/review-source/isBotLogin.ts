type Params = {
  readonly login: string;
  readonly isBot?: boolean;
};

const BOT_SUFFIXES = ['[bot]', '-bot', '_bot'];

export const isBotLogin = ({ login, isBot }: Params): boolean => {
  if (isBot === true) {
    return true;
  }
  const lower = login.toLowerCase();
  return BOT_SUFFIXES.some((suffix) => lower.endsWith(suffix));
};
