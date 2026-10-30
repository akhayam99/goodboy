import { stripControlMarkers } from '@goodboy/core';
import { estimateRenderedLines } from '@goodboy/ui';
import type { ProviderRunId } from '@goodboy/types';
import type { ConversationRow } from '../utils/conversationRows';
import type { TranscriptItem } from '../utils/transcript-items';
import { READING_BUDGETS } from './readingBudgets';

type ReadingNote = {
  readonly key: string;
  readonly text: string;
};

export type NotesRole = {
  readonly kind: 'notes';
  readonly notes: ReadonlyArray<ReadingNote>;
  readonly lineCount: number;
  readonly isOpen: boolean;
};

export type ReadingRole =
  | { readonly kind: 'live' }
  | { readonly kind: 'answer'; readonly clampLines: number }
  | NotesRole
  | { readonly kind: 'hidden' };

type Params = {
  readonly rows: ReadonlyArray<ConversationRow>;
  readonly activeRunId?: ProviderRunId | null;
};

type TextRow = {
  readonly key: string;
  readonly text: string;
  readonly runId: ProviderRunId | null;
};

type Segment = {
  readonly texts: Array<TextRow>;
  hasError: boolean;
};

const BOUNDARY_KINDS = new Set<TranscriptItem['kind']>([
  'user_text',
  'handoff',
  'oq_answer',
  'auto_delivery',
]);

const emptySegment = (): Segment => ({ texts: [], hasError: false });

type SegmentParams = {
  readonly rows: ReadonlyArray<ConversationRow>;
};

const turnSegmentsOf = ({ rows }: SegmentParams) => {
  const segments: Array<Segment> = [emptySegment()];
  for (const row of rows) {
    const current = segments[segments.length - 1];
    if (current === undefined) {
      continue;
    }
    if (row.kind !== 'item') {
      continue;
    }
    if (BOUNDARY_KINDS.has(row.item.kind)) {
      segments.push(emptySegment());
      continue;
    }
    if (row.item.kind === 'error') {
      current.hasError = true;
    }
    if (row.item.kind === 'assistant_text') {
      current.texts.push({ key: row.key, text: row.item.text, runId: row.item.runId ?? null });
    }
  }
  return segments;
};

export const readingOrderOf = ({
  rows,
  activeRunId = null,
}: Params): ReadonlyMap<string, ReadingRole> => {
  const roles = new Map<string, ReadingRole>();
  for (const segment of turnSegmentsOf({ rows })) {
    const answer = segment.texts[segment.texts.length - 1];
    if (answer === undefined) {
      continue;
    }
    const isLive = segment.texts.some((text) => text.runId !== null && text.runId === activeRunId);
    if (isLive) {
      continue;
    }
    const earlierAll = segment.texts.slice(0, -1);
    const earlier = earlierAll.filter(({ text }) => stripControlMarkers(text) === text);
    roles.set(answer.key, { kind: 'answer', clampLines: READING_BUDGETS.answerClampLines });
    const [lead, ...rest] = earlier;
    if (lead === undefined) {
      continue;
    }
    roles.set(lead.key, {
      kind: 'notes',
      notes: earlier.map(({ key, text }) => ({ key, text })),
      lineCount: earlier.reduce((total, { text }) => total + estimateRenderedLines({ text }), 0),
      isOpen: segment.hasError,
    });
    for (const other of rest) {
      roles.set(other.key, { kind: 'hidden' });
    }
  }
  return roles;
};
