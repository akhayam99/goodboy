import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../types';

type State = Pick<AppState, 'sessions' | 'sessionGithub' | 'sessionProjectPrs'>;

type Params = {
  readonly state: State;
  readonly workspaceId: WorkspaceId;
  readonly url: string;
};

export type SessionPrMatch = {
  readonly sessionId: SessionId;
  readonly number: number;
};

const matchInSession = ({
  state,
  session,
  url,
}: {
  readonly state: State;
  readonly session: Session;
  readonly url: string;
}): number | null => {
  const canonical = state.sessionGithub[session.id]?.pr;
  if (canonical !== undefined && canonical !== null && canonical.url === url) {
    return canonical.number;
  }
  const byProject = state.sessionProjectPrs[session.id];
  if (byProject === undefined) {
    return null;
  }
  for (const prs of Object.values(byProject)) {
    const match = prs.find((candidate) => candidate.url === url);
    if (match !== undefined) {
      return match.number;
    }
  }
  return null;
};

export const selectSessionForPr = ({ state, workspaceId, url }: Params): SessionPrMatch | null => {
  for (const session of state.sessions) {
    if (session.workspaceId !== workspaceId) {
      continue;
    }
    const number = matchInSession({ state, session, url });
    if (number !== null) {
      return { sessionId: session.id, number };
    }
  }
  return null;
};
