import { useMemo } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { IconButton, cn } from '@goodboy/ui';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { ResolveAttempt, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../store';
import { formatDuration } from '../../../shared/utils/time/formatDuration';
import { useActionEnv } from '../../actions/useActionEnv';
import { useObjectActions } from '../../actions/useObjectActions';
import { modelLabel } from '../../chat/utils/chat-constants';
import { conversationSha } from '../../resolve/conversationAgentResult';
import type { ReviewEntry } from '../../resolve/components/ReviewFlow/useReviewEntries';
import { STATE_WORD_TONE } from '../../resolve/components/ReviewFlow/stateTone';
import { ThreadPropertyRow } from './ThreadPropertyRow';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly layout: 'rail' | 'inline';
};

const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];

const QUIET_LINK =
  'w-fit rounded-sm text-meta text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

const originLabelOf = ({ entry }: { readonly entry: ReviewEntry }): string => {
  const kind = entry.row.thread.sourceKind ?? 'github';
  return kind === 'local' ? 'Local' : REVIEW_SOURCE_LABEL[kind];
};

const attemptLine = ({
  attempt,
  number,
}: {
  readonly attempt: ResolveAttempt;
  readonly number: number;
}): string => {
  const duration =
    attempt.startedAt !== null && attempt.endedAt !== null
      ? formatDuration({ durationMs: attempt.endedAt - attempt.startedAt })
      : null;
  return [`${number}`, modelLabel(attempt.model), ...(duration === null ? [] : [duration])].join(
    ' · ',
  );
};

export const ThreadProperties = ({ sessionId, entry, layout }: Props) => {
  const { threadId, row, word, state } = entry;
  const target = useMemo(
    () => ({ kind: 'reviewComment' as const, sessionId, threadId }),
    [sessionId, threadId],
  );
  const env = useActionEnv({ origin: 'button' });
  const { actions, run } = useObjectActions({ target, env });
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS);
  const threadAttempts = useMemo(
    () =>
      attempts
        .filter((attempt) => attempt.threadIds.includes(threadId))
        .sort((left, right) => left.createdAt - right.createdAt),
    [attempts, threadId],
  );
  const navigate = useAppStore((s) => s.navigate);
  const latestAttempt = threadAttempts.at(-1) ?? null;
  const sha = conversationSha({ row });
  const has = (id: string): boolean => actions.some((action) => action.id === id);
  const origin = originLabelOf({ entry });
  const isRail = layout === 'rail';
  const hasTranscript = has('reviewComment.transcript');
  const resolveWithoutReply = actions.find(
    (action) => action.id === 'reviewComment.resolveNoReply',
  );
  return (
    <div
      role="group"
      aria-label="Comment properties"
      className={cn(
        'flex min-w-0',
        isRail ? 'flex-col gap-4' : 'flex-wrap items-baseline gap-x-4 gap-y-1',
      )}
    >
      <ThreadPropertyRow label="State" layout={layout}>
        <span className={STATE_WORD_TONE[state]}>{word}</span>
      </ThreadPropertyRow>
      <ThreadPropertyRow label="Origin" layout={layout}>
        <span className="inline-flex items-center gap-1">
          {origin}
          {has('reviewComment.openOnGithub') && (
            <IconButton
              icon={ExternalLink}
              label="Open on the code host"
              variant="ghost"
              onClick={() => void run({ actionId: 'reviewComment.openOnGithub' })}
            />
          )}
          {has('reviewComment.copyLink') && (
            <IconButton
              icon={Copy}
              label="Copy link"
              variant="ghost"
              onClick={() => void run({ actionId: 'reviewComment.copyLink' })}
            />
          )}
        </span>
      </ThreadPropertyRow>
      {threadAttempts.length > 0 && (
        <ThreadPropertyRow label="Attempts" layout={layout}>
          {isRail ? (
            <ul className="flex min-w-0 flex-col gap-0.5">
              {[...threadAttempts].reverse().map((attempt, index) => (
                <li key={attempt.id} className="min-w-0 list-none truncate text-muted-foreground">
                  {index === 0 && hasTranscript ? (
                    <button
                      type="button"
                      onClick={() => void run({ actionId: 'reviewComment.transcript' })}
                      className="max-w-full truncate rounded-sm text-left text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      {attemptLine({ attempt, number: threadAttempts.length - index })}
                    </button>
                  ) : (
                    attemptLine({ attempt, number: threadAttempts.length - index })
                  )}
                </li>
              ))}
            </ul>
          ) : (
            threadAttempts.length
          )}
        </ThreadPropertyRow>
      )}
      {sha !== null && (
        <ThreadPropertyRow label="Fix" layout={layout}>
          <span className="font-mono">{sha.slice(0, 7)}</span>
        </ThreadPropertyRow>
      )}
      {isRail && row.reviewerNote?.author != null && (
        <ThreadPropertyRow label="Author" layout={layout}>
          {row.reviewerNote.author}
        </ThreadPropertyRow>
      )}
      {latestAttempt !== null && (
        <button
          type="button"
          onClick={() =>
            navigate({ to: agentPlace({ sessionId, agentId: latestAttempt.agentId }) })
          }
          className={QUIET_LINK}
        >
          Open fix run
        </button>
      )}
      {resolveWithoutReply !== undefined && (
        <button
          type="button"
          onClick={() => void run({ actionId: resolveWithoutReply.id })}
          className={QUIET_LINK}
        >
          {resolveWithoutReply.label}
        </button>
      )}
      {has('reviewComment.stop') && (
        <button
          type="button"
          onClick={() => void run({ actionId: 'reviewComment.stop' })}
          className={QUIET_LINK}
        >
          Stop
        </button>
      )}
    </div>
  );
};
