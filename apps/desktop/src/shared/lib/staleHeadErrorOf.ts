import { PullRequestPortError, STALE_HEAD_MESSAGE } from '@goodboy/core';
import { CommandError } from './invokeCommand';

const STALE_HEAD_KIND = 'stale_head';

type Params = {
  readonly error: unknown;
};

export const staleHeadErrorOf = ({ error }: Params): PullRequestPortError | null => {
  if (!(error instanceof CommandError) || error.kind !== STALE_HEAD_KIND) {
    return null;
  }
  return new PullRequestPortError({
    kind: 'stale_head',
    message: STALE_HEAD_MESSAGE,
    details: error.message,
  });
};
