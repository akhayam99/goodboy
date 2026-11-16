import type { SummaryDocument } from '@goodboy/core/context';
import { inlineMarkdownText } from '@goodboy/ui';
import { summaryItems } from './summaryItems';

export type SummaryStatusTone = 'blocked' | 'working' | 'done';

export type SummaryStatus = {
  readonly tone: SummaryStatusTone;
  readonly line: string | null;
  readonly blockers: ReadonlyArray<string>;
  readonly facts: ReadonlyArray<string>;
  readonly stepCount: number;
};

const BLOCKER = /\b(?:blocked|blocker|cannot|can't)\b|^(?:waiting|stuck)\b/i;
const BLOCKER_LABEL = /^(?:\*\*)?(?:blocked|blocker)(?:\*\*)?:(?:\*\*)?[ \t]*/i;

type Params = {
  readonly document: SummaryDocument;
};

type ItemParams = {
  readonly item: string;
};

const isBlocker = ({ item }: ItemParams): boolean =>
  BLOCKER.test(inlineMarkdownText({ text: item }).trim());

const withoutBlockerLabel = ({ item }: ItemParams): string => {
  const stripped = item.trimStart().replace(BLOCKER_LABEL, '');
  return stripped.trim() === '' ? item : stripped;
};

export const summaryStatusOf = ({ document }: Params): SummaryStatus | null => {
  const state = document.blocks.find((block) => block.sectionKey === 'state');
  const items = summaryItems({ body: state?.body ?? '' });
  if (items.length === 0) {
    return null;
  }
  const blockers = items
    .filter((item) => isBlocker({ item }))
    .map((item) => withoutBlockerLabel({ item }));
  const [line = null, ...facts] = items.filter((item) => !isBlocker({ item }));
  const next = document.blocks.find((block) => block.sectionKey === 'next');
  const stepCount = summaryItems({ body: next?.body ?? '' }).length;
  if (blockers.length > 0) {
    return { tone: 'blocked', line, blockers, facts, stepCount };
  }
  if (stepCount > 0) {
    return { tone: 'working', line, blockers, facts, stepCount };
  }
  return { tone: 'done', line, blockers, facts, stepCount };
};
