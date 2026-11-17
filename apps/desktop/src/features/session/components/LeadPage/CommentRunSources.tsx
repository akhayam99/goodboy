import { useMemo } from 'react';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core/review-source';
import type { Agent, DiffComment, PrComment, SessionId, SessionMountView } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { activeReviewSourceOf } from '../../../../store/slices/review-source/activeReviewSource';
import { COMMENT_RUN_COPY } from '../../../resolve/commentRunCopy';
import { commentRunHeadsOf } from '../../../resolve/commentRunHeadsOf';
import { openReviewComment } from '../../../resolve/openReviewComment';
import { agentThreadIds } from '../../agentThreadIds';
import { CommentRunSourceCard } from './CommentRunSourceCard';

type Props = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
};

const NO_NOTES: ReadonlyArray<DiffComment> = [];

const NO_COMMENTS: ReadonlyArray<PrComment> = [];

const NO_MOUNTS: ReadonlyArray<SessionMountView> = [];

export const CommentRunSources = ({ sessionId, agent }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const notes = useAppStore((state) => state.diffComments[sessionId] ?? NO_NOTES);
  const comments = useAppStore((state) => {
    const loaded = activeReviewSourceOf({ state, sessionId })?.comments ?? NO_COMMENTS;
    return loaded.length === 0 ? NO_COMMENTS : loaded;
  });
  const hostKind = useAppStore(
    (state) => activeReviewSourceOf({ state, sessionId })?.kind ?? 'github',
  );
  const mountPath = useAppStore(
    (state) =>
      (state.sessionMounts[sessionId] ?? NO_MOUNTS).find((mount) => mount.id === agent.mountId)
        ?.worktreePath ?? null,
  );
  const sources = useMemo(
    () => commentRunHeadsOf({ threadIds: agentThreadIds(agent), notes, comments }),
    [agent, comments, notes],
  );
  if (agent.sourceKind !== 'comment_run' || sources.length === 0) {
    return null;
  }
  const count = sources.length;
  const hostLabel = REVIEW_SOURCE_LABEL[hostKind];
  return (
    <section
      aria-label={COMMENT_RUN_COPY.fromComments({ count })}
      data-comment-run-sources={agent.id}
      className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle px-4 py-3"
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="shrink-0 text-row text-foreground">
          {COMMENT_RUN_COPY.fromComments({ count })}
        </h2>
        <span className="min-w-0 truncate text-meta text-muted-foreground">
          {COMMENT_RUN_COPY.quotedWord({ count })}
        </span>
      </div>
      <ul className="flex min-w-0 flex-col gap-2">
        {sources.map((source) => (
          <CommentRunSourceCard
            key={source.threadId}
            source={source}
            hostLabel={hostLabel}
            onOpen={() =>
              openReviewComment({ navigate, sessionId, threadId: source.threadId, mountPath })
            }
          />
        ))}
      </ul>
    </section>
  );
};
