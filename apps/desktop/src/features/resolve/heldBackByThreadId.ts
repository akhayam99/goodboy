import type { ResolvePublicationDrift } from '@goodboy/types';

export type HeldBackKind = 'comment_changed' | 'approval_withdrawn';

type Params = Readonly<{
  drift: ReadonlyArray<ResolvePublicationDrift>;
}>;

export const heldBackByThreadId = ({ drift }: Params): ReadonlyMap<string, HeldBackKind> => {
  const held = new Map<string, HeldBackKind>();
  for (const entry of drift) {
    if (entry.threadId === null) {
      continue;
    }
    if (entry.kind !== 'comment_changed' && entry.kind !== 'approval_withdrawn') {
      continue;
    }
    held.set(entry.threadId, entry.kind);
  }
  return held;
};
