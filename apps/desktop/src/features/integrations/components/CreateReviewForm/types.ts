import type { PullRequestPerson, SessionId } from '@goodboy/types';

export type CreatedReview = {
  readonly number: number | null;
  readonly url: string | null;
};

export type CreateReviewInput = {
  readonly title: string;
  readonly body: string;
  readonly base: string;
  readonly isDraft: boolean;
  readonly isScribeBody: boolean;
  readonly dismissed: ReadonlyArray<number>;
  readonly onPushed: () => void;
};

export type ReviewBases = {
  readonly defaultBranch: string | null;
  readonly branches: ReadonlyArray<string>;
};

export type RequestReviewersParams = {
  readonly sessionId: SessionId;
  readonly number: number;
  readonly logins: ReadonlyArray<string>;
};

export type CreateReviewNouns = {
  readonly long: 'pull request' | 'merge request';
  readonly create: string;
  readonly createDraft: string;
};

export type SearchReviewers = (query: string) => Promise<ReadonlyArray<PullRequestPerson>>;
