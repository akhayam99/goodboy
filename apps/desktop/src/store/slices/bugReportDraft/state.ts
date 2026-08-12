import {
  DEFAULT_ISSUE_TYPE,
  type IssueTypeValue,
} from '../../../features/settings/reportIssueTypes';

export type BugReportImage = {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly dataUrl: string;
};

export type BugReportDraft = {
  readonly issueType: IssueTypeValue;
  readonly description: string;
  readonly images: ReadonlyArray<BugReportImage>;
};

export const emptyBugReportDraft: BugReportDraft = {
  issueType: DEFAULT_ISSUE_TYPE,
  description: '',
  images: [],
};

export type BugReportDraftState = {
  readonly bugReportDraft: BugReportDraft;
};

export const initialBugReportDraftState: BugReportDraftState = {
  bugReportDraft: emptyBugReportDraft,
};
