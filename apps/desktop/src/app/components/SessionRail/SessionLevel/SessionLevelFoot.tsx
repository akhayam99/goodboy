import { useState } from 'react';
import { IconButton } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { ActionStatusLine } from '../../../../features/actions/components/ActionControls/ActionStatusLine';
import type { ActionControls } from '../../../../features/actions/useActionControls';
import { DeleteSessionConfirm } from '../../../../features/session/components/DeleteSessionConfirm';
import { SessionCostChip } from '../../../../features/session/components/SessionOverviewPane/SessionCostChip';
import { ArmedActionPopover } from '../../../../shared/components/HeaderConfirm/ArmedActionPopover';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly session: Session;
  readonly controls: ActionControls;
};

const LIFECYCLE_IDS: ReadonlySet<string> = new Set(['session.archive', 'session.restore']);

export const SessionLevelFoot = ({ session, controls }: Props) => {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const lifecycle = controls.actions.find((action) => LIFECYCLE_IDS.has(action.id)) ?? null;
  const isFailed = lifecycle !== null && controls.failure?.actionId === lifecycle.id;
  const confirming =
    controls.confirming !== null && LIFECYCLE_IDS.has(controls.confirming.id)
      ? controls.confirming
      : null;
  const isArchive = lifecycle?.id === 'session.archive';
  return (
    <div className="flex shrink-0 flex-col gap-1 px-2">
      {isFailed ? <ActionStatusLine controls={controls} showReasons={false} /> : null}
      <div
        role="group"
        aria-label="Session"
        data-session-foot=""
        className="flex min-w-0 items-center gap-1"
      >
        <div className="flex min-w-0 flex-1">
          <SessionCostChip sessionId={session.id} />
        </div>
        {lifecycle === null ? null : (
          <ArmedActionPopover
            armed={
              confirming === null ? null : { action: confirming, run: () => controls.confirm() }
            }
            onClose={controls.cancel}
            trigger={() => (
              <IconButton
                icon={isArchive ? CONCEPT_ICONS.archive : CONCEPT_ICONS.restore}
                label={isArchive ? 'Archive session' : 'Restore session'}
                {...(lifecycle.shortcut !== null && { shortcut: lifecycle.shortcut })}
                isTooltipSuppressed={confirming !== null}
                size="sm"
                busy={controls.pendingId === lifecycle.id}
                aria-haspopup={isArchive ? 'dialog' : undefined}
                aria-expanded={isArchive ? confirming !== null : undefined}
                data-session-foot-action={lifecycle.id}
                onClick={() => controls.trigger({ actionId: lifecycle.id })}
              />
            )}
          />
        )}
        <DeleteSessionConfirm
          session={session}
          isOpen={isDeleteOpen}
          anchorClassName="flex shrink-0"
          onClose={() => setIsDeleteOpen(false)}
          trigger={() => (
            <IconButton
              icon={CONCEPT_ICONS.delete}
              label="Delete session"
              shortcut="session.delete"
              isTooltipSuppressed={isDeleteOpen}
              size="sm"
              tone="danger"
              aria-haspopup="dialog"
              aria-expanded={isDeleteOpen}
              data-session-foot-action="session.delete"
              onClick={() => setIsDeleteOpen(true)}
            />
          )}
        />
      </div>
    </div>
  );
};
