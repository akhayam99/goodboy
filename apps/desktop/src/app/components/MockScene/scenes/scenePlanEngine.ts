import type {
  ArtifactComment,
  IsoDateTime,
  PlanWithCount,
  ProviderRunId,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type {
  AddArtifactCommentParams,
  EditArtifactCommentParams,
  RemoveArtifactCommentParams,
  SendArtifactCommentsParams,
  SendArtifactCommentsResult,
} from '../../../../store/slices/artifact-comments/types';

const REVISE_MS = 1_400;

type Options = {
  readonly sessionId: SessionId;
  readonly isSaveConflict?: boolean;
  readonly isReplyOnly?: boolean;
  readonly reviseMs?: number;
};

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

const wait = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const commentsOf = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): ReadonlyArray<ArtifactComment> => useAppStore.getState().artifactComments[sessionId] ?? [];

const putComments = ({
  sessionId,
  update,
}: {
  readonly sessionId: SessionId;
  readonly update: (comments: ReadonlyArray<ArtifactComment>) => ReadonlyArray<ArtifactComment>;
}): void => {
  useAppStore.setState((state) => ({
    artifactComments: {
      ...state.artifactComments,
      [sessionId]: update(state.artifactComments[sessionId] ?? []),
    },
  }));
};

const storedOf = ({
  sessionId,
  planId,
}: {
  readonly sessionId: SessionId;
  readonly planId: string;
}): SessionArtifact | undefined =>
  (useAppStore.getState().sessionArtifacts[sessionId] ?? []).find(
    (artifact) => artifact.id === planId,
  );

const landRevision = ({
  sessionId,
  plan,
  title,
  bodyMd,
}: {
  readonly sessionId: SessionId;
  readonly plan: PlanWithCount;
  readonly title: string;
  readonly bodyMd: string;
}): number => {
  const revision = (storedOf({ sessionId, planId: plan.id })?.revision ?? 1) + 1;
  useAppStore.setState((state) => ({
    sessionPlans: {
      ...state.sessionPlans,
      [sessionId]: (state.sessionPlans[sessionId] ?? []).map((candidate) =>
        candidate.id === plan.id ? { ...candidate, title, bodyMd, updatedAt: nowIso() } : candidate,
      ),
    },
    sessionArtifacts: {
      ...state.sessionArtifacts,
      [sessionId]: (state.sessionArtifacts[sessionId] ?? []).map((artifact) =>
        artifact.id === plan.id
          ? { ...artifact, title, sourceText: bodyMd, revision, updatedAt: nowIso() }
          : artifact,
      ),
    },
  }));
  return revision;
};

const settleTurn = ({
  planId,
  agentId,
}: {
  readonly planId: string;
  readonly agentId: PlanWithCount['agentId'];
}): void => {
  useAppStore.setState((state) => {
    const sends = { ...state.artifactCommentSends };
    delete sends[planId as keyof typeof sends];
    return {
      artifactCommentSends: sends,
      agentTurnState: {
        ...state.agentTurnState,
        [agentId]: { kind: 'idle' as const, lastActivityAt: nowIso() },
      },
    };
  });
};

const revisedBodyOf = ({
  bodyMd,
  count,
}: {
  readonly bodyMd: string;
  readonly count: number;
}): string =>
  `${bodyMd}\n\n## Changes in this version\nThe planner answered ${count} ${count === 1 ? 'comment' : 'comments'}.`;

export const installScenePlanEngine = ({
  sessionId,
  isSaveConflict = false,
  isReplyOnly = false,
  reviseMs = REVISE_MS,
}: Options): void => {
  let turns = 0;

  const addArtifactComment = async ({
    artifactId,
    revision,
    anchor,
    body,
  }: AddArtifactCommentParams): Promise<string | null> => {
    const text = body.trim();
    if (text.length === 0) {
      return null;
    }
    const id = `scene-comment-${commentsOf({ sessionId }).length + 1}-${Date.now()}`;
    const at = nowIso();
    putComments({
      sessionId,
      update: (comments) => [
        ...comments,
        {
          id,
          sessionId,
          artifactId,
          revision,
          anchor,
          body: text,
          status: 'draft',
          sentTurnId: null,
          createdAt: at,
          updatedAt: at,
        },
      ],
    });
    return id;
  };

  const editArtifactComment = async ({
    commentId,
    body,
  }: EditArtifactCommentParams): Promise<boolean> => {
    const text = body.trim();
    if (text.length === 0) {
      return false;
    }
    putComments({
      sessionId,
      update: (comments) =>
        comments.map((comment) =>
          comment.id === commentId ? { ...comment, body: text, updatedAt: nowIso() } : comment,
        ),
    });
    return true;
  };

  const removeArtifactComment = async ({
    commentId,
  }: RemoveArtifactCommentParams): Promise<boolean> => {
    const target = commentsOf({ sessionId }).find((comment) => comment.id === commentId);
    if (target === undefined || target.status !== 'draft') {
      return false;
    }
    putComments({
      sessionId,
      update: (comments) => comments.filter((comment) => comment.id !== commentId),
    });
    return true;
  };

  const sendArtifactComments = async ({
    plan,
  }: SendArtifactCommentsParams): Promise<SendArtifactCommentsResult> => {
    const drafts = commentsOf({ sessionId }).filter(
      (comment) => comment.artifactId === plan.id && comment.status === 'draft',
    );
    if (drafts.length === 0) {
      return { kind: 'empty' };
    }
    turns += 1;
    const ids = new Set(drafts.map((comment) => comment.id));
    putComments({
      sessionId,
      update: (comments) =>
        comments.map((comment) =>
          ids.has(comment.id) ? { ...comment, status: 'sent' as const } : comment,
        ),
    });
    useAppStore.setState((state) => ({
      artifactCommentSends: { ...state.artifactCommentSends, [plan.id]: true as const },
      agentTurnState: {
        ...state.agentTurnState,
        [plan.agentId]: {
          kind: 'running' as const,
          runId: `scene-revise-${turns}` as ProviderRunId,
          startedAt: nowIso(),
        },
      },
    }));
    await wait(reviseMs);
    if (isReplyOnly) {
      putComments({
        sessionId,
        update: (comments) =>
          comments.map((comment) =>
            ids.has(comment.id) ? { ...comment, status: 'open' as const } : comment,
          ),
      });
      settleTurn({ planId: plan.id, agentId: plan.agentId });
      return { kind: 'unchanged' };
    }
    const revision = landRevision({
      sessionId,
      plan,
      title: plan.title,
      bodyMd: revisedBodyOf({ bodyMd: plan.bodyMd, count: drafts.length }),
    });
    putComments({
      sessionId,
      update: (comments) =>
        comments.map((comment) =>
          ids.has(comment.id) ? { ...comment, status: 'addressed' as const } : comment,
        ),
    });
    settleTurn({ planId: plan.id, agentId: plan.agentId });
    return { kind: 'revised', revision, addressed: drafts.length, open: 0 };
  };

  const updatePlanBody = async (
    _sessionId: SessionId,
    planId: string,
    title: string,
    bodyMd: string,
    expectedRevision: number,
  ) => {
    const stored = storedOf({ sessionId, planId });
    const plan = (useAppStore.getState().sessionPlans[sessionId] ?? []).find(
      (candidate) => candidate.id === planId,
    );
    const current = stored?.revision ?? 1;
    if (plan === undefined || isSaveConflict || expectedRevision !== current) {
      return { kind: 'conflict' as const, revision: current + 1 };
    }
    return { kind: 'saved' as const, revision: landRevision({ sessionId, plan, title, bodyMd }) };
  };

  useAppStore.setState({
    loadArtifactComments: async () => undefined,
    addArtifactComment,
    editArtifactComment,
    removeArtifactComment,
    sendArtifactComments,
    updatePlanBody,
    orchestrateNextStep: async () => undefined,
    maybeAutoAdvanceWorkflow: async () => undefined,
    activateWorkflowAgent: async ({ onStarted }) => {
      onStarted?.();
    },
  });
};
