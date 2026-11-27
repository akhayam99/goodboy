type Params = {
  readonly token: '--ease-enter' | '--ease-exit';
};

const FALLBACK: Readonly<Record<Params['token'], string>> = {
  '--ease-enter': 'cubic-bezier(0.2, 0, 0, 1)',
  '--ease-exit': 'cubic-bezier(0.4, 0, 1, 1)',
};

export const motionEaseOf = ({ token }: Params): string => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value === '' ? FALLBACK[token] : value;
};
