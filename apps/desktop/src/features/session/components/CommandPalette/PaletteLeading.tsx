import type { LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly accent?: string;
  readonly icon: LucideIcon;
};

export const PaletteLeading = ({ accent, icon: Icon }: Props) => (
  <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
    {accent === undefined ? (
      <Icon size={ICON_SIZE.control} className="text-muted-foreground" />
    ) : (
      <span className={cn('size-1.5 rounded-full', accent)} />
    )}
  </span>
);
