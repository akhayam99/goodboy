import { useState } from 'react';
import { ArmedActionPopover } from '../../shared/components/HeaderConfirm/ArmedActionPopover';
import type { ArmedAction } from '../../shared/components/HeaderConfirm/armedAction';
import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { NotificationsFacts } from './kinds/notifications';

type Props = {
  readonly facts: NotificationsFacts;
};

export const NotificationsMenu = ({ facts }: Props) => {
  const [armed, setArmed] = useState<ArmedAction | null>(null);
  return (
    <ArmedActionPopover
      armed={armed}
      onClose={() => setArmed(null)}
      trigger={() => (
        <ObjectOverflowMenu
          label="More notification actions"
          size="control"
          target={{ kind: 'notifications', facts }}
          onArm={setArmed}
        />
      )}
    />
  );
};
