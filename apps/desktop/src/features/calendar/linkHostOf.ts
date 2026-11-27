type Params = {
  readonly link: string;
};

export const linkHostOf = ({ link }: Params): string | null => {
  try {
    const host = new URL(link).host;
    return host === '' ? null : host;
  } catch {
    return null;
  }
};
