import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { agentHomeFor } from './agentHomeFor';
import { sessionPlace } from './place';
import type { Place, PlaceRequest } from './types';

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

export const canonicalLocation = ({ state, request }: Params): Place => {
  if (request.at === 'board') {
    return request;
  }
  if (request.at === 'agent') {
    const home = agentHomeFor({
      state,
      sessionId: request.sessionId,
      agentId: request.agentId,
    });
    return sessionPlace({
      sessionId: request.sessionId,
      lens: home ?? 'agents',
      agentId: request.agentId,
    });
  }
  const { view, sessionId } = request;
  if (view.lens === 'pr' && isGithubReviewSession({ state, sessionId })) {
    return { ...request, view: { ...view, lens: 'review', target: null } };
  }
  if (view.studio !== null && view.agentId !== null) {
    return { ...request, view: { ...view, agentId: null } };
  }
  return request;
};
