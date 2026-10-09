import { Button, Markdown } from '@goodboy/ui';
import type { DiffComment } from '@goodboy/types';
import { REVIEW_NOTES_COPY } from '../../reviewNotesCopy';

type Props = {
  readonly note: DiffComment;
  readonly onReopen: () => void;
};

export const ClosedNote = ({ note, onReopen }: Props) => (
  <li className="flex min-w-0 items-start gap-2 list-none">
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="min-w-0 truncate text-code text-faint-foreground">
        {note.filePath}
        {note.anchor === undefined ? '' : `:${note.anchor.lineNumber}`}
      </span>
      <Markdown text={note.body} variant="preview" className="text-body text-muted-foreground" />
    </span>
    <Button size="sm" variant="ghost" onClick={onReopen}>
      {REVIEW_NOTES_COPY.reopen}
    </Button>
  </li>
);
