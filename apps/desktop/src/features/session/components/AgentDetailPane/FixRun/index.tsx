import { useEffect } from 'react';
import { Band, Button, Chip, Markdown } from '@goodboy/ui';
import type { Agent, Session, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../../store';
import { branchPlace } from '../../../../../store/slices/navigation/place';
import { STATE_CHIP_TONE } from '../../../../resolve/components/ReviewFlow/stateTone';
import {
  useReviewEntries,
  type ReviewEntry,
} from '../../../../resolve/components/ReviewFlow/useReviewEntries';
import type { ResolverBrief } from '../../../../resolve/hooks/useResolverBrief';
import { ResolverCommitLine } from '../../../../resolve/ResolverCommitLine';
import { FIX_RUN_COPY } from '../../../../resolve/reviewFlowCopy';
import { threadFixSha } from '../../../../resolve/threadFixSha';
import { threadLocationOf } from '../../../../resolve/threadLocationOf';
import { openReview } from '../../../../review/openReview';
import { useAgentOutcome } from '../../../hooks/useAgentOutcome';

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

export const FixRun = ({ session, agent, brief }: Props) => {
  const sessionId = session.id as SessionId;
  const navigate = useAppStore((state) => state.navigate);
  const loadResolveSession = useAppStore((state) => state.loadResolveSession);
  const isLoaded = useAppStore((state) => state.sessionResolveQueueItems[sessionId] !== undefined);
  const { entries } = useReviewEntries({ sessionId, isSourceScoped: false });
  const outcome = useAgentOutcome({ agent });
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
    return commit.sha === null ? [] : [{ ...commit, sha: commit.sha, threadId: entry.threadId }];
  });
  const uniqueCommits = commits.filter(
    (commit, index) => commits.findIndex((other) => other.sha === commit.sha) === index,
  );
  const batchTotal = brief.batchThreadIds.length;

  useEffect(() => {
    void loadResolveSession({ sessionId });
  }, [loadResolveSession, sessionId]);

  const openThread = (threadId: string): void =>
    navigate({ to: branchPlace({ sessionId, tab: 'comments', threadId }) });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {outcome.text !== '' && (
        <Band inset="content" label={FIX_RUN_COPY.didHeading} headingLevel={2}>
          <div className="max-w-[72ch] text-body text-foreground">
            <Markdown text={outcome.text} />
          </div>
          {outcome.isFromReply && (
            <span className="text-meta text-muted-foreground">{FIX_RUN_COPY.fromReply}</span>
          )}
        </Band>
      )}
      <Band inset="content" label={FIX_RUN_COPY.commitsHeading} headingLevel={2}>
        {uniqueCommits.length === 0 ? (
          <p className="text-body text-muted-foreground">
            {isLoaded ? FIX_RUN_COPY.noCommit : FIX_RUN_COPY.loading}
          </p>
        ) : (
          uniqueCommits.map((commit) => (
            <div key={commit.sha} className="flex min-w-0 flex-col gap-0.5">
              <ResolverCommitLine
                sessionId={sessionId}
                mountId={mountId}
                sha={commit.sha}
                isFolded={commit.landedAs !== null}
              />
              {commit.landedAs !== null && (
                <p className="text-meta text-muted-foreground">
                  {FIX_RUN_COPY.foldedInto({ sha: commit.landedAs })}
                </p>
              )}
            </div>
          ))
        )}
      </Band>
      <Band inset="content" label={FIX_RUN_COPY.threadsHeading} headingLevel={2}>
        <ul className="flex min-w-0 flex-col">
          {touched.map(({ threadId, entry }) => (
            <li key={threadId} className="list-none">
              {entry === null ? (
                <p className="py-1 text-body text-muted-foreground">{FIX_RUN_COPY.gone}</p>
              ) : (
                <button type="button" className={ROW_CLASS} onClick={() => openThread(threadId)}>
                  <Chip
                    tone={STATE_CHIP_TONE[entry.state]}
                    size="3xs"
                    bordered={false}
                    label={entry.word}
                    className="shrink-0"
                  />
                  <span className="min-w-0 truncate text-foreground">
                    {threadLocationOf({ row: entry.row })?.label ?? FIX_RUN_COPY.comment}
                  </span>
                  {entry.row.reviewerNote?.author != null && (
                    <span className="shrink-0 text-meta text-muted-foreground">
                      {entry.row.reviewerNote.author}
                    </span>
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
        {batchTotal > touched.length && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-meta text-muted-foreground">
            <span>{FIX_RUN_COPY.batch({ others: batchTotal - touched.length })}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void openReview({
                  sessionId,
                  destination: { kind: 'threads', mountId, threadIds: brief.batchThreadIds },
                })
              }
            >
              {FIX_RUN_COPY.openBatch}
            </Button>
          </div>
        )}
      </Band>
      <div className="flex min-w-0 items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            navigate({ to: agentPlace({ sessionId, agentId: agent.id, pane: 'transcript' }) })
          }
        >
          {FIX_RUN_COPY.openTranscript}
        </Button>
      </div>
    </div>
  );
};
