import { Pin } from 'lucide-react';
import { IconButton, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { ScriptActionTarget } from '../../../actions/types';

const REVEAL = cn(
  'flex w-7 shrink-0 items-center justify-center',
  'invisible opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100',
);

type Props = {
  readonly name: string;
  readonly scriptKey: string;
  readonly target: ScriptActionTarget;
  readonly isPinned: boolean;
  readonly onTogglePin: () => void;
};

export const RowActions = ({ name, scriptKey, target, isPinned, onTogglePin }: Props) => (
  <>
    <span data-reveal="hover" className={REVEAL}>
      <IconButton
        size="xs"
        variant="ghost"
        icon={Pin}
        iconSize={ICON_SIZE.row}
        label={isPinned ? `Unpin ${name}` : `Pin ${name}`}
        aria-pressed={isPinned}
        tone={isPinned ? 'primary' : 'neutral'}
        onClick={onTogglePin}
      />
    </span>
    <span data-reveal="hover" className={REVEAL}>
      <ObjectOverflowMenu
        target={target}
        label={`More for ${name}`}
        anchorKey={`script:${scriptKey}`}
      />
    </span>
  </>
);
