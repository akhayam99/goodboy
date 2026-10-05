import { IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { useActionControls } from '../../../actions/useActionControls';
import type { CommitActionTarget } from '../../../actions/types';

type Props = {
  readonly target: CommitActionTarget;
  readonly anchorKey: string;
};

export const HistoryRowActions = ({ target, anchorKey }: Props) => {
  const controls = useActionControls({ target, anchorKey });
  return (
    <span className="pointer-events-none flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
      {controls.inSlot({ slot: 'hover' }).map((action) => (
        <IconButton
          key={action.id}
          icon={action.icon}
          iconSize={ICON_SIZE.row}
          label={action.label}
          tooltip={action.blockedReason ?? action.description ?? action.label}
          variant="ghost"
          disabled={action.blockedReason !== null}
          onClick={() => controls.trigger({ actionId: action.id })}
        />
      ))}
      <ObjectOverflowMenu
        target={target}
        anchorKey={anchorKey}
        label={`More for ${target.facts.shortSha}`}
      />
    </span>
  );
};
