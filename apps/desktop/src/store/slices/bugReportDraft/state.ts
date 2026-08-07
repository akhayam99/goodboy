import {
  DEFAULT_ISSUE_TYPE,
  type IssueTypeValue,
} from '../../../features/settings/reportIssueTypes';

export type BugReportDraft = {
  readonly issueType: IssueTypeValue;
  readonly description: string;
};

export const emptyBugReportDraft: BugReportDraft = {
  issueType: DEFAULT_ISSUE_TYPE,
  description: '',
};

export type BugReportDraftState = {
  readonly bugReportDraft: BugReportDraft;
};

export const initialBugReportDraftState: BugReportDraftState = {
  bugReportDraft: emptyBugReportDraft,
};
