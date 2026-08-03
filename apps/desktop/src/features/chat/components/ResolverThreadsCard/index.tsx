import { useMemo, useState } from 'react';
import {
  extractAllCommentAnalysis,
  extractAllCommentResolved,
  extractAllCommentWontfix,
  isReviewThreadId,
} from '@goodboy/core';
import type { AgentId, PrComment, PendingResolution, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { resolverTallySentence } from '../../../session/resolverTallySentence';
import { resolverThreadTally } from '../../../session/resolverThreadTally';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { ResolverThreadVerdictRow } from './ResolverThreadVerdictRow';
import { resolverThreadVerdicts, type ResolverThreadVerdict } from './resolverThreadVerdicts';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly agentId?: AgentId | null;
};

const EMPTY_COMMENTS: ReadonlyArray<PrComment> = [];
const EMPTY_PENDING: ReadonlyArray<PendingResolution> = [];

const Icon = CONCEPT_ICONS.resolve;

const tallySentence = ({
  verdicts,
}: {
  readonly verdicts: ReadonlyArray<ResolverThreadVerdict>;
}): string | null =>
  resolverTallySentence({
    tally: resolverThreadTally({
      settlements: verdicts.map(({ kind, isClosed }) => ({ kind, isClosed })),
    }),
  });

export const ResolverThreadsCard = ({ assistantText, sessionId, agentId = null }: Props) => {
  const analysisMarkers = useMemo(
    () =>
      extractAllCommentAnalysis(assistantText).filter((marker) =>
        isReviewThreadId(marker.threadId),
      ),
    [assistantText],
  );
  const resolvedMarkers = useMemo(
    () =>
      extractAllCommentResolved(assistantText).filter((marker) =>
        isReviewThreadId(marker.threadId),
      ),
    [assistantText],
  );
  const wontfixMarkers = useMemo(
    () =>
      extractAllCommentWontfix(assistantText).filter((marker) => isReviewThreadId(marker.threadId)),
    [assistantText],
  );

  const githubComments = useAppStore(
    (state) => state.sessionGithub[sessionId]?.detail?.comments ?? EMPTY_COMMENTS,
  );
  const pendingResolutions = useAppStore(
    (state) => state.sessionPendingResolutions[sessionId] ?? EMPTY_PENDING,
  );
  const selectAgent = useAppStore((state) => state.selectAgent);

  const resolvedOnGithub = useMemo(
    () =>
      new Set(
        githubComments
          .filter((comment) => comment.resolved === true && comment.threadId != null)
          .map((comment) => comment.threadId as string),
      ),
    [githubComments],
  );
  const queuedThreadIds = useMemo(
    () => new Set(pendingResolutions.map((resolution) => resolution.threadId)),
    [pendingResolutions],
  );

  const verdicts = useMemo(
    () =>
      resolverThreadVerdicts({
        analysisMarkers,
        resolvedMarkers,
        wontfixMarkers,
        resolvedOnGithub,
        queuedThreadIds,
      }),
    [analysisMarkers, resolvedMarkers, wontfixMarkers, resolvedOnGithub, queuedThreadIds],
  );

  const [open, setOpen] = useState(false);

  const onOpen =
    agentId === null
      ? null
      : () => {
          void selectAgent(sessionId, agentId);
          window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
          window.dispatchEvent(
            new CustomEvent('goodboy:open-resolver-inspector', {
              detail: { sessionId, agentId },
            }),
          );
        };

  const [onlyVerdict] = verdicts;

  if (onlyVerdict === undefined) {
    return null;
  }

  if (verdicts.length === 1) {
    return (
      <ResolverThreadVerdictRow
        verdict={onlyVerdict}
        position={1}
        nested={false}
        onOpen={onOpen}
        data-testid="resolver-thread-verdict"
      />
    );
  }

  return (
    <TranscriptDisclosure
      tone="success"
      open={open}
      bodyClassName="gap-1"
      data-testid="resolver-threads-card"
      header={
        <TranscriptRowHeader
          grouped
          tone="success"
          icon={<Icon size={12} aria-hidden />}
          eyebrow="resolver findings"
          preview={tallySentence({ verdicts })}
          meta={`${verdicts.length}`}
          open={open}
          onToggle={() => setOpen((value) => !value)}
          aria-label={open ? 'collapse resolver findings' : 'expand resolver findings'}
        />
      }
    >
      <ul className="flex min-w-0 flex-col gap-1">
        {verdicts.map((verdict, index) => (
          <li key={`${verdict.kind}:${verdict.threadId}`}>
            <ResolverThreadVerdictRow
              verdict={verdict}
              position={index + 1}
              nested
              onOpen={onOpen}
              data-testid={`resolver-thread-verdict-${index}`}
            />
          </li>
        ))}
      </ul>
    </TranscriptDisclosure>
  );
};
