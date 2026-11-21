type Params = {
  readonly url: string;
};

const HOST = /^https?:\/\/([^/\s:?#]+)/i;

export const hostOf = ({ url }: Params): string | null => {
  const host = HOST.exec(url)?.[1];
  return host === undefined ? null : host.replace(/^www\./i, '').toLowerCase();
};
