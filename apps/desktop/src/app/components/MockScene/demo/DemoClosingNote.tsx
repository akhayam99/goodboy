import { ArrowRight } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { ClosingNote } from './useDemoHints';

type Props = {
  readonly note: ClosingNote;
  readonly onGo: () => void;
};

export const DemoClosingNote = ({ note, onGo }: Props) => (
  <div
    role="note"
    aria-label="Group done"
    className="flex flex-col items-start gap-2 rounded-lg border border-border-soft px-3 py-2"
  >
    <p className="text-ui text-muted-foreground">{note.copy}</p>
    <Button size="xs" variant="secondary" onClick={onGo}>
      Go to {note.next.title}
      <ArrowRight size={ICON_SIZE.control} aria-hidden />
    </Button>
  </div>
);
