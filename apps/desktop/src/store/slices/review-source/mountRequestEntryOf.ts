import type { IsoDateTime, MountId, PullRequestHost } from '@goodboy/types';
import type { AppState } from '../../types';

export type MountRequestEntry = {
  readonly hasRequest: boolean;
  readonly fetchedAt: IsoDateTime | null;
  readonly error: string | null;
  readonly isLoading: boolean;
};

type Params = {
  readonly state: Pick<AppState, 'mountGithub' | 'mountGitlabMr' | 'mountBitbucketPr'>;
  readonly host: PullRequestHost;
  readonly mountId: MountId;
};

export const mountRequestEntryOf = ({ state, host, mountId }: Params): MountRequestEntry | null => {
  if (host === 'github') {
    const entry = state.mountGithub?.[mountId];
    return entry === undefined
      ? null
      : {
          hasRequest: entry.pr !== null,
          fetchedAt: entry.fetchedAt,
          error: entry.error,
          isLoading: entry.loading,
        };
  }
  if (host === 'gitlab') {
    const entry = state.mountGitlabMr?.[mountId];
    return entry === undefined
      ? null
      : {
          hasRequest: entry.mr !== null,
          fetchedAt: entry.fetchedAt,
          error: entry.error,
          isLoading: entry.loading,
        };
  }
  const entry = state.mountBitbucketPr?.[mountId];
  return entry === undefined
    ? null
    : {
        hasRequest: entry.pr !== null || entry.prs.length > 0,
        fetchedAt: entry.fetchedAt,
        error: entry.error,
        isLoading: entry.loading,
      };
};
