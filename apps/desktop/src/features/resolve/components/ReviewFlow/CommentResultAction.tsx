import { Button, OverflowMenu, type MenuEntry } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { AppStore } from '../../../../store/store';
import { ITEM_WORK_WORDS } from '../../../live-state/itemWork/itemWorkWords';
import type { CommentRowAction } from '../../commentRowResultOf';
import type { CommentRow } from './useCommentRow';
import { RowFixDiffLink } from './RowFixDiffLink';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly action: CommentRowAction;
  readonly row: CommentRow;
  readonly isReviewOpen: boolean;
  readonly onToggleReview: () => void;
};

type MenuParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly row: CommentRow;
  readonly openDrawer: AppStore['openDrawer'];
};

const COMMENT_RESULT_COPY = {
  menu: 'Fix actions',
  startOverDescription: 'Begins a new agent on this comment',
} as const;

const retryMenuOf = ({
  sessionId,
  agentId,
  row,
  openDrawer,
}: MenuParams): ReadonlyArray<MenuEntry> => [
  {
    kind: 'item',
    key: 'retry-hint',
    label: ITEM_WORK_WORDS.verb.retryWithHint,
    onSelect: row.retryWithHint,
  },
  {
    kind: 'item',
    key: 'start-over',
    label: ITEM_WORK_WORDS.verb.startOver,
    description: COMMENT_RESULT_COPY.startOverDescription,
    onSelect: row.fix,
  },
  ...(agentId === null
    ? []
    : [
        {
          kind: 'item' as const,
          key: 'open-transcript',
          label: ITEM_WORK_WORDS.verb.openTranscript,
          onSelect: () => openDrawer({ kind: 'transcript', sessionId, payload: { agentId } }),
        },
      ]),
];

export const CommentResultAction = ({
  sessionId,
  entry,
  action,
  row,
  isReviewOpen,
  onToggleReview,
}: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  if (action === 'reviewApply') {
    return (
      <>
        <Button variant="ghost" size="sm" aria-expanded={isReviewOpen} onClick={onToggleReview}>
          {ITEM_WORK_WORDS.verb.review}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          isBusy={row.isApplying}
          disabled={row.isDiscarding}
          onClick={row.apply}
        >
          {ITEM_WORK_WORDS.verb.apply}
        </Button>
      </>
    );
  }
  if (action === 'retry') {
    return (
      <>
        <Button variant="secondary" size="sm" isBusy={row.isStarting} onClick={row.retry}>
          {ITEM_WORK_WORDS.verb.retry}
        </Button>
        <OverflowMenu
          label={COMMENT_RESULT_COPY.menu}
          disabled={row.isStarting}
          entries={retryMenuOf({
            sessionId,
            agentId: entry.row.attempt?.agentId ?? null,
            row,
            openDrawer,
          })}
        />
      </>
    );
  }
  return entry.fix?.kind === 'fixed' ? (
    <RowFixDiffLink sessionId={sessionId} entry={entry} commit={entry.fix.commit} />
  ) : null;
};
