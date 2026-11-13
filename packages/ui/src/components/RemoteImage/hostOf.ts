type Params = {
  readonly url: string;
};

export const hostOf = ({ url }: Params): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
