import { PanelRightOpen } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { DiffStatText } from '../../../../shared/components/DiffStatText';
import type { FilesFact } from '../../filesFact';

type Props = {
  readonly fact: FilesFact;
  readonly onOpen: () => void;
};

export const FilesToggle = ({ fact, onOpen }: Props) => (
  <Button size="sm" variant="quiet" onClick={onOpen}>
    <PanelRightOpen size={ICON_SIZE.row} aria-hidden />
    Files
    <span className="flex items-center gap-1 tabular-nums text-faint-foreground">
      {fact.text}
      {fact.diff === null ? null : <DiffStatText diff={fact.diff} />}
    </span>
  </Button>
);
