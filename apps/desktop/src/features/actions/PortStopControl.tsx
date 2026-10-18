import { Button, Tooltip } from '@goodboy/ui';
import { ActionConfirmPanel } from './components/ActionControls/ActionConfirmPanel';
import { portAnchorKey } from './portAnchorKey';
import type { PortActionTarget } from './types';
import { useActionControls } from './useActionControls';

type Props = {
  readonly target: PortActionTarget;
};

export const PortStopControl = ({ target }: Props) => {
  const controls = useActionControls({ target, anchorKey: portAnchorKey({ target }) });
  const stop = controls.actions.find((action) => action.id === 'port.stop') ?? null;
  const force = controls.actions.find((action) => action.id === 'port.forceStop') ?? null;
  const name = target.facts.holder?.name ?? '';
  const failure = controls.failure;

  const body = (() => {
    if (failure !== null) {
      return (
        <Tooltip content={failure.message}>
          <Button size="xs" variant="ghost-danger" onClick={controls.retry}>
            Retry
          </Button>
        </Tooltip>
      );
    }
    if (stop !== null && stop.blockedReason !== null) {
      return (
        <span role="status" className="text-meta text-faint-foreground">
          {stop.blockedReason}
        </span>
      );
    }
    if (stop === null && force !== null && force.description !== null) {
      return (
        <Tooltip content={force.description}>
          <Button
            size="xs"
            variant="ghost-danger"
            aria-label={`${force.label} ${name}`}
            aria-haspopup="dialog"
            aria-expanded={controls.confirming?.id === force.id}
            onClick={() => controls.trigger({ actionId: force.id })}
          >
            {force.label}
          </Button>
        </Tooltip>
      );
    }
    if (stop === null) {
      return null;
    }
    return (
      <span className="row-actions flex">
        <Button
          size="xs"
          variant="ghost"
          aria-label={`${stop.label} ${name}`}
          aria-haspopup="dialog"
          aria-expanded={controls.confirming?.id === stop.id}
          onClick={() => controls.trigger({ actionId: stop.id })}
        >
          {stop.label}
        </Button>
      </span>
    );
  })();

  return (
    <>
      {body}
      <span className="absolute bottom-0 right-0 size-0">
        <ActionConfirmPanel controls={controls} />
      </span>
    </>
  );
};
