import { Pin } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { ScriptActionTarget } from '../../../actions/types';

const REVEAL = 'flex w-7 shrink-0 items-center justify-center';

type Props = {
  readonly name: string;
  readonly scriptKey: string;
  readonly target: ScriptActionTarget;
  readonly isPinned: boolean;
  readonly onTogglePin: () => void;
};

export const RowActions = ({ name, scriptKey, target, isPinned, onTogglePin }: Props) => (
  <>
    <span data-row-secondary="" className={REVEAL}>
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
    <span data-row-secondary="" className={REVEAL}>
      <ObjectOverflowMenu
        target={target}
        label={`More for ${name}`}
        anchorKey={`script:${scriptKey}`}
      />
    </span>
  </>
);
