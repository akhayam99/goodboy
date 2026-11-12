import { isLoopbackHost } from './isLoopbackHost';
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
const DRIVE_PATH = /^[a-z]:[\\/]/i;

const NOT_AN_ADDRESS =
  "Type a full address, like harborline.dev, or a file path. Search isn't available here.";
const NOT_WEB = 'Only web addresses and local files open here.';
const EMPTY = 'Type an address.';

const WEB_PREFIXES = ['http://', 'https://'];
const LOCAL_PREFIXES = ['/', '~/', 'file:'];
const NETWORK_PATH = '//';

const hasWebScheme = ({ text }: Params): boolean => {
  const lower = text.toLowerCase();
  return WEB_PREFIXES.some((prefix) => lower.startsWith(prefix));
};

const isLocalPath = ({ text }: Params): boolean => {
  if (DRIVE_PATH.test(text)) {
    return true;
  }
  const lower = text.toLowerCase();
  return (
    !lower.startsWith(NETWORK_PATH) && LOCAL_PREFIXES.some((prefix) => lower.startsWith(prefix))
  );
};

const isHostName = ({ host }: HostParams): boolean => {
  if (host === '' || isLoopbackHost({ host }) || IPV4.test(host) || host.startsWith('[')) {
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
  if (isLocalPath({ text: trimmed })) {
    return { kind: 'local', path: trimmed };
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
  if (!hasScheme && isLoopbackHost({ host: url.hostname })) {
    url.protocol = 'http:';
  }
  return { kind: 'ok', url: url.href };
};
