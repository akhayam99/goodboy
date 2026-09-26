import { Eye } from 'lucide-react';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

export const RevealedRowTag = () => (
  <span className="ml-auto flex shrink-0 items-center gap-1 text-2xs text-muted-foreground">
    <Eye size={ICON_SIZE.row} aria-hidden className="shrink-0" />
    Shown because you started it
  </span>
);
