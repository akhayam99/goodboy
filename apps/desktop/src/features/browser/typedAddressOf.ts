import { addressOf } from './addressOf';
import { isLoopbackHost } from './isLoopbackHost';

type Params = {
  readonly text: string;
};

type HostParams = {
  readonly host: string;
};

const WEB_PREFIXES = ['http://', 'https://'];

const FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  'c',
  'cjs',
  'cpp',
  'css',
  'go',
  'h',
  'html',
  'java',
  'js',
  'json',
  'jsx',
  'kt',
  'lock',
  'log',
  'md',
  'mdx',
  'mjs',
  'php',
  'png',
  'py',
  'rb',
  'rs',
  'scss',
  'sh',
  'sql',
  'svg',
  'swift',
  'toml',
  'ts',
  'tsx',
  'txt',
  'vue',
  'yaml',
  'yml',
]);

const isFileName = ({ host }: HostParams): boolean =>
  FILE_EXTENSIONS.has(host.slice(host.lastIndexOf('.') + 1));

export const typedAddressOf = ({ text }: Params): string | null => {
  const parsed = addressOf({ text });
  if (parsed.kind !== 'ok') {
    return null;
  }
  const lower = text.trim().toLowerCase();
  const url = new URL(parsed.url);
  const isExplicit =
    WEB_PREFIXES.some((prefix) => lower.startsWith(prefix)) ||
    isLoopbackHost({ host: url.hostname }) ||
    (!isFileName({ host: url.hostname }) && (url.port !== '' || url.pathname !== '/'));
  return isExplicit ? parsed.url : null;
};
