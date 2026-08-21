import type { PullRequestState, SessionEventPayload } from '@goodboy/types';

type Params = {
  readonly number: number;
  readonly pr: PullRequestState | null;
};

export const prEventPayload = ({ number, pr }: Params): SessionEventPayload => {
  if (pr == null || pr.number !== number) {
    return { number };
  }
  return { number, title: pr.title, url: pr.url };
};
