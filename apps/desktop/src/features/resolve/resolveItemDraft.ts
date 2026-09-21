export type ResolveDecisionMode = 'read' | 'fix' | 'discuss' | 'close' | 'resolve' | 'edit_reply';

export type ResolveItemDraft = {
  readonly reply: string | null;
  readonly instruction: string;
  readonly mode: ResolveDecisionMode;
};

export const EMPTY_RESOLVE_ITEM_DRAFT: ResolveItemDraft = {
  reply: null,
  instruction: '',
  mode: 'read',
};

export const draftReplyText = ({
  draft,
  proposal,
}: {
  readonly draft: ResolveItemDraft;
  readonly proposal: string | null;
}): string => draft.reply ?? proposal ?? '';
