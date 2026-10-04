import { ArchiveRestore } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly onRestore: () => void;
};

export const ChatArchivedBanner = ({ onRestore }: Props) => (
  <div
    role="status"
    className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-label text-muted-foreground"
  >
    <CONCEPT_ICONS.archive size={ICON_SIZE.row} aria-hidden className="shrink-0" />
    <span className="shrink-0 text-foreground">Archived</span>
    <span className="min-w-0 flex-1 truncate">Sending a message restores this chat.</span>
    <Button variant="ghost" size="sm" onClick={onRestore}>
      <ArchiveRestore size={ICON_SIZE.row} aria-hidden />
      Restore
    </Button>
  </div>
);
