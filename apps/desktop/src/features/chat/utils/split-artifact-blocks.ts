import { locateArtifactSpans, scanArtifactBlocks, type ArtifactScanState } from '@goodboy/core';
import type { ArtifactKind } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';

const KNOWN_KINDS: ReadonlySet<string> = new Set<ArtifactKind>(['plan', 'report', 'wireframe']);

const GENERIC_KIND = 'artifact';

const MAX_TITLE_LENGTH = 300;

type ArtifactTextSegment =
  | { readonly kind: 'prose'; readonly text: string }
  | {
      readonly kind: 'artifact';
      readonly artifactKind: string;
      readonly title: string | null;
      readonly complete: boolean;
    };

export type SplitArtifactTextResult = {
  readonly segments: ReadonlyArray<ArtifactTextSegment>;
  readonly scan: ArtifactScanState;
};

type SplitParams = {
  readonly text: string;
  readonly scan?: ArtifactScanState | null;
};

type AttrsParams = {
  readonly attrs: Readonly<Record<string, string>>;
};

type BodyParams = {
  readonly body: string;
};

const artifactKindOf = ({ attrs }: AttrsParams): string => {
  const raw = (attrs['kind'] ?? '').toLowerCase();
  return KNOWN_KINDS.has(raw) ? raw : GENERIC_KIND;
};

const titleOf = ({ body }: BodyParams): string | null => {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(payload)) {
    return null;
  }
  const raw = payload['title'];
  if (typeof raw !== 'string') {
    return null;
  }
  const title = raw.trim().slice(0, MAX_TITLE_LENGTH);
  return title.length > 0 ? title : null;
};

export const splitArtifactText = ({ text, scan = null }: SplitParams): SplitArtifactTextResult => {
  const scanned = scanArtifactBlocks({ text, from: scan });
  const segments: ArtifactTextSegment[] = [];
  let cursor = 0;

  const spans =
    scanned.spans.length === 0 && text.includes('<<artifact')
      ? locateArtifactSpans(text).filter((span) => span.complete)
      : scanned.spans;

  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ kind: 'prose', text: text.slice(cursor, span.start - 1) });
    }
    segments.push({
      kind: 'artifact',
      artifactKind: artifactKindOf({ attrs: span.attrs }),
      title: span.complete ? titleOf({ body: text.slice(span.bodyStart, span.bodyEnd) }) : null,
      complete: span.complete,
    });
    cursor = span.end;
  }

  if (cursor < text.length) {
    segments.push({ kind: 'prose', text: text.slice(cursor) });
  }

  return { segments, scan: scanned.state };
};
