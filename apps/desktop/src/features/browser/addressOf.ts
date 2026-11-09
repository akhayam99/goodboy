import type { BrowserAddress } from './types';

type Params = {
  readonly text: string;
};

type HostParams = {
  readonly host: string;
};

const OTHER_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const SPACE = /\s/;

const NOT_AN_ADDRESS = "Type a full address, like harborline.dev. Search isn't available here.";
const NOT_WEB = 'Only http and https addresses open here.';
const EMPTY = 'Type an address.';

const WEB_PREFIXES = ['http://', 'https://'];

const hasWebScheme = ({ text }: Params): boolean => {
  const lower = text.toLowerCase();
  return WEB_PREFIXES.some((prefix) => lower.startsWith(prefix));
};

const isLoopback = ({ host }: HostParams): boolean =>
  host === 'localhost' ||
  host.endsWith('.localhost') ||
  (IPV4.test(host) && host.startsWith('127.')) ||
  host === '[::1]' ||
  host === '0.0.0.0';

const isHostName = ({ host }: HostParams): boolean => {
  if (host === '' || isLoopback({ host }) || IPV4.test(host) || host.startsWith('[')) {
    return host !== '';
  }
  const labels = host.split('.');
  return labels.length > 1 && labels.every((label) => label !== '');
};

const parsed = ({ text }: Params): URL | null => {
  try {
    return new URL(text);
  } catch {
    return null;
  }
};

export const addressOf = ({ text }: Params): BrowserAddress => {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { kind: 'refused', reason: EMPTY };
  }
  if (SPACE.test(trimmed)) {
    return { kind: 'refused', reason: NOT_AN_ADDRESS };
  }
  const hasScheme = hasWebScheme({ text: trimmed });
  if (!hasScheme && OTHER_SCHEME.test(trimmed)) {
    return { kind: 'refused', reason: NOT_WEB };
  }
  const url = parsed({ text: hasScheme ? trimmed : `https://${trimmed}` });
  if (url === null || !isHostName({ host: url.hostname })) {
    return { kind: 'refused', reason: NOT_AN_ADDRESS };
  }
  if (!hasScheme && isLoopback({ host: url.hostname })) {
    url.protocol = 'http:';
  }
  return { kind: 'ok', url: url.href };
};
