import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { agentHomeFor } from './agentHomeFor';
import { resolverPagePlace, sessionPlace } from './place';
import { resolverThread } from './resolverThread';
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
  return {
    place: sessionPlace({ sessionId, lens: 'review' }),
    drawer: { kind: 'conversation', sessionId, payload: { threadId, tab: 'agent' } },
  };
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

export const canonicalLocation = ({ state, request }: Params): CanonicalPlace =>
  request.at === 'agent'
    ? canonicalAgent({ state, request })
    : { place: canonicalPlace({ state, request }), drawer: null };
