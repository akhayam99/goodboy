import { X } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly name: string;
  readonly onClear: () => void;
};

export const WorkspaceFilterChip = ({ name, onClear }: Props) => (
  <div className="flex items-center gap-2 text-label text-muted-foreground">
    <span>Only folders from {name}</span>
    <Button variant="ghost" size="sm" onClick={onClear}>
      <X size={ICON_SIZE.row} aria-hidden />
      Show all
    </Button>
  </div>
);
