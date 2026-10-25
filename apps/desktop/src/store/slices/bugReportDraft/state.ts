import {
  DEFAULT_ISSUE_TYPE,
  type IssueTypeValue,
} from '../../../features/bug-report/reportIssueTypes';

export type BugReportDraft = {
  readonly issueType: IssueTypeValue;
  readonly title: string;
  readonly description: string;
};

export const emptyBugReportDraft: BugReportDraft = {
  issueType: DEFAULT_ISSUE_TYPE,
  title: '',
  description: '',
};

export type BugReportDraftState = {
  readonly bugReportDraft: BugReportDraft;
};

export const bugReportDraftInitialState: BugReportDraftState = {
  bugReportDraft: emptyBugReportDraft,
};
