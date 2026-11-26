type Params = {
  readonly name: string;
};

const HIDDEN_HEADERS: ReadonlySet<string> = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'set-cookie2',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-xsrf-token',
]);

export const isHiddenHeader = ({ name }: Params): boolean =>
  HIDDEN_HEADERS.has(name.trim().toLowerCase());
