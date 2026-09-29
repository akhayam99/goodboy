import type { AppState } from '../../types';

export const viewerLoginsOf = ({
  state,
}: {
  readonly state: Pick<AppState, 'githubStatus' | 'githubWorkspaceStatus'>;
}): ReadonlySet<string> => {
  const logins = [
    state.githubStatus?.user,
    ...Object.values(state.githubWorkspaceStatus).map((status) => status?.user),
  ].flatMap((login) => (login === undefined || login === '' ? [] : [login.toLowerCase()]));
  return new Set(logins);
};
