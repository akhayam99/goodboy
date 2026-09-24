import { Button, Skeleton } from '@goodboy/ui';
import type { IssueBriefSource } from '../../../../../store/slices/issue-briefs/types';
import { BriefHeader } from './BriefHeader';

type Props = {
  readonly source: IssueBriefSource;
  readonly onUseIssueText: () => void;
  readonly onDismiss: () => void;
};

const readingLabel = ({ source }: Pick<Props, 'source'>): string => {
  const length = source.body.trim().length;
  if (length === 0) {
    return `Reading ${source.identifier}`;
  }
  return `Reading ${source.identifier}, ${length.toLocaleString('en-US')} characters`;
};

export const BriefLoading = ({ source, onUseIssueText, onDismiss }: Props) => (
  <>
    <BriefHeader
      source={source}
      label={`Brief from ${source.identifier}`}
      trailing={
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      }
    />
    <div
      role="status"
      aria-label={`Writing a brief for ${source.identifier}`}
      className="flex flex-col gap-1.5"
    >
      <Skeleton className="h-3.5 w-3/5 rounded-sm" />
      <Skeleton className="h-2.5 w-full rounded-sm" />
      <Skeleton className="h-2.5 w-11/12 rounded-sm" />
      <Skeleton className="h-2.5 w-1/2 rounded-sm" />
    </div>
    <footer className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-2xs text-shimmer">
        {readingLabel({ source })}
      </span>
      <Button variant="ghost" size="sm" onClick={onUseIssueText}>
        Use issue text
      </Button>
    </footer>
  </>
);
