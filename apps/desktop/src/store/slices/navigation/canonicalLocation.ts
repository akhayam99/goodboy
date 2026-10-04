import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { agentHomeFor } from './agentHomeFor';
import { branchPlace, resolverPagePlace, sessionPlace } from './place';
import { resolverThread } from './resolverThread';
import { resolveActiveMountPath } from '../worktrees/resolveActiveMountPath';
import { CONTEXT_LENS_TAB } from './contextLensTab';
import { DEFAULT_CONTEXT_TAB } from '../contextDrawer/state';
import type { CanonicalPlace, Place, PlaceRequest } from './types';

type SessionPlace = Extract<Place, { readonly at: 'session' }>;

type Params = {
  readonly state: AppState;
  readonly request: PlaceRequest;
};

const canonicalAgent = ({
  state,
  request,
}: {
  readonly state: AppState;
  readonly request: Extract<PlaceRequest, { readonly at: 'agent' }>;
}): CanonicalPlace => {
  const { sessionId, agentId, pane = null } = request;
  const home = agentHomeFor({ state, sessionId, agentId });
  if (home !== 'review') {
    return {
      place: sessionPlace({ sessionId, lens: home ?? 'agents', agentId }),
      drawer: null,
    };
  }
  const threadId = resolverThread({ state, sessionId, agentId });
  if (threadId === null) {
    return { place: sessionPlace({ sessionId, lens: 'review', agentId }), drawer: null };
  }
  return { place: resolverPagePlace({ sessionId, agentId, threadId, pane }), drawer: null };
};

type PlaceParams = {
  readonly state: AppState;
  readonly request: Place;
};

const activeMountPath = ({
  state,
  sessionId,
}: {
  readonly state: AppState;
  readonly sessionId: SessionId;
}): string | null => {
  const mounts = state.sessionProjectMounts?.[sessionId] ?? [];
  if (mounts.length === 0) {
    return null;
  }
  return resolveActiveMountPath({ state, sessionId }) ?? mounts[0]?.worktreePath ?? null;
};

const hasMount = ({
  state,
  sessionId,
}: {
  readonly state: AppState;
  readonly sessionId: SessionId;
}): boolean => (state.sessionProjectMounts?.[sessionId] ?? []).length > 0;

const isCodeHostBranch = ({
  state,
  sessionId,
}: {
  readonly state: AppState;
  readonly sessionId: SessionId;
}): boolean =>
  (state.sessionGitlabMr?.[sessionId]?.mr ?? null) === null &&
  (state.sessionBitbucketPr?.[sessionId]?.pr ?? null) === null;

const formerBranchPlace = ({
  state,
  request,
}: {
  readonly state: AppState;
  readonly request: SessionPlace;
}): Place | null => {
  const { view, sessionId } = request;
  if (view.studio !== null || view.agentId !== null) {
    return null;
  }
  const preferred = state.diffMountPath?.[sessionId] ?? null;
  const explicit = view.target?.kind === 'diff' ? view.target.mountPath : null;
  if (view.lens === 'files' && (explicit !== null || hasMount({ state, sessionId }))) {
    const target = view.target?.kind === 'diff' ? view.target : null;
    const mountPath = target?.mountPath ?? preferred ?? activeMountPath({ state, sessionId });
    return branchPlace({
      sessionId,
      mountPath,
      tab: target?.page === 'history' ? 'commits' : 'files',
      focus: target?.focus ?? null,
    });
  }
  if (view.lens === 'review') {
    const threadId = view.target?.kind === 'thread' ? view.target.threadId : null;
    return branchPlace({
      sessionId,
      mountPath: preferred ?? activeMountPath({ state, sessionId }),
      tab: 'comments',
      threadId,
    });
  }
  if (view.lens === 'pr' && isCodeHostBranch({ state, sessionId })) {
    const mode = state.pullRequestModes?.[sessionId] ?? 'overview';
    return branchPlace({
      sessionId,
      mountPath: preferred ?? activeMountPath({ state, sessionId }),
      tab: mode === 'write_review' ? 'files' : 'comments',
    });
  }
  return null;
};

const canonicalPlace = ({ state, request }: PlaceParams): Place => {
  if (request.at === 'board' || request.at === 'session-draft') {
    return request;
  }
  const { view, sessionId } = request;
  const branch = formerBranchPlace({ state, request });
  if (branch !== null) {
    return branch;
  }
  if (view.target?.kind === 'branch' && view.target.mountPath === null) {
    const mountPath = state.diffMountPath?.[sessionId] ?? activeMountPath({ state, sessionId });
    return mountPath === null
      ? request
      : { ...request, view: { ...view, target: { ...view.target, mountPath } } };
  }
  if (view.studio !== null && view.agentId !== null) {
    return { ...request, view: { ...view, agentId: null } };
  }
  if (view.lens === 'review' && view.agentId !== null && view.target === null) {
    const threadId = resolverThread({ state, sessionId, agentId: view.agentId });
    return threadId === null
      ? request
      : resolverPagePlace({ sessionId, agentId: view.agentId, threadId });
  }
  return request;
};

const canonicalContext = ({ state, request }: PlaceParams): CanonicalPlace | null => {
  if (request.at !== 'session' || request.view.lens === null) {
    return null;
  }
  const tab = CONTEXT_LENS_TAB[request.view.lens];
  if (tab === undefined) {
    return null;
  }
  const { sessionId } = request;
  return {
    place: sessionPlace({ sessionId }),
    drawer: {
      kind: 'context',
      sessionId,
      payload: {
        tab: tab ?? state.contextDrawerTab?.[sessionId] ?? DEFAULT_CONTEXT_TAB,
        view: 'current',
      },
    },
  };
};

export const canonicalLocation = ({ state, request }: Params): CanonicalPlace => {
  if (request.at === 'agent') {
    return canonicalAgent({ state, request });
  }
  return (
    canonicalContext({ state, request }) ?? {
      place: canonicalPlace({ state, request }),
      drawer: null,
    }
  );
};
