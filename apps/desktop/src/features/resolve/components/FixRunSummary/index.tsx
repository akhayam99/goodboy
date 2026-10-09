import { useEffect } from 'react';
import { Band, Markdown } from '@goodboy/ui';
import type { Agent, ResolveAttempt, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { fixRunTranscript } from '../../../../store/slices/navigation/place';
import { ResolverQuestionCard } from '../../ResolverQuestionCard';
import { useReviewEntries, type ReviewEntry } from '../ReviewFlow/useReviewEntries';
import type { ResolverBrief } from '../../hooks/useResolverBrief';
import { fixRunCommitsViewOf, fixRunStatusOf } from '../../fixRunStatus';
import { FIX_RUN_COPY } from '../../reviewFlowCopy';
import { threadFixSha } from '../../threadFixSha';
import { threadLocationOf } from '../../threadLocationOf';
import { useAgentOutcome } from '../../../../shared/hooks/useAgentOutcome';
import { FixRunCommits } from './FixRunCommits';
import { FixRunStatusLine } from './FixRunStatusLine';
import { FixRunThreads } from './FixRunThreads';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly brief: ResolverBrief;
};

const ROW_CLASS =
  'flex min-w-0 items-center gap-2 rounded-sm py-1 text-left text-body hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

const commitOf = ({ entry }: { readonly entry: ReviewEntry }) => ({
  sha: threadFixSha({
    commitShas: entry.row.thread.commitShas,
    integratedSha: entry.row.item.integratedSha,
  }),
  landedAs: entry.facts?.folded?.landedAs ?? null,
});

export const FixRunSummary = ({ session, agent, brief }: Props) => {
  const sessionId = session.id as SessionId;
  const navigate = useAppStore((state) => state.navigate);
  const loadResolveSession = useAppStore((state) => state.loadResolveSession);
  const isLoaded = useAppStore((state) => state.sessionResolveQueueItems[sessionId] !== undefined);
  const attempts = useAppStore(
    (state) =>
      state.sessionResolveAttempts?.[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<ResolveAttempt>),
  );
  const turnKind = useAppStore((state) => state.agentTurnState[agent.id]?.kind ?? null);
  const { entries } = useReviewEntries({ sessionId, scope: 'all' });
  const outcome = useAgentOutcome({ agent });
  const status = fixRunStatusOf({ attempts, agentId: agent.id, turnKind });
  const mountId = brief.attempt.mountTarget?.mountId ?? null;
  const touched = brief.ownThreadIds.map((threadId) => ({
    threadId,
    entry: entries.find((candidate) => candidate.threadId === threadId) ?? null,
  }));
  const commits = touched.flatMap(({ entry }) => {
    if (entry === null) {
      return [];
    }
    const commit = commitOf({ entry });
    return commit.sha === null ? [] : [{ ...commit, sha: commit.sha }];
  });
  const uniqueCommits = commits.filter(
    (commit, index) => commits.findIndex((other) => other.sha === commit.sha) === index,
  );

  useEffect(() => {
    void loadResolveSession({ sessionId });
  }, [loadResolveSession, sessionId]);

  const openThread = (threadId: string): void =>
    navigate(fixRunTranscript({ sessionId, agentId: agent.id, threadId }));

  const asking = entries.filter(
    (entry) => entry.state === 'needs' && brief.batchThreadIds.includes(entry.threadId),
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {status === 'ended' ? null : <FixRunStatusLine attempt={brief.attempt} status={status} />}
      {asking.map((entry) => (
        <div key={entry.threadId} className="flex min-w-0 flex-col gap-2">
          <button type="button" className={ROW_CLASS} onClick={() => openThread(entry.threadId)}>
            <span className="min-w-0 truncate text-foreground">
              {threadLocationOf({ row: entry.row })?.label ?? FIX_RUN_COPY.comment}
            </span>
            {entry.row.reviewerNote?.author != null && (
              <span className="shrink-0 text-meta text-muted-foreground">
                {entry.row.reviewerNote.author}
              </span>
            )}
          </button>
          <ResolverQuestionCard sessionId={sessionId} row={entry.row} />
        </div>
      ))}
      <FixRunThreads
        sessionId={sessionId}
        mountId={mountId}
        threads={touched}
        batchThreadIds={brief.batchThreadIds}
        onOpen={openThread}
      />
      {status === 'ended' && outcome.text !== '' && (
        <Band inset="content" label={FIX_RUN_COPY.didHeading} headingLevel={2}>
          <div className="max-w-[var(--measure)] text-body text-foreground">
            <Markdown text={outcome.text} />
          </div>
          {outcome.isFromReply && (
            <span className="text-meta text-muted-foreground">{FIX_RUN_COPY.fromReply}</span>
          )}
        </Band>
      )}
      <FixRunCommits
        sessionId={sessionId}
        mountId={mountId}
        view={fixRunCommitsViewOf({ commitCount: uniqueCommits.length, status, isLoaded })}
        commits={uniqueCommits}
      />
    </div>
  );
};
