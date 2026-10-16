import type { TranscriptRow } from './cluster-operations';
import type { TranscriptItem } from './transcript-items';
import { planChecklist, type PlanChecklist } from './planChecklist';
import { turnSummary } from './turnSummary';

export type ConversationRow =
  | TranscriptRow
  | {
      readonly kind: 'summary';
      readonly key: string;
      readonly steps: ReadonlyArray<TranscriptItem>;
    }
  | { readonly kind: 'plan'; readonly key: string; readonly checklist: PlanChecklist };

type Params = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly isLive: boolean;
};

type SegmentParams = {
  readonly segment: ReadonlyArray<TranscriptItem>;
  readonly isSegmentLive: boolean;
  readonly checklist: PlanChecklist | null;
  readonly out: Array<ConversationRow>;
};

const STEP_KINDS = new Set<TranscriptItem['kind']>([
  'tool_call',
  'file_edit',
  'skill_invocation',
  'permission_request',
  'permission_decision',
]);

const BOUNDARY_KINDS = new Set<TranscriptItem['kind']>(['user_text', 'handoff', 'oq_answer']);

type ItemParams = {
  readonly item: TranscriptItem;
};

type PendingParams = {
  readonly segment: ReadonlyArray<TranscriptItem>;
};

type PushParams = {
  readonly out: Array<ConversationRow>;
  readonly item: TranscriptItem;
};

const isStep = ({ item }: ItemParams): boolean => STEP_KINDS.has(item.kind);

const pendingPermissions = ({ segment }: PendingParams): ReadonlyArray<TranscriptItem> => {
  const decided = new Set<string>();
  const ended = new Set<string>();
  for (const item of segment) {
    if (item.kind === 'permission_decision') {
      decided.add(item.toolUseId);
    }
    if (item.kind === 'tool_call' && item.ended) {
      ended.add(item.toolUseId);
    }
  }
  return segment.filter(
    (item) =>
      item.kind === 'permission_request' &&
      !decided.has(item.toolUseId) &&
      !ended.has(item.toolUseId),
  );
};

const pushItem = ({ out, item }: PushParams) => {
  out.push({ kind: 'item', key: item.key, item });
};

const pushSegment = ({ segment, isSegmentLive, checklist, out }: SegmentParams) => {
  const steps = segment.filter((item) => isStep({ item }));
  const lastStepIndex = segment.reduce(
    (last, item, index) => (isStep({ item }) ? index : last),
    -1,
  );
  const summary = isSegmentLive ? null : turnSummary({ steps });
  const hasPlan = checklist !== null && segment.some((item) => item.key === checklist.anchorKey);
  let isPlanPlaced = !hasPlan;
  let isSummaryPlaced = summary === null;
  const placePlan = () => {
    if (isPlanPlaced || checklist === null) {
      return;
    }
    isPlanPlaced = true;
    out.push({ kind: 'plan', key: `plan-${checklist.anchorKey}`, checklist });
  };

  segment.forEach((item, index) => {
    if (isStep({ item })) {
      if (isSummaryPlaced) {
        return;
      }
      isSummaryPlaced = true;
      out.push({ kind: 'summary', key: `summary-${item.key}`, steps });
      return;
    }
    if (item.kind === 'assistant_text' && (isSegmentLive || index < lastStepIndex)) {
      return;
    }
    if (item.kind === 'usage') {
      placePlan();
    }
    pushItem({ out, item });
  });
  placePlan();
  for (const item of pendingPermissions({ segment })) {
    pushItem({ out, item });
  }
};

export const conversationRows = ({ items, isLive }: Params): ReadonlyArray<ConversationRow> => {
  const checklist = planChecklist({ items });
  const out: Array<ConversationRow> = [];
  let segment: Array<TranscriptItem> = [];
  for (const item of items) {
    if (!BOUNDARY_KINDS.has(item.kind)) {
      segment.push(item);
      continue;
    }
    pushSegment({ segment, isSegmentLive: false, checklist, out });
    segment = [];
    pushItem({ out, item });
  }
  pushSegment({ segment, isSegmentLive: isLive, checklist, out });
  return out;
};
