import type { HeldDraft } from './heldDraft';

type Params = Readonly<{
  draft: Pick<HeldDraft, 'sessionId' | 'artifactId' | 'revision' | 'anchor'>;
}>;

export const heldDraftKeyOf = ({ draft }: Params): string =>
  [draft.sessionId, draft.artifactId, draft.revision, JSON.stringify(draft.anchor)].join('|');
