import { useEffect, useState } from 'react';
import { GitPullRequest } from 'lucide-react';
import { Button, EmptyLine, ROW_INTERACTIVE, Skeleton, cn, formatError } from '@goodboy/ui';
import type { PullRequestState, WorkspaceId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { reviewPullRequestLabel } from '../../../../shared/lib/startCopy';
import { ghViewPullRequest } from '../../../integrations/github/github';
import type { ParsedPullRequestUrl } from '../../../integrations/issueCode/parsePullRequestUrl';
import { usePullRequestReviewStart } from '../../../inbox/usePullRequestReviewStart';
import { useLaunchMount } from '../../../inbox/useLaunchMount';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly pasted: ParsedPullRequestUrl;
};

type Read =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly pr: PullRequestState }
  | { readonly status: 'missing' }
  | { readonly status: 'failed'; readonly message: string };

export const PastedPullRequest = ({ workspaceId, pasted }: Props) => {
  const [read, setRead] = useState<Read>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const mount = useLaunchMount({
    workspaceId,
    source: { provider: 'github', url: pasted.url, sentryProject: null },
  });
  const review = usePullRequestReviewStart({ workspaceId, mount });
  const identifier = `#${pasted.number}`;

  useEffect(() => {
    let isCurrent = true;
    setRead({ status: 'loading' });
    ghViewPullRequest({ repo: pasted.repo, number: pasted.number, workspaceId })
      .then((pr) => {
        if (isCurrent) {
          setRead(pr === null ? { status: 'missing' } : { status: 'ready', pr });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setRead({ status: 'failed', message: formatError(error) });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [attempt, pasted.number, pasted.repo, workspaceId]);

  return (
    <section aria-label="Pull request" className="flex flex-col gap-0.5">
      {read.status === 'loading' && (
        <div role="status" aria-label={`Looking up ${identifier}`} className="flex gap-2 px-2 py-2">
          <Skeleton className="size-4 shrink-0 rounded-sm" />
          <Skeleton className="h-3 w-40 shrink-0 rounded-sm" />
          <Skeleton className="h-3 min-w-0 flex-1 rounded-sm" />
        </div>
      )}
      {read.status === 'ready' && (
        <button
          type="button"
          disabled={review.isStarting}
          onClick={() => void review.start({ pr: read.pr })}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left',
            ROW_INTERACTIVE,
          )}
        >
          <GitPullRequest size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="shrink-0 text-row text-foreground">
            {reviewPullRequestLabel({ identifier })}
          </span>
          <span className="min-w-0 flex-1 truncate text-body text-muted-foreground">
            {read.pr.title}
          </span>
        </button>
      )}
      {read.status === 'missing' && (
        <EmptyLine className="px-2">
          {`${identifier} isn't in ${pasted.repo}, or your GitHub key can't see it.`}
        </EmptyLine>
      )}
      {read.status === 'failed' && (
        <EmptyLine
          className="px-2"
          action={
            <Button variant="ghost" size="sm" onClick={() => setAttempt((count) => count + 1)}>
              Retry
            </Button>
          }
        >
          {`Couldn't read ${identifier} from GitHub. ${read.message}`}
        </EmptyLine>
      )}
    </section>
  );
};
