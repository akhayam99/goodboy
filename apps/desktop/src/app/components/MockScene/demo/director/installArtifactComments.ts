import type {
  ArtifactComment,
  ArtifactCommentStatus,
  ArtifactId,
  IsoDateTime,
  SessionId,
} from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import type { DirectorStore } from './directorTypes';
import { demoRuns } from './demoRunRegistry';

type Params = {
  readonly store: DirectorStore;
};

type PatchParams = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly patch: (comments: ReadonlyArray<ArtifactComment>) => ReadonlyArray<ArtifactComment>;
};

const patchComments = ({ store, sessionId, patch }: PatchParams): void => {
  store.setState((state) => ({
    artifactComments: {
      ...state.artifactComments,
      [sessionId]: patch(state.artifactComments[sessionId] ?? []),
    },
  }));
};

type StatusParams = {
  readonly ids: ReadonlySet<string>;
  readonly status: ArtifactCommentStatus;
  readonly at: IsoDateTime;
};

const withStatus =
  ({ ids, status, at }: StatusParams) =>
  (comments: ReadonlyArray<ArtifactComment>): ReadonlyArray<ArtifactComment> =>
    comments.map((comment) =>
      ids.has(comment.id) ? { ...comment, status, updatedAt: at } : comment,
    );

type SendingParams = {
  readonly store: DirectorStore;
  readonly artifactId: ArtifactId;
  readonly isSending: boolean;
};

const putSending = ({ store, artifactId, isSending }: SendingParams): void => {
  store.setState((state) => {
    const next = { ...state.artifactCommentSends };
    if (isSending) {
      return { artifactCommentSends: { ...next, [artifactId]: true as const } };
    }
    delete next[artifactId];
    return { artifactCommentSends: next };
  });
};

export const installArtifactComments = ({ store }: Params): void => {
  const addArtifactComment: AppStore['addArtifactComment'] = async ({
    sessionId,
    artifactId,
    revision,
    anchor,
    body,
  }) => {
    const text = body.trim();
    if (text.length === 0) {
      return null;
    }
    const id = crypto.randomUUID();
    const at = nowIso({});
    const comment: ArtifactComment = {
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
    };
    patchComments({ store, sessionId, patch: (comments) => [...comments, comment] });
    return id;
  };
  const editArtifactComment: AppStore['editArtifactComment'] = async ({
    sessionId,
    commentId,
    body,
  }) => {
    const at = nowIso({});
    patchComments({
      store,
      sessionId,
      patch: (comments) =>
        comments.map((comment) =>
          comment.id === commentId ? { ...comment, body: body.trim(), updatedAt: at } : comment,
        ),
    });
    return true;
  };
  const removeArtifactComment: AppStore['removeArtifactComment'] = async ({
    sessionId,
    commentId,
  }) => {
    patchComments({
      store,
      sessionId,
      patch: (comments) => comments.filter((comment) => comment.id !== commentId),
    });
    return true;
  };
  const sendArtifactComments: AppStore['sendArtifactComments'] = async ({ sessionId, plan }) => {
    if (store.getState().artifactCommentSends[plan.id] !== undefined) {
      return { kind: 'busy' };
    }
    const drafts = (store.getState().artifactComments[sessionId] ?? []).filter(
      (comment) => comment.artifactId === plan.id && comment.status === 'draft',
    );
    if (drafts.length === 0) {
      return { kind: 'empty' };
    }
    const ids = new Set(drafts.map((comment) => comment.id));
    putSending({ store, artifactId: plan.id, isSending: true });
    patchComments({ store, sessionId, patch: withStatus({ ids, status: 'sent', at: nowIso({}) }) });
    const content = drafts.map((comment) => comment.body).join('\n');
    const generation = demoRuns.generation();
    await store.getState().sendTurn({
      sessionId,
      agentId: plan.agentId,
      content,
      onSettled: ({ hasFailed, wasCancelled }) => {
        if (!demoRuns.isCurrent({ generation })) {
          return;
        }
        const isAddressed = !hasFailed && !wasCancelled;
        patchComments({
          store,
          sessionId,
          patch: withStatus({ ids, status: isAddressed ? 'addressed' : 'draft', at: nowIso({}) }),
        });
        putSending({ store, artifactId: plan.id, isSending: false });
      },
    });
    return { kind: 'unchanged' };
  };
  store.setState({
    loadArtifactComments: async () => undefined,
    addArtifactComment,
    editArtifactComment,
    removeArtifactComment,
    sendArtifactComments,
  });
};
