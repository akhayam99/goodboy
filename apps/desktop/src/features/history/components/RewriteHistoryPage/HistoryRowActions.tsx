import { Button } from '@goodboy/ui';
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
    <span className="pointer-events-none absolute right-1.5 top-2 flex items-center gap-0.5 rounded-lg border border-border-soft bg-elevated p-0.5 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
      {controls.inSlot({ slot: 'hover' }).map((action) => (
        <Button
          key={action.id}
          size="sm"
          variant="ghost"
          title={action.blockedReason ?? action.description ?? undefined}
          disabled={action.blockedReason !== null}
          onClick={() => controls.trigger({ actionId: action.id })}
        >
          <action.icon size={ICON_SIZE.row} aria-hidden />
          {action.label}
        </Button>
      ))}
      <ObjectOverflowMenu
        target={target}
        anchorKey={anchorKey}
        label={`More for ${target.facts.shortSha}`}
      />
    </span>
  );
};
