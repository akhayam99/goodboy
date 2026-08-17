import { useMemo } from 'react';
import type { AgentId, PrComment, Session, SessionId } from '@goodboy/types';
import { Divider, LensEmptyState, SectionHeader } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore, useDiffComments } from '../../../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
import { ResolverAgentsLane } from '../../../ResolverAgentsLane';
import { useResolverIndex } from '../../../../hooks/useResolverIndex';
import { resolverLaneEntries } from '../../../ResolverAgentsLane/resolverLaneEntries';
import { openPrThreads } from './openPrThreads';
import { openDiffComments } from './openDiffComments';
import { PrCommentRow } from './PrCommentRow';
import { DiffCommentRow } from './DiffCommentRow';

type Props = {
  readonly session: Session;
  readonly meta: string | undefined;
  readonly inspectedResolverId: AgentId | null;
  readonly onInspectResolver: (agentId: AgentId | null) => void;
};

export const ResolvePane = ({ session, meta, inspectedResolverId, onInspectResolver }: Props) => {
  const sessionId = session.id as SessionId;
  const selectAgent = useAppStore((s) => s.selectAgent);
  const resolverIndex = useResolverIndex(sessionId);
  const entries = useMemo(
    () => resolverLaneEntries({ links: resolverIndex.links }),
    [resolverIndex.links],
  );
  const prNumber = useAppStore((s) => s.sessionGithub[sessionId]?.pr?.number ?? null);
  const prComments = useAppStore(
    (s) =>
      s.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const diffComments = useDiffComments(sessionId);
  const openReviewThreads = useMemo(
    () => openPrThreads({ comments: prComments, resolverIndex }),
    [prComments, resolverIndex],
  );
  const openDiffs = useMemo(() => openDiffComments({ comments: diffComments }), [diffComments]);
  const workingDir = useAppStore((s) => (s.sessionWorktrees[sessionId] ?? [])[0] ?? null);

  const onInspect = (agentId: AgentId) => {
    onInspectResolver(agentId);
    void selectAgent(sessionId, agentId);
  };

  const onOpenPrThread = (comment: PrComment) => {
    if (prNumber == null || comment.threadId == null) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent('goodboy:open-github-session', {
        detail: { sessionId, prNumber, threadId: comment.threadId },
      }),
    );
  };

  const onOpenDiffComment = () => {
    if (workingDir == null) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent('goodboy:open-diff-viewer', {
        detail: { sessionId, workingDir },
      }),
    );
  };

  return (
    <PaneShell
      title="Resolve"
      description="Resolvers, and the open comments a resolver could pick up."
      meta={meta}
    >
      <section aria-label="Active resolvers" className="flex flex-col gap-2">
        <SectionHeader
          label="Active"
          hint={
            entries.active.length === 0
              ? undefined
              : `${entries.active.length} resolver${entries.active.length === 1 ? '' : 's'} in flight`
          }
        />
        <ResolverAgentsLane
          session={session}
          mode="active"
          inspectedResolverId={inspectedResolverId}
          onInspectResolver={onInspect}
        />
        {entries.active.length === 0 && (
          <LensEmptyState
            tone={CONCEPT_TONE.resolve}
            icon={CONCEPT_ICONS.resolve}
            title="No active resolvers"
            description="Spawn one from an open comment below or from a diff selection."
          />
        )}
      </section>
      <Divider />
      <section aria-label="Finished resolvers" className="flex flex-col gap-2">
        <SectionHeader
          label="Finished"
          hint={entries.completed.length === 0 ? undefined : `${entries.completed.length} settled`}
        />
        <ResolverAgentsLane
          session={session}
          mode="finished"
          inspectedResolverId={inspectedResolverId}
          onInspectResolver={onInspect}
        />
        {entries.completed.length === 0 && (
          <LensEmptyState
            tone={CONCEPT_TONE.resolve}
            icon={CONCEPT_ICONS.resolve}
            title="Nothing settled yet"
            description="Resolved and closed-off resolvers land here for reference."
          />
        )}
      </section>
      <Divider />
      <section aria-label="Open review comments" className="flex flex-col gap-2">
        <SectionHeader
          label="Open review comments"
          hint={
            prNumber == null
              ? 'No pull request linked to this session'
              : openReviewThreads.length === 0
                ? undefined
                : `${openReviewThreads.length} unclaimed on PR #${prNumber}`
          }
        />
        {openReviewThreads.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {openReviewThreads.map((comment) => (
              <PrCommentRow
                key={comment.id}
                comment={comment}
                onOpen={() => onOpenPrThread(comment)}
              />
            ))}
          </ul>
        ) : (
          <LensEmptyState
            tone={CONCEPT_TONE.pr}
            icon={CONCEPT_ICONS.pr}
            title={prNumber == null ? 'No pull request' : 'Nothing to pick up'}
            description={
              prNumber == null
                ? 'A pull request has to be linked to this session before review comments show here.'
                : 'Every open review thread has a resolver on it.'
            }
          />
        )}
      </section>
      <Divider />
      <section aria-label="Open diff comments" className="flex flex-col gap-2">
        <SectionHeader
          label="Open diff comments"
          hint={openDiffs.length === 0 ? undefined : `${openDiffs.length} raised from the diff`}
        />
        {openDiffs.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {openDiffs.map((comment) => (
              <DiffCommentRow key={comment.id} comment={comment} onOpen={onOpenDiffComment} />
            ))}
          </ul>
        ) : (
          <LensEmptyState
            tone={CONCEPT_TONE.diff}
            icon={CONCEPT_ICONS.diff}
            title="No open diff notes"
            description="Notes raised inline on the diff show up here until a resolver picks them up."
          />
        )}
      </section>
    </PaneShell>
  );
};
