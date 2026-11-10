import { addressOf } from './addressOf';

type Params = {
  readonly text: string;
};

const PAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  'avif',
  'gif',
  'htm',
  'html',
  'jpeg',
  'jpg',
  'pdf',
  'png',
  'svg',
  'webp',
]);

export const typedLocalPathOf = ({ text }: Params): string | null => {
  const parsed = addressOf({ text });
  if (parsed.kind !== 'local') {
    return null;
  }
  const name = parsed.path.split('/').pop() ?? '';
  const extension = name.includes('.') ? (name.split('.').pop() ?? '') : '';
  return PAGE_EXTENSIONS.has(extension.toLowerCase()) ? parsed.path : null;
};
