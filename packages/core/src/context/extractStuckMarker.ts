import { canonicalizeMarkers } from './canonicalizeMarkers';

export type ExtractedStuck = {
  readonly id: string;
  readonly reason: string;
};

type Params = {
  readonly text: string;
  readonly kind: 'step' | 'cluster';
};

const ATTR_RE = /(?<![\w-])([\w-]+)="([^"]*)"/g;

const MAX_ATTRS_CHARS = 1000;

export const extractStuckMarker = ({ text, kind }: Params): ExtractedStuck | null => {
  const marker = new RegExp(`<<${kind}-stuck\\s([^<>]*)>>`, 'g');
  const canonical = canonicalizeMarkers({ text });
  let last: ExtractedStuck | null = null;
  let found: RegExpExecArray | null;
  while ((found = marker.exec(canonical)) !== null) {
    const inner = found[1] ?? '';
    if (inner.length > MAX_ATTRS_CHARS) {
      continue;
    }
    const attrs = new Map<string, string>();
    for (const [, key = '', value = ''] of inner.matchAll(ATTR_RE)) {
      attrs.set(key.toLowerCase(), value);
    }
    const id = (attrs.get('id') ?? '').trim();
    if (id.length === 0) {
      continue;
    }
    last = { id, reason: (attrs.get('reason') ?? '').trim() };
  }
  return last;
};
