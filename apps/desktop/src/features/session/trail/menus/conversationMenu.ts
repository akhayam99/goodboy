import type {
  CrumbMenuAction,
  CrumbMenuGroup,
  CrumbMenuModel,
  CrumbMenuRow,
  CrumbState,
} from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { ResolveQueueRow } from '../../../resolve/buildResolveQueueRows';
import { RESOLVE_WORD_LABEL } from '../../../resolve/commentProjection';
import type { ResolveUiState } from '../../../resolve/resolveRowState';
import { threadLocationOf } from '../../../resolve/threadLocationOf';

const CONVERSATION_STATE = {
  new: { word: RESOLVE_WORD_LABEL.open, tone: 'neutral' },
  working: { word: RESOLVE_WORD_LABEL.working, tone: 'info' },
  needs_you: { word: RESOLVE_WORD_LABEL.needs_you, tone: 'warning' },
  ready: { word: RESOLVE_WORD_LABEL.ready, tone: 'success' },
  approved: { word: RESOLVE_WORD_LABEL.done, tone: 'success' },
  resolved: { word: RESOLVE_WORD_LABEL.done, tone: 'neutral' },
  failed: { word: RESOLVE_WORD_LABEL.couldnt_fix, tone: 'danger' },
  later: { word: RESOLVE_WORD_LABEL.done, tone: 'neutral' },
} satisfies Record<ResolveUiState, CrumbState>;

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
      state: CONVERSATION_STATE[row.status],
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
