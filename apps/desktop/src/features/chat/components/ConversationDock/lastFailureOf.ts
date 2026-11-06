import type { TranscriptItem } from '../../utils/transcript-items';

export type FailureItem = Extract<TranscriptItem, { readonly kind: 'error' }>;

type Params = {
  readonly items: ReadonlyArray<TranscriptItem>;
};

export const lastFailureOf = ({ items }: Params): FailureItem | null => {
  for (const item of [...items].reverse()) {
    if (item.kind === 'error') {
      return item;
    }
    if (item.kind === 'user_text') {
      return null;
    }
  }
  return null;
};
