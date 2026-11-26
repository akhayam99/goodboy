type Params = {
  readonly url: string;
};

const WEB_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

export const siteHostOf = ({ url }: Params): string | null => {
  if (url === '') {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (!WEB_PROTOCOLS.has(parsed.protocol) || parsed.hostname === '') {
      return null;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
};
