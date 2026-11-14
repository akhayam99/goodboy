import type { AgentId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { LensKind } from '../session-view/types';
import { agentHomeFor } from './agentHomeFor';
import { isProviderListLens } from './isProviderListLens';
import { doorMountPath } from './doorMountPath';
import { foldedLensOf } from './foldedLensOf';
import { branchPlace, fixRunTranscript, sessionPlace } from './place';
import { resolverThread } from './resolverThread';
import { branchLandingTabOf } from '../../../features/branch/branchLandingTab';
import { resolveBranchTab } from '../../../features/branch/branchTabs';
import { branchScopeOf } from '../session-view/branchScopeOf';
import { selectMountForPath } from '../project-mounts/selectors';
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
  const { sessionId, agentId } = request;
  const home = agentHomeFor({ state, sessionId, agentId });
  if (home !== 'review') {
    return {
      place: sessionPlace({ sessionId, lens: home ?? 'workflows', agentId }),
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
  });
  return { place: canonicalPlace({ state, request: to }), drawer };
};

const formerFixRunPage = ({ state, request }: PlaceParams): CanonicalPlace | null => {
  if (request.at !== 'session') {
    return null;
  }
  const { view, sessionId } = request;
  if (view.lens !== 'review' || view.agentId === null) {
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

type SessionParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

const hasMount = ({
  state,
  sessionId,
}: {
  readonly state: AppState;
  readonly sessionId: SessionId;
}): boolean => (state.sessionProjectMounts?.[sessionId] ?? []).length > 0;

type RequestParams = {
  readonly request: SessionPlace;
};

const requestedMountPath = ({ request }: RequestParams): string | null => {
  const target = request.view.target;
  return target?.kind === 'diff' || target?.kind === 'branch' ? target.mountPath : null;
};

const prLensTab = ({ mode }: { readonly mode: string }): BranchTab =>
  mode === 'write_review' ? 'files' : 'pr';

const unavailableBranchTab = ({
  state,
  request,
}: {
  readonly state: AppState;
  readonly request: SessionPlace;
}): SessionPlace => {
  const { view } = request;
  if (view.target?.kind !== 'branch') {
    return request;
  }
  const tab = resolveBranchTab({
    tab: view.target.tab,
    scope: branchScopeOf({
      state,
      sessionId: request.sessionId,
      mountId:
        view.target.mountPath === null
          ? null
          : (selectMountForPath({
              state,
              sessionId: request.sessionId,
              path: view.target.mountPath,
            })?.mountId ?? null),
      hasThread: view.target.threadId !== null,
    }),
  });
  if (tab === view.target.tab) {
    return request;
  }
  return { ...request, view: { ...view, target: { ...view.target, tab } } };
};

const formerBranchTarget = ({
  state,
  request,
}: {
  readonly state: AppState;
  readonly request: SessionPlace;
}): Place | null => {
  const { view, sessionId } = request;
  if (view.agentId !== null) {
    return null;
  }
  if (view.lens === 'files' && view.target?.kind === 'diff' && view.target.page === 'history') {
    return branchPlace({ sessionId, mountPath: view.target.mountPath, tab: 'commits' });
  }
  if (view.lens === 'review') {
    const threadId = view.target?.kind === 'thread' ? view.target.threadId : null;
    return branchPlace({
      sessionId,
      mountPath: requestedMountPath({ request }),
      tab: branchLandingTabOf({ deepLink: threadId === null ? null : 'comments' }),
      threadId,
    });
  }
  if (view.lens === 'pr') {
    const mode = state.pullRequestModes?.[sessionId] ?? 'overview';
    return branchPlace({
      sessionId,
      mountPath: requestedMountPath({ request }),
      tab: prLensTab({ mode }),
    });
  }
  return null;
};

const formerBranchPlace = ({
  state,
  request,
}: {
  readonly state: AppState;
  readonly request: SessionPlace;
}): Place | null => {
  const place = formerBranchTarget({ state, request });
  if (place === null || place.at !== 'session') {
    return place;
  }
  return unavailableBranchTab({ state, request: place });
};

type ChangesParams = {
  readonly state: AppState;
  readonly request: SessionPlace;
};

const changesOnBranch = ({ state, request }: ChangesParams): SessionPlace => {
  const { view, sessionId } = request;
  if (view.lens !== 'files' || view.agentId !== null || !hasMount({ state, sessionId })) {
    return request;
  }
  const target = view.target?.kind === 'diff' ? view.target : null;
  if (target !== null && target.mountPath !== null) {
    return request;
  }
  const mountPath = doorMountPath({ state, sessionId });
  if (mountPath === null) {
    return request;
  }
  return {
    ...request,
    view: {
      ...view,
      target: target === null ? { kind: 'diff', mountPath, focus: null } : { ...target, mountPath },
    },
  };
};

const canonicalPlace = ({ state, request: asked }: PlaceParams): Place => {
  if (asked.at === 'board' || asked.at === 'session-draft') {
    return asked;
  }
  const request = unavailableBranchTab({
    state,
    request: { ...asked, view: { ...asked.view, lens: foldedLensOf({ lens: asked.view.lens }) } },
  });
  const { view, sessionId } = request;
  if (isProviderListLens({ lens: view.lens }) && view.target === null) {
    return sessionPlace({ sessionId });
  }
  const branch = formerBranchPlace({ state, request });
  if (branch !== null) {
    return branch;
  }
  return changesOnBranch({ state, request });
};

const isAskHandOver = ({ state, sessionId }: SessionParams): boolean => {
  const drawer = state.drawer ?? null;
  if (drawer === null || drawer.sessionId !== sessionId) {
    return false;
  }
  return drawer.kind === 'ask' || (drawer.kind === 'question' && drawer.payload.from === 'ask');
};

const canonicalQuestion = ({ state, request }: PlaceParams): CanonicalPlace | null => {
  if (request.at !== 'session' || request.view.target?.kind !== 'question') {
    return null;
  }
  const { sessionId } = request;
  const { questionId } = request.view.target;
  const from = isAskHandOver({ state, sessionId }) ? 'ask' : null;
  return {
    place: canonicalPlace({ state, request }),
    drawer: {
      kind: 'question',
      sessionId,
      payload: from === null ? { questionId } : { questionId, from },
    },
  };
};

export const canonicalLocation = ({ state, request }: Params): CanonicalPlace => {
  if (request.at === 'agent') {
    return canonicalAgent({ state, request });
  }
  return (
    formerFixRunPage({ state, request }) ??
    canonicalQuestion({ state, request }) ?? {
      place: canonicalPlace({ state, request }),
      drawer: null,
    }
  );
};

type LensParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly lens: LensKind | null;
  readonly mountPath?: string | null;
};

const MOUNT_LENSES: ReadonlySet<LensKind | null> = new Set<LensKind | null>([
  'files',
  'review',
  'pr',
]);

export const lensPlace = ({ state, sessionId, lens, mountPath }: LensParams): Place => {
  const isMountLens = MOUNT_LENSES.has(lens);
  const mount =
    isMountLens && mountPath === undefined
      ? doorMountPath({ state, sessionId })
      : (mountPath ?? null);
  const plain = sessionPlace({
    sessionId,
    lens,
    ...(isMountLens &&
      mount !== null && { target: { kind: 'diff', mountPath: mount, focus: null } }),
  });
  if (plain.at !== 'session') {
    return plain;
  }
  return formerBranchPlace({ state, request: plain }) ?? plain;
};
