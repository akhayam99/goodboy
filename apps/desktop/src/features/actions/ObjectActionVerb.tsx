import { useState } from 'react';
import { Button, ICON_SIZE, Tooltip } from '@goodboy/ui';

import { ArmedActionPopover } from '../../shared/components/HeaderConfirm/ArmedActionPopover';
import type { ArmedAction } from '../../shared/components/HeaderConfirm/armedAction';
import { useActionEnv } from './useActionEnv';
import { useObjectActions } from './useObjectActions';
import type { ObjectTarget } from './types';

type Props = {
  readonly target: ObjectTarget;
  readonly actionId: string;
};

export const ObjectActionVerb = ({ target, actionId }: Props) => {
  const env = useActionEnv({ origin: 'button' });
  const { actions, run } = useObjectActions({ target, env });
  const [armed, setArmed] = useState<ArmedAction | null>(null);
  const action = actions.find((candidate) => candidate.id === actionId) ?? null;
  if (action === null) {
    return null;
  }
  const isBlocked = action.blockedReason !== null;
  const Logo = action.icon;
  const press = () => {
    if (action.confirm === null) {
      void run({ actionId });
      return;
    }
    setArmed({ action, run: () => run({ actionId }) });
  };
  const verb = (
    <Button
      variant="quiet"
      size="sm"
      disabled={isBlocked}
      aria-label={action.ariaLabel ?? undefined}
      aria-haspopup={action.confirm === null ? undefined : 'dialog'}
      aria-expanded={action.confirm === null ? undefined : armed !== null}
      onClick={press}
    >
      {action.ariaLabel === null ? null : <Logo size={ICON_SIZE.control} aria-hidden />}
      {action.label}
    </Button>
  );
  const trigger = () =>
    action.blockedReason === null ? verb : <Tooltip content={action.blockedReason}>{verb}</Tooltip>;
  return <ArmedActionPopover armed={armed} onClose={() => setArmed(null)} trigger={trigger} />;
};
