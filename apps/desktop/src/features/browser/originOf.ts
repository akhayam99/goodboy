type Params = {
  readonly url: string;
};

export const originOf = ({ url }: Params): string | null => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
};
