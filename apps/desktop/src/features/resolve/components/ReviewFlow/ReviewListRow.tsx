import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import {
  Button,
  Chip,
  ROW_INTERACTIVE,
  SelectionCheckbox,
  Tooltip,
  WorkNode,
  cn,
  TruncatedText,
} from '@goodboy/ui';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { useNow } from '../../../../shared/hooks/useNow';
import type { ResolveConversationSource } from '../../buildResolveQueueRows';
import { REVIEW_LAUNCH_LABEL } from '../../reviewLaunchCopy';
import { REVIEW_COMMENT_NODE } from '../../reviewCommentState';
import { entryBodyOf, entryTitleOf } from './entryTitle';
import { rowQualifierOf } from './rowQualifier';
import { STATE_WORD_TONE } from './stateTone';
import type { ReviewEntry } from './useReviewEntries';

type RowSelection = {
  readonly isChecked: boolean;
  readonly isSelecting: boolean;
  readonly onToggle: () => void;
};

type Props = {
  readonly entry: ReviewEntry;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onFix: (() => void) | null;
  readonly selection: RowSelection | null;
};

const fileOf = ({ path }: { readonly path: string | null }): string | null =>
  path === null ? null : (path.split('/').at(-1) ?? path);

type KindParams = {
  readonly source: ResolveConversationSource;
};

const kindLabelOf = ({ source }: KindParams): string =>
  source === 'note' ? 'Note' : `On ${REVIEW_SOURCE_LABEL[source]}`;

export const ReviewListRow = ({ entry, isSelected, onSelect, onFix, selection }: Props) => {
  const now = useNow(60_000);
  const note = entry.row.reviewerNote;
  const body = entryBodyOf({ entry });
  const title = entryTitleOf({ entry });
  const file = fileOf({ path: note?.path ?? null });
  const qualifier = rowQualifierOf({ entry });
  const selectLabel = `${REVIEW_LAUNCH_LABEL.selectRow} ${note?.author ?? ''}`.trim();
  const stateWord = (
    <span
      data-row-state
      className={cn('ml-auto shrink-0 whitespace-nowrap', STATE_WORD_TONE[entry.toneKey])}
    >
      {entry.word}
    </span>
  );
  return (
    <div className="group/review-row group/select-row relative min-w-0">
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
          onFix !== null && 'pr-14',
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
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-meta">
            {note !== null && (
              <span data-row-author className="shrink-0 whitespace-nowrap text-muted-foreground">
                {note.author}
              </span>
            )}
            {note !== null && (
              <Chip
                tone="neutral"
                kind="state"
                bordered={false}
                label={kindLabelOf({ source: note.source })}
              />
            )}
            {note !== null && (
              <span data-row-age className="shrink-0 whitespace-nowrap text-faint-foreground">
                {formatAge({ from: note.createdAtMs, now })}
              </span>
            )}
            {file !== null && (
              <span
                data-row-file
                className="min-w-0 flex-1 basis-[8ch] truncate font-mono text-faint-foreground"
              >
                {file}
                {note?.line == null ? '' : `:${note.line}`}
              </span>
            )}
            {qualifier === null ? stateWord : <Tooltip content={qualifier}>{stateWord}</Tooltip>}
          </span>
          <TruncatedText
            tooltip={body ?? undefined}
            className="min-w-0 truncate text-body text-foreground"
          >
            {title}
          </TruncatedText>
        </span>
      </button>
      {selection !== null && (
        <SelectionCheckbox
          checked={selection.isChecked}
          label={selectLabel}
          onToggle={selection.onToggle}
          className="absolute left-2.5 top-2"
        />
      )}
      {onFix !== null && (
        <Button
          size="xs"
          variant="secondary"
          data-fix-row={entry.threadId}
          onClick={onFix}
          className="absolute right-2 top-1.5"
        >
          {REVIEW_LAUNCH_LABEL.fix}
        </Button>
      )}
    </div>
  );
};
