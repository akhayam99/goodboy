type Params = {
  readonly host: string;
};

export const isLoopbackHost = ({ host }: Params): boolean =>
  host === 'localhost' ||
  host.endsWith('.localhost') ||
  host.startsWith('127.') ||
  host === '[::1]' ||
  host === '0.0.0.0';
