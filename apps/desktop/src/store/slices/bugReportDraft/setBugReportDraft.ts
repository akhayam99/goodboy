import type { IssueTypeValue } from '../../../features/settings/reportIssueTypes';
import type { GetFn, SetFn } from './types';

export type Params = {
  readonly issueType?: IssueTypeValue;
  readonly description?: string;
};

export const setBugReportDraft = (set: SetFn, get: GetFn) => {
  return ({ issueType, description }: Params): void => {
    const current = get().bugReportDraft;
    set({
      bugReportDraft: {
        issueType: issueType ?? current.issueType,
        description: description ?? current.description,
      },
    });
  };
};
