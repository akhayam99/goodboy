import { cn, Tooltip } from '@goodboy/ui';
import type { BranchCommit } from '@goodboy/types';
import type { HistoryRowView } from './historyRowLine';

type Props = {
  readonly commit: BranchCommit;
  readonly configuredAuthor: string | null;
  readonly age: string;
  readonly shaClassName: string;
  readonly isRemoved: boolean;
  readonly isNew: boolean;
  readonly canShowUnpushed: boolean;
  readonly view: HistoryRowView;
};

export const HistoryCommitMetadata = ({
  commit,
  configuredAuthor,
  age,
  shaClassName,
  isRemoved,
  isNew,
  canShowUnpushed,
  view,
}: Props) => (
  <span
    className={cn(
      'flex shrink-0 items-center gap-2 whitespace-nowrap text-meta text-faint-foreground',
      isRemoved && 'opacity-70',
    )}
  >
    {commit.author === configuredAuthor ? null : (
      <Tooltip content={commit.author}>
        <span
          role="img"
          aria-label={commit.author}
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-elevated text-chip text-muted-foreground"
        >
          {commit.author
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')}
        </span>
      </Tooltip>
    )}
    <span
      className={cn(
        'shrink-0 tabular-nums',
        shaClassName,
        isNew ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {commit.shortSha}
    </span>
    <span className="shrink-0">{age}</span>
    {!commit.pushed && canShowUnpushed && view !== 'done' ? (
      <span className="shrink-0 text-faint-foreground">Not pushed</span>
    ) : null}
  </span>
);
