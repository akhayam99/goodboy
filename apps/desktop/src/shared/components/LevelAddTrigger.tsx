import type { ComponentProps } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from './conceptIcons';

type Props = Omit<ComponentProps<'button'>, 'type' | 'children'> & {
  readonly ariaLabel: string;
  readonly isExpanded: boolean;
};

export const LevelAddTrigger = ({ ariaLabel, isExpanded, ...rest }: Props) => (
  <Button
    {...rest}
    variant="quiet"
    size="xs"
    aria-label={ariaLabel}
    aria-haspopup="dialog"
    aria-expanded={isExpanded}
    data-level-add
  >
    <Plus size={ICON_SIZE.row} aria-hidden />
    Add
  </Button>
);
