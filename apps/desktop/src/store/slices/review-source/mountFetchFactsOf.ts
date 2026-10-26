import type { IsoDateTime, MountId, PullRequestHost, WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { MountTarget } from '../project-mounts/mountRequests';
import { mountRequestHostOf, type MountHostState } from './mountRequestHostOf';

export type MountFetchState = MountHostState &
  Pick<AppState, 'mountGithub' | 'githubStatus' | 'hostReachability'>;

export type MountFetchFacts = Readonly<{
  host: PullRequestHost;
  isHostAvailable: boolean | null;
  fetchedAt: IsoDateTime | null;
  failedAt: IsoDateTime | null;
  isHostUnreachable: boolean;
  hasRequest: boolean;
  isEnded: boolean;
}>;

type Params = {
  readonly state: MountFetchState;
  readonly workspaceId: WorkspaceId;
  readonly mount: Pick<MountTarget, 'id' | 'projectId'>;
};

type HostParams = {
  readonly state: MountFetchState;
  readonly workspaceId: WorkspaceId;
  readonly host: PullRequestHost;
};

type EntryParams = {
  readonly state: MountFetchState;
  readonly mountId: MountId;
};

type Entry = Pick<MountFetchFacts, 'fetchedAt' | 'failedAt' | 'hasRequest' | 'isEnded'>;

const NO_ENTRY: Entry = { fetchedAt: null, failedAt: null, hasRequest: false, isEnded: false };

const ENDED_BITBUCKET_STATES: ReadonlySet<string> = new Set(['MERGED', 'DECLINED', 'SUPERSEDED']);

const githubEntryOf = ({ state, mountId }: EntryParams): Entry => {
  const entry = state.mountGithub?.[mountId];
  if (entry === undefined) {
    return NO_ENTRY;
  }
  return {
    fetchedAt: entry.fetchedAt,
    failedAt: entry.failedAt,
    hasRequest: entry.pr !== null,
    isEnded: entry.pr?.state === 'merged' || entry.pr?.state === 'closed',
  };
};

const gitlabEntryOf = ({ state, mountId }: EntryParams): Entry => {
  const entry = state.mountGitlabMr?.[mountId];
  if (entry === undefined) {
    return NO_ENTRY;
  }
  return {
    fetchedAt: entry.fetchedAt,
    failedAt: null,
    hasRequest: entry.mr !== null,
    isEnded: entry.mr?.state === 'merged' || entry.mr?.state === 'closed',
  };
};

const bitbucketEntryOf = ({ state, mountId }: EntryParams): Entry => {
  const entry = state.mountBitbucketPr?.[mountId];
  if (entry === undefined) {
    return NO_ENTRY;
  }
  return {
    fetchedAt: entry.fetchedAt,
    failedAt: null,
    hasRequest: entry.pr !== null,
    isEnded: entry.pr !== null && ENDED_BITBUCKET_STATES.has(entry.pr.state),
  };
};

const ENTRY_READERS: Record<PullRequestHost, (params: EntryParams) => Entry> = {
  github: githubEntryOf,
  gitlab: gitlabEntryOf,
  bitbucket: bitbucketEntryOf,
};

const isHostAvailableOf = ({ state, workspaceId, host }: HostParams): boolean | null => {
  if (host === 'github') {
    return state.githubStatus?.available ?? null;
  }
  return (state.workspaceIntegrations?.[workspaceId] ?? []).some(
    (binding) => binding.provider === host,
  );
};

const isHostUnreachableOf = ({ state, host }: Pick<HostParams, 'state' | 'host'>): boolean => {
  if (host === 'github') {
    return false;
  }
  return state.hostReachability?.[host]?.status === 'unreachable';
};

export const mountFetchFactsOf = ({ state, workspaceId, mount }: Params): MountFetchFacts => {
  const host = mountRequestHostOf({ state, workspaceId, mount });
  return {
    host,
    isHostUnreachable: isHostUnreachableOf({ state, host }),
    isHostAvailable: isHostAvailableOf({ state, workspaceId, host }),
    ...ENTRY_READERS[host]({ state, mountId: mount.id }),
  };
};
