import type {
  CrumbMenuAction,
  CrumbMenuGroup,
  CrumbMenuModel,
  CrumbMenuRow,
  CrumbState,
} from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { ResolveQueueRow } from '../../../resolve/buildResolveQueueRows';
import {
  RESOLVE_WORD_LABEL,
  RESOLVE_WORD_TONE,
  type ResolveWord,
} from '../../../resolve/commentProjection';
import type { ResolveUiState } from '../../../resolve/resolveRowState';
import { threadLocationOf } from '../../../resolve/threadLocationOf';

const WORD_OF_STATUS: Readonly<Record<ResolveUiState, ResolveWord>> = {
  new: 'open',
  working: 'working',
  needs_you: 'question',
  ready: 'to_review',
  approved: 'ready',
  resolved: 'done',
  failed: 'couldnt_fix',
  later: 'left_open',
};

const stateOf = ({ row }: { readonly row: ResolveQueueRow }): CrumbState => {
  const word =
    row.status === 'failed' && row.rowState.failedStep !== 'run' && row.rowState.failedStep !== null
      ? 'push_failed'
      : WORD_OF_STATUS[row.status];
  return { word: RESOLVE_WORD_LABEL[word], tone: RESOLVE_WORD_TONE[word] };
};

type ConversationParams = {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
  readonly currentThreadId: string | null;
  readonly prNumber: number | null;
  readonly actions: ReadonlyArray<CrumbMenuAction>;
  readonly onSelect: (row: ResolveQueueRow) => void;
};

const firstLine = (text: string): string => text.split('\n')[0]?.trim() ?? '';

export const conversationMenu = ({
  rows,
  currentThreadId,
  prNumber,
  actions,
  onSelect,
}: ConversationParams): CrumbMenuModel => {
  const rowOf = (row: ResolveQueueRow): CrumbMenuRow => {
    const location = threadLocationOf({ row });
    const body = firstLine(row.commentThread?.head.body ?? '');
    return {
      id: row.thread.threadId,
      lead: { kind: 'icon', icon: CONCEPT_ICONS.comments },
      label: body === '' ? (location?.shortLabel ?? 'Comment') : body,
      secondary: location?.line == null ? null : `:${location.line}`,
      metaA: null,
      state: stateOf({ row }),
      isCurrent: row.thread.threadId === currentThreadId,
      isDisabled: false,
      indent: 0,
      onSelect: () => onSelect(row),
    };
  };
  const open = rows.filter((row) => row.status !== 'resolved');
  const resolved = rows.filter((row) => row.status === 'resolved');
  const fileOf = (row: ResolveQueueRow) => threadLocationOf({ row })?.path ?? 'Conversation';
  const files = [...new Set(open.map(fileOf))];
  const groups: ReadonlyArray<CrumbMenuGroup> = [
    ...files.map((file) => ({
      id: file,
      label: file,
      rows: open.filter((row) => fileOf(row) === file).map(rowOf),
    })),
    { id: 'resolved', label: `${resolved.length} resolved`, rows: resolved.map(rowOf) },
  ].filter((group) => group.rows.length > 0);

  return {
    title: 'Conversations',
    context: prNumber === null ? null : `#${prNumber}`,
    count: `${open.length} open`,
    triggerLabel: 'Switch conversation',
    groups,
    actions: actions.slice(0, 2),
    width: 'regular',
    filterPlaceholder: 'Filter conversations',
  };
};
