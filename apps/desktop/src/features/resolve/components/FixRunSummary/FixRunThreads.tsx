import { Band, Button, Chip, cn, inlineMarkdownText } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { openReview } from '../../../review/openReview';
import { noteIdOfThread } from '../../notes/noteThread';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';
import { FIX_RUN_COPY } from '../../reviewFlowCopy';
import { threadLocationOf } from '../../threadLocationOf';
import { firstSentence } from '../ReviewFlow/firstSentence';
import { STATE_CHIP_TONE } from '../ReviewFlow/stateTone';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';

type FixRunThread = {
  readonly threadId: string;
  readonly entry: ReviewEntry | null;
};

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly threads: ReadonlyArray<FixRunThread>;
  readonly batchThreadIds: ReadonlyArray<string>;
  readonly hasStateColumn: boolean;
  readonly onOpen: (threadId: string) => void;
};

const ROW_CLASS =
  'grid w-full min-w-0 grid-cols-subgrid items-center rounded-sm py-1 text-left text-body hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

const titleOf = ({ entry }: { readonly entry: ReviewEntry }): string => {
  const note = entry.row.reviewerNote;
  return note === null
    ? RESOLVE_COMMENT_UNAVAILABLE
    : firstSentence({ text: inlineMarkdownText({ text: note.body }) });
};

const whereOf = ({ entry }: { readonly entry: ReviewEntry }): string =>
  [entry.row.reviewerNote?.author ?? null, threadLocationOf({ row: entry.row })?.shortLabel ?? null]
    .filter((part): part is string => part !== null)
    .join(' · ');

export const FixRunThreads = ({
  sessionId,
  mountId,
  threads,
  batchThreadIds,
  hasStateColumn,
  onOpen,
}: Props) => (
  <Band
    inset="content"
    label={FIX_RUN_COPY.threadsHeading({ count: threads.length })}
    headingLevel={2}
  >
    <ul
      className={cn(
        'grid min-w-0 gap-x-2',
        hasStateColumn ? 'grid-cols-[max-content_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)]',
      )}
    >
      {threads.map(({ threadId, entry }) => (
        <li
          key={threadId}
          className={cn(
            'grid min-w-0 list-none grid-cols-subgrid',
            hasStateColumn ? 'col-span-2' : 'col-span-1',
          )}
        >
          {entry === null ? (
            <p className="col-span-full py-1 text-body text-muted-foreground">
              {FIX_RUN_COPY.gone}
            </p>
          ) : (
            <button
              type="button"
              className={cn(ROW_CLASS, hasStateColumn ? 'col-span-2' : 'col-span-1')}
              onClick={() => onOpen(threadId)}
            >
              {hasStateColumn && (
                <Chip
                  tone={STATE_CHIP_TONE[entry.state]}
                  kind="state"
                  bordered={false}
                  label={entry.word}
                  className="justify-self-start"
                />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="min-w-0 truncate text-foreground">{titleOf({ entry })}</span>
                <span className="min-w-0 truncate text-meta text-muted-foreground">
                  {whereOf({ entry })}
                </span>
              </span>
            </button>
          )}
        </li>
      ))}
    </ul>
    {batchThreadIds.length > threads.length && (
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-meta text-muted-foreground">
        <span>{FIX_RUN_COPY.batch({ others: batchThreadIds.length - threads.length })}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            void openReview({
              sessionId,
              destination: { kind: 'threads', mountId, threadIds: batchThreadIds },
            })
          }
        >
          {batchThreadIds.every((threadId) => noteIdOfThread({ threadId }) !== null)
            ? FIX_RUN_COPY.openBatchNotes
            : FIX_RUN_COPY.openBatch}
        </Button>
      </div>
    )}
  </Band>
);
