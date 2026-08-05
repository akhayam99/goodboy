import { Markdown } from '@goodboy/ui';
import type { GitlabIssueNote } from '../client';
import { IssueNoteHeader } from './IssueNoteHeader';

type Props = {
  readonly note: GitlabIssueNote;
};

export const IssueNoteCard = ({ note }: Props) => (
  <div className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
    <IssueNoteHeader note={note} />
    <Markdown text={note.body} className="text-sm leading-relaxed" />
  </div>
);
