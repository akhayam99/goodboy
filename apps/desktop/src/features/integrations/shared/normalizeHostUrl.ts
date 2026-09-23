type Params = {
  readonly input: string;
  readonly fallback: string;
};

export const normalizeHostUrl = ({ input, fallback }: Params): string => {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (trimmed === '') {
    return fallback;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return fallback;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return fallback;
  }
};
