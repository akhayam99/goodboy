import type { ComponentProps } from 'react';
import { Plus } from 'lucide-react';
import { IconButton } from '@goodboy/ui';

type Props = Omit<
  ComponentProps<typeof IconButton>,
  'icon' | 'label' | 'size' | 'aria-haspopup' | 'aria-expanded'
> & {
  readonly ariaLabel: string;
  readonly isExpanded: boolean;
};

export const LevelAddTrigger = ({ ariaLabel, isExpanded, tooltip, ...rest }: Props) => (
  <IconButton
    {...rest}
    icon={Plus}
    label={ariaLabel}
    tooltip={tooltip ?? ariaLabel}
    isTooltipSuppressed={isExpanded}
    size="xs"
    aria-haspopup="dialog"
    aria-expanded={isExpanded}
    data-level-add=""
  />
);
