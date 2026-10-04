import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { MountId, ResolveThread, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { eligibleReviewThreads } from '../../../suggestions/eligibleThreads';
import { mountReviewGithub } from '../../../review/mountReviewGithub';
import type { DiffThread } from '../../components/DiffView/types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

const EMPTY_ROWS: ReadonlyArray<ResolveThread> = [];
const NO_THREADS: ReadonlyArray<DiffThread> = [];

export const REVIEW_MARKER_LABEL = 'To resolve';

export const useDiffReviewThreads = ({ sessionId, mountId }: Params): ReadonlyArray<DiffThread> => {
  const github = useAppStore((s) =>
    mountId === null ? null : mountReviewGithub({ state: s, sessionId, mountId }),
  );
  const rows = useAppStore((s) => s.sessionResolveThreads[sessionId] ?? EMPTY_ROWS);
  const openReviewTarget = useAppStore((s) => s.openReviewTarget);

  return useMemo(() => {
    const prNumber = github?.pr?.number ?? null;
    if (prNumber === null) {
      return NO_THREADS;
    }
    return eligibleReviewThreads({ github, rows }).flatMap((thread): ReadonlyArray<DiffThread> => {
      const { head } = thread;
      const threadId = head.threadId;
      if (
        threadId == null ||
        head.outdated === true ||
        head.path === undefined ||
        head.line === undefined
      ) {
        return [];
      }
      return [
        {
          id: `review:${threadId}`,
          filePath: head.path,
          anchor: { side: 'new', lineNumber: head.line },
          body: head.body,
          tone: 'warning',
          author: head.author,
          isAgent: false,
          createdAt: head.createdAt as DiffThread['createdAt'],
          statusLabel: REVIEW_MARKER_LABEL,
          isResolved: false,
          canEdit: false,
          canClose: false,
          canReopen: false,
          canDelete: false,
          footer: (
            <button
              type="button"
              onClick={() =>
                void openReviewTarget({
                  sessionId,
                  destination: { kind: 'thread', mountId, prNumber, threadId },
                })
              }
              className="inline-flex w-fit items-center gap-0.5 rounded-sm text-meta text-muted-foreground hover:text-foreground"
            >
              Open in Review
              <ArrowUpRight size={10} aria-hidden />
            </button>
          ),
        },
      ];
    });
  }, [github, mountId, openReviewTarget, rows, sessionId]);
};
