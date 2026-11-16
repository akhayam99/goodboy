import type { GhTokenStatus } from '@goodboy/types';

type Params = {
  readonly statuses: ReadonlyArray<GhTokenStatus | null | undefined>;
};

export const isGithubConnected = ({ statuses }: Params): boolean =>
  statuses.some((status) => status != null && status.mode !== 'absent');
