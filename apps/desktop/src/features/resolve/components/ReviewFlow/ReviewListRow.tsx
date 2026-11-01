import {
  Chip,
  ROW_INTERACTIVE,
  SelectionCheckbox,
  StatusDot,
  Tooltip,
  WorkNode,
  cn,
  TruncatedText,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { useNow } from '../../../../shared/hooks/useNow';
import { REVIEW_LAUNCH_LABEL } from '../../reviewLaunchCopy';
import { REVIEW_COMMENT_NODE } from '../../reviewCommentState';
import { entryBodyOf, entryTitleOf } from './entryTitle';
import { rowQualifierOf } from './rowQualifier';
import { RowFixDiffLink } from './RowFixDiffLink';
import { RowFixLine } from './RowFixLine';
import type { ReviewEntry } from './useReviewEntries';

type RowSelection = {
  readonly isChecked: boolean;
  readonly isSelecting: boolean;
  readonly onToggle: () => void;
};

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly isNew: boolean;
  readonly isSelected: boolean;
  readonly isSourceShown: boolean;
  readonly onSelect: () => void;
  readonly selection: RowSelection | null;
};

const GROUP_WORDS: ReadonlySet<string> = new Set([
  'Open',
  'Working',
  'Applied',
  'Replied',
  'Done',
  'Left open',
]);

export const ReviewListRow = ({
  sessionId,
  entry,
  isNew,
  isSelected,
  isSourceShown,
  onSelect,
  selection,
}: Props) => {
  const now = useNow(60_000);
  const menu = useObjectMenuTrigger({
    target: { kind: 'reviewComment', sessionId, threadId: entry.threadId },
    anchorKey: `review-row:${entry.threadId}`,
  });
  const note = entry.row.reviewerNote;
  const body = entryBodyOf({ entry });
  const title = entryTitleOf({ entry });
  const qualifier = rowQualifierOf({ entry });
  const selectLabel = `${REVIEW_LAUNCH_LABEL.selectRow} ${note?.author ?? ''}`.trim();
  const isWordShown = !GROUP_WORDS.has(entry.word);
  const stateWord = isWordShown ? (
    <span data-row-state className="shrink-0 whitespace-nowrap text-muted-foreground">
      {entry.word}
    </span>
  ) : null;
  const meta =
    note === null
      ? ''
      : joinFacts({ facts: [note.author, formatAge({ from: note.createdAtMs, now })] });
  const place =
    note === null || note.path === null
      ? null
      : `${note.path}${note.line == null ? '' : `:${note.line}`}`;
  return (
    <div
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className="group/review-row group/select-row relative min-w-0"
    >
      <button
        type="button"
        data-thread-id={entry.threadId}
        aria-current={isSelected ? 'true' : undefined}
        aria-description={qualifier ?? undefined}
        onClick={onSelect}
        className={cn(
          'flex w-full min-w-0 items-start gap-3 rounded-md px-3 py-2 text-left',
          ROW_INTERACTIVE,
          isSelected && 'bg-selected',
        )}
      >
        <span
          className={cn(
            'flex h-5 shrink-0 items-center motion-safe:transition-opacity',
            selection !== null &&
              (selection.isChecked || selection.isSelecting
                ? 'opacity-0'
                : 'group-focus-within/review-row:opacity-0 group-hover/review-row:opacity-0'),
          )}
        >
          <WorkNode
            state={REVIEW_COMMENT_NODE[entry.toneKey]}
            label={entry.word}
            mark={{ kind: 'dot' }}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex h-5 min-w-0 items-center gap-2 text-meta">
            {isNew ? <StatusDot tone="primary" size="sm" ariaLabel="New" /> : null}
            <span data-row-author className="min-w-0 flex-1 truncate text-muted-foreground">
              {meta}
            </span>
            {isSourceShown && note !== null && note.source === 'note' ? (
              <Chip tone="neutral" kind="state" bordered={false} label="Note" />
            ) : null}
            {stateWord === null ? null : qualifier === null ? (
              stateWord
            ) : (
              <Tooltip content={qualifier}>{stateWord}</Tooltip>
            )}
          </span>
          {place === null ? null : (
            <TruncatedText
              data-row-file
              className="min-w-0 truncate font-mono text-meta text-faint-foreground"
            >
              {place}
            </TruncatedText>
          )}
          <TruncatedText
            tooltip={body ?? undefined}
            className="min-w-0 truncate text-body text-foreground"
          >
            {title}
          </TruncatedText>
          {entry.fix === null ? null : <RowFixLine fix={entry.fix} />}
        </span>
      </button>
      {entry.fix?.kind === 'fixed' ? (
        <RowFixDiffLink sessionId={sessionId} entry={entry} commit={entry.fix.commit} />
      ) : null}
      {selection !== null && (
        <SelectionCheckbox
          checked={selection.isChecked}
          label={selectLabel}
          onToggle={selection.onToggle}
          className="absolute left-2.5 top-2"
        />
      )}
    </div>
  );
};
