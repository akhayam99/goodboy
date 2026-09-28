import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { agentHomeFor } from './agentHomeFor';
import { resolverPagePlace, sessionPlace } from './place';
import { resolverThread } from './resolverThread';
import { resolveActiveMountPath } from '../worktrees/resolveActiveMountPath';
import { CONTEXT_LENS_TAB } from './contextLensTab';
import { DEFAULT_CONTEXT_TAB } from '../contextDrawer/state';
import type { CanonicalPlace, Place, PlaceRequest } from './types';

type GithubParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

const isGithubReviewSession = ({ state, sessionId }: GithubParams): boolean =>
  (state.sessionGithub[sessionId]?.pr ?? null) !== null &&
  (state.sessionGitlabMr[sessionId]?.mr ?? null) === null &&
  (state.sessionBitbucketPr[sessionId]?.pr ?? null) === null;

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
  const { sessionId, agentId } = request;
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
  return { place: resolverPagePlace({ sessionId, agentId, threadId }), drawer: null };
};

type PlaceParams = {
  readonly state: AppState;
  readonly request: Place;
};

const canonicalPlace = ({ state, request }: PlaceParams): Place => {
  if (request.at === 'board') {
    return request;
  }
  const { view, sessionId } = request;
  if (view.lens === 'pr' && isGithubReviewSession({ state, sessionId })) {
    return { ...request, view: { ...view, lens: 'review', target: null } };
  }
  if (
    view.lens === 'files' &&
    (view.target === null || (view.target.kind === 'diff' && view.target.mountPath === null))
  ) {
    const mounts = state.sessionProjectMounts?.[sessionId] ?? [];
    const mountPath =
      mounts.length === 0
        ? null
        : (resolveActiveMountPath({ state, sessionId }) ?? mounts[0]?.worktreePath ?? null);
    if (mountPath !== null) {
      const focus = view.target?.kind === 'diff' ? view.target.focus : null;
      return { ...request, view: { ...view, target: { kind: 'diff', mountPath, focus } } };
    }
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
