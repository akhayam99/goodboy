import { Markdown } from '@goodboy/ui';
import type { JiraComment } from '../client';
import { IssueNoteHeader } from './IssueNoteHeader';

type Props = {
  readonly comment: JiraComment;
};

export const IssueNoteCard = ({ comment }: Props) => (
  <div className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
    <IssueNoteHeader comment={comment} />
    <Markdown text={comment.body} className="text-sm leading-relaxed" />
  </div>
);
