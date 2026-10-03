import { useEffect, useMemo } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button, Notice } from '@goodboy/ui';
import type { Agent, Session, SessionId } from '@goodboy/types';
import { useAppStore, agentPlace } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PushBanner } from '../../../resolve/components/ReviewFlow/PushBanner';
import { ReviewComment } from '../../../resolve/components/ReviewFlow/ReviewComment';
import { useReviewEntries } from '../../../resolve/components/ReviewFlow/useReviewEntries';
import { useReviewPush } from '../../../resolve/components/ReviewFlow/useReviewPush';
import { useReviewCommentController } from '../../../resolve/hooks/useReviewCommentController';
import type { ResolverBrief } from '../../../resolve/hooks/useResolverBrief';
import { openReview } from '../../../review/openReview';
import { batchChildNotice, RESOLVER_BRIEF_COPY } from '../../../resolve/reviewFlowCopy';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly brief: ResolverBrief;
};

const NO_THREADS: ReadonlyArray<string> = [];
const PUSHABLE = new Set(['accepted', 'replied']);

export const AgentBriefResolver = ({ session, agent, brief }: Props) => {
  const sessionId = session.id as SessionId;
  const navigate = useAppStore((state) => state.navigate);
  const loadResolveSession = useAppStore((state) => state.loadResolveSession);
  const { entries } = useReviewEntries({ sessionId });
  const entry = entries.find((candidate) => candidate.threadId === brief.threadId) ?? null;
  const controller = useReviewCommentController({
    sessionId,
    entries,
    threadIds: brief.isBatch ? NO_THREADS : brief.ownThreadIds,
  });
  const pushIds = useMemo(() => [brief.threadId], [brief.threadId]);
  const push = useReviewPush({ sessionId, threadIds: pushIds });
  const isPushBusy = push.phase.kind === 'preparing' || push.phase.kind === 'pushing';

  useEffect(() => {
    void loadResolveSession({ sessionId });
  }, [loadResolveSession, sessionId]);

  if (entry === null) {
    return null;
  }

  const total = brief.batchThreadIds.length;
  const ordered = [
    brief.threadId,
    ...brief.batchThreadIds.filter((threadId) => threadId !== brief.threadId),
  ];

  const batchActions = (
    <Notice
      tone="info"
      placement="inline"
      title={batchChildNotice({ total })}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              void openReview({
                sessionId,
                destination: {
                  kind: 'threads',
                  mountId: brief.attempt.mountTarget?.mountId ?? null,
                  threadIds: ordered,
                },
              })
            }
          >
            {`${RESOLVER_BRIEF_COPY.openInReview} (${total})`}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              navigate({ to: agentPlace({ sessionId, agentId: agent.id, pane: 'transcript' }) })
            }
          >
            {RESOLVER_BRIEF_COPY.openTranscript}
          </Button>
        </div>
      }
    />
  );

  const pushNow = PUSHABLE.has(entry.state) ? (
    <Button
      size="sm"
      variant="primary"
      isBusy={isPushBusy}
      disabled={isPushBusy || push.phase.kind === 'confirm'}
      onClick={() => void push.arm({ isRetry: false })}
    >
      <ArrowUp size={ICON_SIZE.control} aria-hidden />
      {RESOLVER_BRIEF_COPY.pushNow}
    </Button>
  ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {brief.isBatch ? null : <PushBanner sessionId={sessionId} push={push} />}
      <ReviewComment
        sessionId={sessionId}
        entry={entry}
        entries={entries}
        {...controller.bind(entry.threadId)}
        onSelect={() => undefined}
        onTryAgain={() => void controller.retryRun(entry.threadId)}
        onRetryDelivery={() => void push.arm({ isRetry: true })}
        onSync={push.askSync}
        variant="brief"
        {...(brief.isBatch ? { actionsReplacement: batchActions } : { actionsPrefix: pushNow })}
      />
    </div>
  );
};
