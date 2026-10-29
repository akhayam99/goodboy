import type { BranchFactsCheck, BranchFactsPart, BranchFactsRequest } from '@goodboy/core';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type PullRequestHost,
  type PullRequestView,
} from '@goodboy/types';
import type { AppStore } from '../../../store';
import { sessionMountTargets } from '../../../slices/project-mounts/mountRequests';
import { pullRequestPortFor } from '../../../slices/review-source/pullRequestPortFor';
import { mountRequestHostOf } from '../../../slices/review-source/mountRequestHostOf';
import { refreshMountRequests } from '../../../slices/review-source/refreshMountRequests';
import { sessionById } from '../../../slices/sessions/sessionIndex';
import type { ReadBranchFactsParams } from '../ports';
import type { RequestFacts } from './readBranchFactsOf';

type ViewParams = {
  readonly view: PullRequestView;
};

const requestOf = ({ view }: ViewParams): BranchFactsRequest => ({
  host: view.host,
  number: view.number,
  title: view.title,
  url: view.url,
  state: view.state,
  isDraft: view.isDraft,
  baseBranch: view.baseBranch,
  headBranch: view.headBranch,
});

const checksOf = ({ view }: ViewParams): BranchFactsPart<ReadonlyArray<BranchFactsCheck>> =>
  view.checks.read === 'ok'
    ? {
        kind: 'ok',
        value: view.checks.runs.map((run) => ({ name: run.name, conclusion: run.conclusion })),
      }
    : {
        kind: 'unavailable',
        reason: view.checks.error ?? `the host answered ${view.checks.read}`,
      };

type Seen = Readonly<{
  hasRequest: boolean;
  fetchedAt: IsoDateTime | null;
  error: string | null;
}>;

type SeenParams = {
  readonly state: AppStore;
  readonly host: PullRequestHost;
  readonly mountId: MountId;
};

const seenOf = ({ state, host, mountId }: SeenParams): Seen | null => {
  if (host === 'github') {
    const entry = state.mountGithub?.[mountId];
    return entry === undefined
      ? null
      : { hasRequest: entry.pr !== null, fetchedAt: entry.fetchedAt, error: entry.error };
  }
  if (host === 'gitlab') {
    const entry = state.mountGitlabMr?.[mountId];
    return entry === undefined
      ? null
      : { hasRequest: entry.mr !== null, fetchedAt: entry.fetchedAt, error: entry.error };
  }
  const entry = state.mountBitbucketPr?.[mountId];
  return entry === undefined
    ? null
    : {
        hasRequest: entry.pr !== null || entry.prs.length > 0,
        fetchedAt: entry.fetchedAt,
        error: entry.error,
      };
};

type Params = Readonly<{
  getState: () => AppStore;
  params: ReadBranchFactsParams;
}>;

const UNKNOWN_MOUNT = 'this mount is not part of the conversation';
const NO_CONNECTION = 'the host connection of this mount is not available';
const NOT_READ = 'the pull request of this mount could not be read';

export const readMountRequest = async ({
  getState,
  params,
}: Params): Promise<RequestFacts | null> => {
  const { sessionId } = params;
  const mountId = brandId<MountId>({ value: params.mountId });
  const before = getState();
  const session = sessionById(before.sessions, sessionId);
  const target = sessionMountTargets({ state: before, sessionId }).find(
    (candidate) => candidate.id === mountId,
  );
  if (session === undefined || target === undefined) {
    throw new Error(UNKNOWN_MOUNT);
  }
  const host = mountRequestHostOf({
    state: before,
    workspaceId: session.workspaceId,
    mount: target,
  });
  await refreshMountRequests({
    get: getState,
    host,
    sessionId,
    options: { force: true, mountId },
  });
  const port = pullRequestPortFor({ get: getState, sessionId, mountId, host });
  if (port !== null) {
    const view = await port.read();
    return { request: requestOf({ view }), checks: checksOf({ view }) };
  }
  const seen = seenOf({ state: getState(), host, mountId });
  if (seen === null) {
    throw new Error(NOT_READ);
  }
  if (seen.hasRequest) {
    throw new Error(NO_CONNECTION);
  }
  if (seen.error !== null || seen.fetchedAt === null) {
    throw new Error(seen.error ?? NOT_READ);
  }
  return null;
};
