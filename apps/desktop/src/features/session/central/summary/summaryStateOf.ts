import { parseSummaryDocument } from '@goodboy/core';
import { inlineMarkdownText } from '@goodboy/ui';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { firstSentenceOf } from '../done/firstSentenceOf';

const HOUR_MS = 60 * 60 * 1000;

const SUMMARY_STALE_AFTER_MS = 24 * HOUR_MS;

const SUMMARY_BRANCH_GRACE_MS = 5 * 60 * 1000;

const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;

type SummaryStateWhy = 'old' | 'branches';

export type SummaryState = Readonly<{
  sentence: string;
  label: string;
  isStale: boolean;
  why: SummaryStateWhy | null;
}>;

type Params = {
  readonly text: string;
  readonly updatedAtMs: number | null;
  readonly nowMs: number;
  readonly branchChangedAtMs: number | null;
};

type WhyParams = Omit<Params, 'text'>;

const whyOf = ({ updatedAtMs, nowMs, branchChangedAtMs }: WhyParams): SummaryStateWhy | null => {
  if (updatedAtMs === null) {
    return null;
  }
  if (branchChangedAtMs !== null && branchChangedAtMs > updatedAtMs + SUMMARY_BRANCH_GRACE_MS) {
    return 'branches';
  }
  return nowMs - updatedAtMs > SUMMARY_STALE_AFTER_MS ? 'old' : null;
};

type LabelParams = {
  readonly age: string;
  readonly why: SummaryStateWhy | null;
};

const stateLabelOf = ({ age, why }: LabelParams): string => {
  if (age === '') {
    return '';
  }
  if (why === 'branches') {
    return `Written ${age}, a branch is newer`;
  }
  return why === 'old' ? `Written ${age}, may be out of date` : `Written ${age}`;
};

export const summaryStateOf = ({
  text,
  updatedAtMs,
  nowMs,
  branchChangedAtMs,
}: Params): SummaryState | null => {
  const block = parseSummaryDocument({ text }).blocks.find(
    (candidate) => candidate.sectionKey === 'state',
  );
  const body = (block?.body ?? '')
    .split('\n')
    .map((line) => line.replace(LIST_MARKER, ''))
    .join('\n');
  const first = firstSentenceOf({ text: inlineMarkdownText({ text: body }) });
  if (first === null || first.trim() === '') {
    return null;
  }
  const why = whyOf({ updatedAtMs, nowMs, branchChangedAtMs });
  const age = updatedAtMs === null ? '' : formatAge({ from: updatedAtMs, now: nowMs });
  return { sentence: first.trim(), label: stateLabelOf({ age, why }), isStale: why !== null, why };
};
