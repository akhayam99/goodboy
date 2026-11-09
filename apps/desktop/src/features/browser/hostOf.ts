type Params = {
  readonly url: string;
};

export const hostOf = ({ url }: Params): string => {
  try {
    const host = new URL(url).host;
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return url;
  }
};
