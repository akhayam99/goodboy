import type { IssueBriefFailure } from '@goodboy/core';

const FAILURE_TEXT = {
  provider_failed: 'The model did not answer.',
  empty_answer: 'The model answered with nothing.',
  not_json: 'The model answered in prose instead of a brief.',
  missing_title: 'The model answered without a title.',
  missing_goal: 'The model answered without a goal.',
} as const satisfies Record<IssueBriefFailure, string>;

type Params = {
  readonly failure: IssueBriefFailure;
};

export const issueBriefFailureText = ({ failure }: Params): string => FAILURE_TEXT[failure];
