import type { SentryIssueDetail, SentryTag } from './client';

type Params = {
  readonly detail: SentryIssueDetail | null;
};

const VISIBLE_TAGS = new Set(['release', 'environment']);

export const visibleSentryTags = ({ detail }: Params): ReadonlyArray<SentryTag> =>
  detail?.tags?.filter((tag) => VISIBLE_TAGS.has(tag.key)) ?? [];
