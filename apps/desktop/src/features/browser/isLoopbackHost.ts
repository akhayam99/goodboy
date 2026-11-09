type Params = {
  readonly host: string;
};

const LOOPBACK_V4 = /^127(?:\.\d{1,3}){3}$/;

export const isLoopbackHost = ({ host }: Params): boolean =>
  host === 'localhost' ||
  host.endsWith('.localhost') ||
  LOOPBACK_V4.test(host) ||
  host === '[::1]' ||
  host === '0.0.0.0';
