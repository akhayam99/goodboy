import { NoteCard } from '../../../../shared/components/NoteCard';
import type { JiraComment } from '../client';
import { IssueNoteHeader } from './IssueNoteHeader';

type Props = {
  readonly comment: JiraComment;
};

export const IssueNoteCard = ({ comment }: Props) => (
  <NoteCard header={<IssueNoteHeader comment={comment} />} body={comment.body} />
);
