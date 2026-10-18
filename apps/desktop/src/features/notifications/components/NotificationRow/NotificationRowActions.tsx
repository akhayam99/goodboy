import { IconButton } from '@goodboy/ui';
import { ObjectOverflowMenu } from '../../../actions/ObjectOverflowMenu';
import type { NotificationActionTarget } from '../../../actions/types';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { runVerb } from '../../runVerb';

type Props = {
  readonly target: NotificationActionTarget;
  readonly anchorKey: string;
};

export const NotificationRowActions = ({ target, anchorKey }: Props) => {
  const env = useActionEnv({ origin: 'button', anchorKey });
  const { actions, run } = useObjectActions({ target, env });
  const hover = actions.filter((action) => action.slot === 'hover');
  return (
    <span
      data-slot="notification-row-actions"
      className="row-actions relative flex items-center justify-end gap-0.5"
    >
      {hover.map((action) => (
        <IconButton
          key={action.id}
          icon={action.icon}
          label={action.label}
          size="xs"
          disabled={action.isBusy}
          onClick={() => void runVerb({ actionId: action.id, run, env })}
        />
      ))}
      <ObjectOverflowMenu
        target={target}
        label={`Actions for "${target.facts.title}"`}
        anchorKey={anchorKey}
        hideWhenEmpty
      />
    </span>
  );
};
