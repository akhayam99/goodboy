import type { ArtifactId } from '@goodboy/types';
import type { HeldDraft } from './heldDraft';
import { heldDraftKeyOf } from './heldDraftKeyOf';

type DraftParams = Readonly<{
  draft: Pick<HeldDraft, 'sessionId' | 'artifactId' | 'revision' | 'anchor'>;
}>;
type HoldParams = Readonly<{ draft: HeldDraft }>;
type ForParams = Readonly<{ artifactId: ArtifactId }>;
type SubscribeParams = Readonly<{ onChange: () => void }>;

const HELD = new Map<string, HeldDraft>();
const LISTENERS = new Set<() => void>();
const SNAPSHOTS = new Map<ArtifactId, ReadonlyArray<HeldDraft>>();
const NONE: ReadonlyArray<HeldDraft> = [];

const changed = (): void => {
  SNAPSHOTS.clear();
  for (const listener of LISTENERS) {
    listener();
  }
};

export const heldDraftStore = {
  hold: ({ draft }: HoldParams): void => {
    HELD.set(heldDraftKeyOf({ draft }), draft);
    changed();
  },
  release: ({ draft }: DraftParams): void => {
    if (HELD.delete(heldDraftKeyOf({ draft }))) {
      changed();
    }
  },
  allFor: ({ artifactId }: ForParams): ReadonlyArray<HeldDraft> => {
    const cached = SNAPSHOTS.get(artifactId);
    if (cached !== undefined) {
      return cached;
    }
    const found = [...HELD.values()].filter((draft) => draft.artifactId === artifactId);
    const next = found.length === 0 ? NONE : found;
    SNAPSHOTS.set(artifactId, next);
    return next;
  },
  hasFor: ({ artifactId }: ForParams): boolean =>
    [...HELD.values()].some((draft) => draft.artifactId === artifactId),
  subscribe: ({ onChange }: SubscribeParams): (() => void) => {
    LISTENERS.add(onChange);
    return () => {
      LISTENERS.delete(onChange);
    };
  },
  clear: (): void => {
    HELD.clear();
    changed();
  },
};
