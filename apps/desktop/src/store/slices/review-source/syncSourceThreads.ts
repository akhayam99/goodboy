import { formatError } from '@goodboy/ui';
import type { PrComment, ProjectId, ResolveSourceKind, SessionId } from '@goodboy/types';
import type { ResolveUpdates } from '../resolve/types';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly kind: Extract<ResolveSourceKind, 'github' | 'gitlab'>;
  readonly prNumber: number;
  readonly projectId: ProjectId | null;
  readonly comments: ReadonlyArray<PrComment>;
};

export const syncSourceThreads = async ({
  get,
  sessionId,
  kind,
  prNumber,
  projectId,
  comments,
}: Params): Promise<void> => {
  await get().updateResolveThreads({
    sessionId,
    updates: ({ rows }) => {
      const updates: Array<ResolveUpdates[number]> = [];
      for (const thread of comments) {
        if (thread.resolved === undefined || thread.threadId === undefined) {
          continue;
        }
        const row = rows.find((item) => item.threadId === thread.threadId);
        if (
          row === undefined ||
          row.prNumber !== prNumber ||
          (row.projectId !== null && projectId !== null && row.projectId !== projectId) ||
          row.githubResolved === thread.resolved
        ) {
          continue;
        }
        updates.push({
          threadId: thread.threadId,
          revision: row.revision,
          patch: thread.resolved
            ? {
                state: 'closed',
                githubResolved: true,
                closedAt: Date.now(),
                closedSource: 'github',
              }
            : {
                githubResolved: false,
                ...(row.state === 'closed' && {
                  state: 'open',
                  closedAt: null,
                  closedSource: null,
                }),
              },
        });
      }
      return updates;
    },
  });
  try {
    await get().materializeReviewThreads({
      sessionId,
      prNumber,
      projectId,
      comments,
      sourceKind: kind,
    });
  } catch (error) {
    console.warn(`[review-threads] ${sessionId}: ${formatError(error)}`);
  }
};
