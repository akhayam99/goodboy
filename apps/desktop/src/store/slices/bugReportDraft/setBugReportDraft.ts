import type { IssueTypeValue } from '../../../features/settings/reportIssueTypes';
import type { GetFn, SetFn } from './types';

export type Params = {
  readonly issueType?: IssueTypeValue;
  readonly title?: string;
  readonly description?: string;
};

export const setBugReportDraft = (set: SetFn, get: GetFn) => {
  return ({ issueType, title, description }: Params): void => {
    const current = get().bugReportDraft;
    set({
      bugReportDraft: {
        ...current,
        issueType: issueType ?? current.issueType,
        title: title ?? current.title,
        description: description ?? current.description,
      },
    });
  };
};
