import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { ReviewSourceEntry } from '../review-source/types';
import { sessionById } from '../sessions/sessionIndex';
import { viewerBindingOf } from './viewerBindingOf';
import { viewerNameOf } from './viewerNameOf';

type Params = {
  readonly state: Pick<
    AppState,
    'githubStatus' | 'githubWorkspaceStatus' | 'workspaceIntegrations' | 'sessions'
  >;
  readonly sessionId: SessionId;
  readonly entry: Pick<ReviewSourceEntry, 'kind' | 'projectId' | 'url'> | null;
};

type ValueParams = {
  readonly value: string;
};

const canonicalIdOf = ({ value }: ValueParams): ReadonlySet<string> | null =>
  value === '' ? null : new Set([value.toLowerCase()]);

export const viewerIdentityOf = ({
  state,
  sessionId,
  entry,
}: Params): ReadonlySet<string> | null => {
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    return null;
  }
  const kind = entry?.kind ?? 'github';
  if (kind === 'github') {
    const workspaceStatus = state.githubWorkspaceStatus?.[session.workspaceId];
    const user =
      workspaceStatus?.user ??
      (workspaceStatus?.scoped === true ? undefined : state.githubStatus?.user);
    return canonicalIdOf({ value: user ?? '' });
  }
  const binding = viewerBindingOf({ state, sessionId, entry });
  return binding === null ? null : canonicalIdOf({ value: viewerNameOf({ binding }) });
};
