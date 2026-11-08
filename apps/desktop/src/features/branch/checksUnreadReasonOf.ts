import type { PullRequestState } from '@goodboy/types';

type Params = {
  readonly pr: Pick<PullRequestState, 'number' | 'checksUnknown'> | null;
  readonly detail: { readonly prNumber: number; readonly checksRead?: string | null } | null;
};

export const checksUnreadReasonOf = ({ pr, detail }: Params): string | null => {
  if (pr === null) {
    return null;
  }
  const checksRead = detail !== null && detail.prNumber === pr.number ? detail.checksRead : null;
  if (pr.checksUnknown === true || checksRead === 'denied') {
    return "Checks unknown: this token can't read them";
  }
  return checksRead === 'failed' ? "Checks unknown: couldn't read them" : null;
};
