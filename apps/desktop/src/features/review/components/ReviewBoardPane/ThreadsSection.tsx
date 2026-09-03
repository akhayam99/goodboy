import { useMemo } from 'react';
import type { AgentId, PrComment, Session, SessionId } from '@goodboy/types';
import { cn, Divider, LensEmptyState, PANE_RHYTHM, ScrollFade, SectionHeader } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore, useDiffComments } from '../../../../store';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { groupThreads } from '../../../github/comment-threads';
import { useResolverIndex } from '../../../session/hooks/useResolverIndex';
import { DiffCommentRow } from '../../../session/resolve/DiffCommentRow';
import { openDiffComments } from '../../../session/resolve/openDiffComments';
import { openPrThreads } from '../../../session/resolve/openPrThreads';
import { ResolveThreadsBoard } from '../../../session/resolve/ResolveThreadsBoard';
import { useResolveHubSpawns } from '../../../session/resolve/useResolveHubSpawns';

type Props = {
  readonly session: Session;
  readonly onOpenResolver: (agentId: AgentId) => void;
};

export const ThreadsSection = ({ session, onOpenResolver }: Props) => {
  const sessionId = session.id as SessionId;
  const prNumber = useAppStore((state) => state.sessionGithub[sessionId]?.pr?.number ?? null);
  const comments = useAppStore(
    (state) =>
      state.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const workingDir = useAppStore(
    (state) => (state.sessionWorktrees[sessionId] ?? EMPTY_ARRAY)[0] ?? null,
  );
  const diffComments = useDiffComments(sessionId);
  const resolverIndex = useResolverIndex(sessionId);
  const roleModels = useSessionRoleModels({ sessionId });
  const openHeads = useMemo(
    () => openPrThreads({ comments, resolverIndex }),
    [comments, resolverIndex],
  );
  const headIds = useMemo(() => new Set(openHeads.map((comment) => comment.id)), [openHeads]);
  const threads = useMemo(
    () => groupThreads(comments).filter((thread) => headIds.has(thread.head.id)),
    [comments, headIds],
  );
  const openDiffs = useMemo(() => openDiffComments({ comments: diffComments }), [diffComments]);
  const spawns = useResolveHubSpawns({ sessionId, onOpenResolver });
  const onOpenThread = (threadId: string) => {
    if (prNumber == null) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent('goodboy:open-github-session', {
        detail: { sessionId, prNumber, threadId },
      }),
    );
  };
  const onOpenDiffComment = () => {
    if (workingDir == null) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent('goodboy:open-diff-viewer', { detail: { sessionId, workingDir } }),
    );
  };

  return (
    <ScrollFade className="min-h-0 flex-1">
      <div className={cn(PANE_RHYTHM.stack, PANE_RHYTHM.body)}>
        <section aria-label="Open review threads" className="flex flex-col gap-2">
          <SectionHeader
            label="Open review threads"
            hint={threads.length === 0 ? undefined : `${threads.length} ready to resolve`}
          />
          {threads.length > 0 ? (
            <ResolveThreadsBoard
              threads={threads}
              resolverFor={spawns.resolverFor}
              onSpawnOne={spawns.onSpawnOne}
              onSpawnBatch={spawns.onSpawnBatch}
              onSpawnCombined={spawns.onSpawnCombined}
              onOpenResolver={onOpenResolver}
              onOpenThread={onOpenThread}
              roleModels={roleModels}
            />
          ) : (
            <LensEmptyState
              tone={CONCEPT_TONE.pr}
              icon={CONCEPT_ICONS.pr}
              title={prNumber == null ? 'No pull request' : 'Nothing to pick up'}
              description={
                prNumber == null
                  ? 'A pull request has to be linked to this session before review threads show here.'
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
      </div>
    </ScrollFade>
  );
};
