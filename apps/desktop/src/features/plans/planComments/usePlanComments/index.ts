import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Agent,
  ArtifactComment,
  ArtifactCommentAnchor,
  PlanWithCount,
  SessionId,
  WorkflowRun,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import type { SendArtifactCommentsResult } from '../../../../store/slices/artifact-comments/types';
import { planCommentGuard, type PlanCommentGuard } from '../planCommentGuard';
import type { ComposingTarget, PlanCommentsApi } from '../planCommentsContext';

const NO_COMMENTS: ReadonlyArray<ArtifactComment> = [];
const NO_AGENTS: ReadonlyArray<Agent> = [];
const NO_RUNS: ReadonlyArray<WorkflowRun> = [];

type Params = {
  readonly sessionId: SessionId;
  readonly plan: PlanWithCount;
};

export type PlanCommentsModel = Readonly<{
  api: PlanCommentsApi;
  drafts: ReadonlyArray<ArtifactComment>;
  guard: PlanCommentGuard;
  isSending: boolean;
  run: WorkflowRun | null;
  sendError: string | null;
  send: () => Promise<SendArtifactCommentsResult>;
}>;

const failureOf = ({ result }: { readonly result: SendArtifactCommentsResult }): string | null =>
  result.kind === 'failed' || result.kind === 'blocked' ? result.reason : null;

export const usePlanComments = ({ sessionId, plan }: Params): PlanCommentsModel => {
  const all = useAppStore((state) => state.artifactComments[sessionId]) ?? NO_COMMENTS;
  const isSending = useAppStore((state) => state.artifactCommentSends[plan.id] !== undefined);
  const revision = useAppStore(
    (state) =>
      state.sessionArtifacts[sessionId]?.find((artifact) => artifact.id === plan.id)?.revision ?? 1,
  );
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId]) ?? NO_AGENTS;
  const runs =
    useAppStore((state) => sessionById(state.sessions, sessionId)?.workflowRuns) ?? NO_RUNS;
  const loadArtifactComments = useAppStore((state) => state.loadArtifactComments);
  const addArtifactComment = useAppStore((state) => state.addArtifactComment);
  const editArtifactComment = useAppStore((state) => state.editArtifactComment);
  const removeArtifactComment = useAppStore((state) => state.removeArtifactComment);
  const sendArtifactComments = useAppStore((state) => state.sendArtifactComments);
  const [composing, setComposing] = useState<ComposingTarget | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    void loadArtifactComments({ sessionId });
  }, [loadArtifactComments, sessionId]);

  const comments = useMemo(
    () => all.filter((comment) => comment.artifactId === plan.id),
    [all, plan.id],
  );
  const drafts = useMemo(
    () => comments.filter((comment) => comment.status === 'draft'),
    [comments],
  );
  const guard = useMemo(() => planCommentGuard({ plan, agents, runs }), [plan, agents, runs]);
  const planner = useMemo(
    () => agents.find((agent) => agent.id === plan.agentId) ?? null,
    [agents, plan.agentId],
  );
  const run = useMemo(
    () => runs.find((candidate) => candidate.id === planner?.workflowRunId) ?? null,
    [runs, planner],
  );

  const startComposing = useCallback(
    ({ anchor }: { readonly anchor: ArtifactCommentAnchor }) => setComposing({ anchor }),
    [],
  );
  const cancelComposing = useCallback(() => setComposing(null), []);
  const add = useCallback(
    async ({ body }: { readonly body: string }) => {
      if (composing === null) {
        return;
      }
      await addArtifactComment({
        sessionId,
        artifactId: plan.id,
        revision,
        anchor: composing.anchor,
        body,
      });
      setComposing(null);
    },
    [addArtifactComment, composing, plan.id, revision, sessionId],
  );
  const edit = useCallback(
    async ({ commentId, body }: { readonly commentId: string; readonly body: string }) => {
      await editArtifactComment({ sessionId, commentId, body });
    },
    [editArtifactComment, sessionId],
  );
  const remove = useCallback(
    async ({ commentId }: { readonly commentId: string }) => {
      await removeArtifactComment({ sessionId, commentId });
    },
    [removeArtifactComment, sessionId],
  );
  const send = useCallback(async () => {
    setSendError(null);
    const result = await sendArtifactComments({ sessionId, plan });
    setSendError(failureOf({ result }));
    return result;
  }, [plan, sendArtifactComments, sessionId]);

  const canComment = !isSending && plan.status !== 'discarded';
  const api = useMemo<PlanCommentsApi>(
    () => ({
      comments,
      revision,
      canComment,
      composing,
      startComposing,
      cancelComposing,
      add,
      edit,
      remove,
    }),
    [add, canComment, cancelComposing, comments, composing, edit, remove, revision, startComposing],
  );

  return { api, drafts, guard, isSending, run, sendError, send };
};
