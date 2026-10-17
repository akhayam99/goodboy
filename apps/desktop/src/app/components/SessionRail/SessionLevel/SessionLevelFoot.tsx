import { useState } from 'react';
import { Button, Tooltip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ActionControls } from '../../../../features/actions/useActionControls';
import { DeleteSessionConfirm } from '../../../../features/session/components/DeleteSessionConfirm';

type Props = {
  readonly session: Session;
  readonly controls: ActionControls;
};

const LIFECYCLE_IDS: ReadonlySet<string> = new Set(['session.archive', 'session.restore']);

export const SessionLevelFoot = ({ session, controls }: Props) => {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const lifecycle = controls.actions.find((action) => LIFECYCLE_IDS.has(action.id)) ?? null;
  const LifecycleIcon = lifecycle?.icon ?? null;
  return (
    <div
      role="group"
      aria-label="Session"
      data-session-foot=""
      className="flex shrink-0 items-center gap-1 px-2"
    >
      {lifecycle === null || LifecycleIcon === null ? null : (
        <Tooltip
          content={lifecycle.id === 'session.archive' ? 'Archive session' : 'Restore session'}
          {...(lifecycle.shortcut !== null && { shortcut: lifecycle.shortcut })}
        >
          <Button
            variant="quiet"
            size="xs"
            isBusy={controls.pendingId === lifecycle.id}
            data-session-foot-action={lifecycle.id}
            onClick={() => controls.trigger({ actionId: lifecycle.id })}
          >
            <LifecycleIcon size={ICON_SIZE.row} aria-hidden />
            {lifecycle.label}
          </Button>
        </Tooltip>
      )}
      <DeleteSessionConfirm
        session={session}
        isOpen={isDeleteOpen}
        align="start"
        onClose={() => setIsDeleteOpen(false)}
        trigger={() => (
          <Tooltip content="Delete session" shortcut="session.delete" isSuppressed={isDeleteOpen}>
            <Button
              variant="quiet"
              size="xs"
              aria-haspopup="dialog"
              data-session-foot-action="session.delete"
              onClick={() => setIsDeleteOpen(true)}
            >
              <CONCEPT_ICONS.delete size={ICON_SIZE.row} aria-hidden />
              Delete…
            </Button>
          </Tooltip>
        )}
      />
    </div>
  );
};
