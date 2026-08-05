import { NoteCard } from '../../../../shared/components/NoteCard';
import type { GitlabIssueNote } from '../client';
import { IssueNoteHeader } from './IssueNoteHeader';

type Props = {
  readonly note: GitlabIssueNote;
};

export const IssueNoteCard = ({ note }: Props) => (
  <NoteCard header={<IssueNoteHeader note={note} />} body={note.body} />
);
