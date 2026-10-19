import type { ComponentProps } from 'react';
import { Plus } from 'lucide-react';
import { IconButton, cn } from '@goodboy/ui';
import { LEVEL_ADD_SIZE } from './levelAddSize';

type Props = Omit<
  ComponentProps<typeof IconButton>,
  'icon' | 'label' | 'size' | 'aria-haspopup' | 'aria-expanded'
> & {
  readonly ariaLabel: string;
  readonly isExpanded: boolean;
};

export const LevelAddTrigger = ({ ariaLabel, isExpanded, tooltip, className, ...rest }: Props) => (
  <IconButton
    {...rest}
    className={cn(LEVEL_ADD_SIZE, className)}
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
