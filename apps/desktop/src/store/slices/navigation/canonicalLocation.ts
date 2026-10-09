import type { AgentId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { LensKind } from '../session-view/types';
import { agentHomeFor } from './agentHomeFor';
import { branchPlace, fixRunTranscript, sessionPlace } from './place';
import { resolverThread } from './resolverThread';
import { resolveActiveMountPath } from '../worktrees/resolveActiveMountPath';
import { CONTEXT_LENS_TAB } from './contextLensTab';
import { DEFAULT_CONTEXT_TAB } from '../contextDrawer/state';
import { branchLandingTabOf } from '../../../features/branch/branchLandingTab';
import { isBranchTabAvailable } from '../../../features/branch/branchTabs';
import { branchHasPullRequest } from '../session-view/branchTabOf';
import type { BranchTab, CanonicalPlace, Place, PlaceRequest } from './types';

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
  const { sessionId, agentId, pane } = request;
  const home = agentHomeFor({ state, sessionId, agentId });
  if (home !== 'review') {
    return {
      place: sessionPlace({
        sessionId,
        lens: home ?? 'agents',
        agentId,
        ...(pane !== undefined && { target: { kind: 'agent', pane } }),
      }),
      drawer: null,
    };
  }
  return fixRunLocation({ state, sessionId, agentId, threadId: null });
};

const fixRunLocation = ({
  state,
  sessionId,
  agentId,
  threadId,
}: {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly threadId: string | null;
}): CanonicalPlace => {
  const { to, drawer } = fixRunTranscript({
    sessionId,
    agentId,
    threadId: threadId ?? resolverThread({ state, sessionId, agentId }),
    mountPath: state.diffMountPath?.[sessionId] ?? null,
  });
  return { place: canonicalPlace({ state, request: to }), drawer };
};

const formerFixRunPage = ({ state, request }: PlaceParams): CanonicalPlace | null => {
  if (request.at !== 'session') {
    return null;
  }
  const { view, sessionId } = request;
  if (view.lens !== 'review' || view.agentId === null || view.studio !== null) {
    return null;
  }
  return fixRunLocation({
    state,
    sessionId,
    agentId: view.agentId,
    threadId: view.target?.kind === 'thread' ? view.target.threadId : null,
  });
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

const prLensTab = ({ mode }: { readonly mode: string }): BranchTab => {
  if (mode === 'write_review') {
    return 'files';
  }
  return isBranchTabAvailable('pr') ? 'pr' : 'comments';
};

const unavailableBranchTab = ({ request }: { readonly request: SessionPlace }): SessionPlace => {
  const { view } = request;
  if (view.target?.kind !== 'branch' || isBranchTabAvailable(view.target.tab)) {
    return request;
  }
  return { ...request, view: { ...view, target: { ...view.target, tab: 'comments' } } };
};

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
      tab: branchLandingTabOf({
        hasPullRequest: branchHasPullRequest({ state, sessionId }),
        deepLink: threadId === null ? null : 'comments',
      }),
      threadId,
    });
  }
  if (view.lens === 'pr') {
    const mode = state.pullRequestModes?.[sessionId] ?? 'overview';
    return branchPlace({
      sessionId,
      mountPath: preferred ?? activeMountPath({ state, sessionId }),
      tab: prLensTab({ mode }),
    });
  }
  return null;
};

const canonicalPlace = ({ state, request: asked }: PlaceParams): Place => {
  if (asked.at === 'board' || asked.at === 'session-draft') {
    return asked;
  }
  const request = unavailableBranchTab({ request: asked });
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
    formerFixRunPage({ state, request }) ??
    canonicalContext({ state, request }) ?? {
      place: canonicalPlace({ state, request }),
      drawer: null,
    }
  );
};

export const lensPlace = ({
  state,
  sessionId,
  lens,
}: {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly lens: LensKind | null;
}): Place => {
  const plain = sessionPlace({ sessionId, lens });
  if (plain.at !== 'session') {
    return plain;
  }
  return formerBranchPlace({ state, request: plain }) ?? plain;
};
