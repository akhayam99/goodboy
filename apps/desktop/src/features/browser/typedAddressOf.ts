import { addressOf } from './addressOf';
import { isLoopbackHost } from './isLoopbackHost';

type Params = {
  readonly text: string;
};

const WEB_PREFIXES = ['http://', 'https://'];

export const typedAddressOf = ({ text }: Params): string | null => {
  const parsed = addressOf({ text });
  if (parsed.kind === 'refused') {
    return null;
  }
  const lower = text.trim().toLowerCase();
  const url = new URL(parsed.url);
  const isExplicit =
    WEB_PREFIXES.some((prefix) => lower.startsWith(prefix)) ||
    isLoopbackHost({ host: url.hostname }) ||
    url.port !== '' ||
    url.pathname !== '/';
  return isExplicit ? parsed.url : null;
};
