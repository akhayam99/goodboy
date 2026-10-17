import { extractScribeText } from '@goodboy/core';
import { brandId, type MountId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { scribeKeyOf } from '../scribe/scribeKeyOf';
import type { PublishScribeParams, ScribePublication } from './ports';

const SCRIBE_NO_TEXT = 'Scribe wrote no title or description.';
const SCRIBE_NOT_OPENED = 'The pull request was not opened.';

type ScribePublisherState = Pick<AppStore, 'resumeScribePullRequest' | 'scribeWork'>;

type PublishScribePullRequestParams = {
  readonly getState: () => ScribePublisherState;
  readonly params: PublishScribeParams;
};

export const publishScribePullRequest = async ({
  getState,
  params,
}: PublishScribePullRequestParams): Promise<ScribePublication> => {
  const output = extractScribeText(params.assistantText);
  if (output.prTitle === null && output.prBody === null) {
    return { kind: 'failed', message: SCRIBE_NO_TEXT };
  }
  const mountId = brandId<MountId>({ value: params.mountId });
  await getState().resumeScribePullRequest({
    sessionId: params.sessionId,
    mountId,
    agentId: params.agentId,
    output,
  });
  const work = getState().scribeWork[scribeKeyOf({ mountId, kind: 'pr' })];
  if (work === undefined || work.agentId !== params.agentId) {
    return { kind: 'failed', message: SCRIBE_NOT_OPENED };
  }
  if (work.status === 'created' && work.pullRequest !== null) {
    return { kind: 'opened', number: work.pullRequest.number, url: work.pullRequest.url };
  }
  return { kind: 'failed', message: work.error ?? SCRIBE_NOT_OPENED };
};
