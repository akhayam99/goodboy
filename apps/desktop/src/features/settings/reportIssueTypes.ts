import { Bug, CircleQuestionMark, Lightbulb } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const ISSUE_TYPE_OPTIONS = [
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'idea', label: 'Idea', icon: Lightbulb },
  { value: 'question', label: 'Question', icon: CircleQuestionMark },
] as const satisfies ReadonlyArray<{
  readonly value: string;
  readonly label: string;
  readonly icon: LucideIcon;
}>;

export type IssueTypeValue = (typeof ISSUE_TYPE_OPTIONS)[number]['value'];

export const DEFAULT_ISSUE_TYPE: IssueTypeValue = 'bug';

type IssueTypeLabelParams = {
  readonly issueType: IssueTypeValue;
};

export const issueTypeLabel = ({ issueType }: IssueTypeLabelParams): string =>
  ISSUE_TYPE_OPTIONS.find((option) => option.value === issueType)?.label ?? '';
