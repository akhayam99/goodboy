import { useState, type ReactNode } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, HeaderActions, ICON_SIZE } from '@goodboy/ui';

import { ArmedActionPopover } from '../../../../shared/components/HeaderConfirm/ArmedActionPopover';
import type { ArmedAction } from '../../../../shared/components/HeaderConfirm/armedAction';
import { ObjectOverflowMenu } from '../../../actions/ObjectOverflowMenu';
import type { NotificationsFacts } from '../../../actions/kinds/notifications';
import type { NotificationsActionTarget } from '../../../actions/types';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { runVerb } from '../../runVerb';

type Props = {
  readonly facts: NotificationsFacts;
  readonly filter: ReactNode;
};

const MARK_ALL_READ = 'notifications.markAllRead';

export const NotificationsHeaderActions = ({ facts, filter }: Props) => {
  const [armed, setArmed] = useState<ArmedAction | null>(null);
  const target: NotificationsActionTarget = { kind: 'notifications', facts };
  const env = useActionEnv({ origin: 'button' });
  const { actions, run } = useObjectActions({ target, env });
  const markAllRead = actions.find((action) => action.id === MARK_ALL_READ) ?? null;

  return (
    <HeaderActions
      secondary={filter}
      button={
        markAllRead === null ? null : (
          <Button
            variant="ghost"
            size="sm"
            disabled={markAllRead.blockedReason !== null || markAllRead.isBusy}
            onClick={() => void runVerb({ actionId: MARK_ALL_READ, run, env })}
          >
            <CheckCheck size={ICON_SIZE.row} aria-hidden />
            {markAllRead.label}
          </Button>
        )
      }
      overflow={
        actions.length > 0 ? (
          <ArmedActionPopover
            armed={armed}
            onClose={() => setArmed(null)}
            trigger={() => (
              <ObjectOverflowMenu
                target={target}
                label="More notification actions"
                size="control"
                onArm={setArmed}
              />
            )}
          />
        ) : null
      }
    />
  );
};
