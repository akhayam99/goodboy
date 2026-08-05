type Params = {
  readonly input: string;
};

export const normalizeSiteUrl = ({ input }: Params): string => {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (trimmed === '') {
    return '';
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
};
