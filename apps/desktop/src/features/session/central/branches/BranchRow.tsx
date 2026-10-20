import { ChevronRight } from 'lucide-react';
import { ICON_SIZE, ROW_INTERACTIVE, Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { branchPlace, useAppStore } from '../../../../store';
import { BranchTrack } from './BranchTrack';
import { branchSentenceOf, type BranchEntry, type BranchTone } from './branchStoryOf';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: BranchEntry;
};

const WORD_TEXT: Record<BranchTone, string> = {
  neutral: 'text-foreground',
  info: 'text-info',
  warning: 'text-warning',
  danger: 'text-danger',
  success: 'text-success',
};

export const BranchRow = ({ sessionId, entry }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const { fact, story, hasCard } = entry;
  const request = fact.request === null ? '' : ` · ${fact.request.noun}${fact.request.number}`;
  return (
    <button
      type="button"
      aria-label={branchSentenceOf({ fact, story, hasCard })}
      data-branch-row=""
      data-branch-rank={story.rank}
      onClick={() =>
        navigate({ to: branchPlace({ sessionId, mountPath: fact.mountPath, tab: 'pr' }) })
      }
      className={cn(
        'flex h-9 w-full min-w-0 items-center gap-2 rounded-md px-1 text-left text-label',
        ROW_INTERACTIVE,
      )}
    >
      <Tooltip content={fact.branch}>
        <span className="min-w-0 flex-[5_1_0%] truncate text-code text-foreground">
          {fact.branch}
        </span>
      </Tooltip>
      <span className="hidden min-w-0 flex-[2_1_0%] truncate text-muted-foreground @2xl:block">
        {`${fact.projectName}${request}`}
      </span>
      <BranchTrack steps={story.steps} tone={story.tone} />
      <span className={cn('w-28 shrink-0 truncate', WORD_TEXT[story.tone])}>{story.word}</span>
      <Tooltip content={story.blocker}>
        <span className="min-w-0 flex-[3_1_0%] truncate text-muted-foreground">
          {story.blocker}
        </span>
      </Tooltip>
      <span className="flex w-14 shrink-0 justify-end">
        {hasCard ? (
          <span className="whitespace-nowrap rounded-full bg-muted px-2 text-meta text-muted-foreground">
            in Next
          </span>
        ) : null}
      </span>
      <ChevronRight size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
    </button>
  );
};
