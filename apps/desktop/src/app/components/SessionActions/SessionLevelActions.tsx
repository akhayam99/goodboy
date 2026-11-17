import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { ObjectOverflowMenu } from '../../../features/actions/ObjectOverflowMenu';
import type { ObjectTarget } from '../../../features/actions/types';
import { ArmedActionPopover } from '../../../shared/components/HeaderConfirm/ArmedActionPopover';
import type { ActionControls } from '../../../features/actions/useActionControls';
import { sessionMenuOf } from './sessionMenuOf';

type Props = {
  readonly session: Session;
  readonly controls: ActionControls;
};

export const SessionLevelActions = ({ session, controls }: Props) => {
  const sessionId = session.id;
  const target = useMemo<ObjectTarget>(() => ({ kind: 'session', sessionId }), [sessionId]);
  const only = sessionMenuOf({ isArchived: session.archivedAt != null });
  return (
    <div data-session-actions="" className="flex shrink-0 items-center gap-1">
      <ArmedActionPopover
        armed={
          controls.confirming === null
            ? null
            : { action: controls.confirming, run: () => controls.confirm() }
        }
        onClose={controls.cancel}
        trigger={() => (
          <ObjectOverflowMenu
            target={target}
            label="More session actions"
            size="control"
            side="bottom"
            only={only}
            track={async ({ actionId }) => controls.trigger({ actionId })}
            onArm={({ action }) => controls.trigger({ actionId: action.id })}
          />
        )}
      />
    </div>
  );
};
