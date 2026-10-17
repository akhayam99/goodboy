import { useState } from 'react';
import { Button, Tooltip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { ActionStatusLine } from '../../../../features/actions/components/ActionControls/ActionStatusLine';
import type { ActionControls } from '../../../../features/actions/useActionControls';
import { DeleteSessionConfirm } from '../../../../features/session/components/DeleteSessionConfirm';
import { SessionCostChip } from '../../../../features/session/components/SessionOverviewPane/SessionCostChip';

type Props = {
  readonly session: Session;
  readonly controls: ActionControls;
};

const LIFECYCLE_IDS: ReadonlySet<string> = new Set(['session.archive', 'session.restore']);

export const SessionLevelFoot = ({ session, controls }: Props) => {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const lifecycle = controls.actions.find((action) => LIFECYCLE_IDS.has(action.id)) ?? null;
  const isFailed = lifecycle !== null && controls.failure?.actionId === lifecycle.id;
  return (
    <div className="flex shrink-0 flex-col gap-1 px-2">
      {isFailed ? <ActionStatusLine controls={controls} showReasons={false} /> : null}
      <SessionCostChip sessionId={session.id} />
      <div
        role="group"
        aria-label="Session"
        data-session-foot=""
        className="grid shrink-0 grid-cols-2 gap-1"
      >
        {lifecycle === null ? (
          <span aria-hidden />
        ) : (
          <Tooltip
            content={lifecycle.id === 'session.archive' ? 'Archive session' : 'Restore session'}
            {...(lifecycle.shortcut !== null && { shortcut: lifecycle.shortcut })}
          >
            <Button
              variant="quiet"
              size="sm"
              isBusy={controls.pendingId === lifecycle.id}
              data-session-foot-action={lifecycle.id}
              className="w-full"
              onClick={() => controls.trigger({ actionId: lifecycle.id })}
            >
              {lifecycle.label}
            </Button>
          </Tooltip>
        )}
        <DeleteSessionConfirm
          session={session}
          isOpen={isDeleteOpen}
          align="end"
          anchorClassName="flex min-w-0"
          onClose={() => setIsDeleteOpen(false)}
          trigger={() => (
            <Tooltip content="Delete session" shortcut="session.delete" isSuppressed={isDeleteOpen}>
              <Button
                variant="ghost-danger"
                size="sm"
                aria-haspopup="dialog"
                data-session-foot-action="session.delete"
                className="w-full"
                onClick={() => setIsDeleteOpen(true)}
              >
                Delete…
              </Button>
            </Tooltip>
          )}
        />
      </div>
    </div>
  );
};
