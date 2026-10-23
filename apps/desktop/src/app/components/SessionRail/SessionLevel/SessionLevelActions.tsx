import { useMemo } from 'react';
import { Pin } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { ObjectOverflowMenu } from '../../../../features/actions/ObjectOverflowMenu';
import type { ObjectTarget } from '../../../../features/actions/types';
import { ArmedActionPopover } from '../../../../shared/components/HeaderConfirm/ArmedActionPopover';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/names';
import type { ActionControls } from '../../../../features/actions/useActionControls';
import { useSessionRefresh } from '../../../../features/session/hooks/useSessionRefresh';
import { PRESSED_TOGGLE } from '../../../../shared/components/pressedToggle';

type Props = {
  readonly session: Session;
  readonly controls: ActionControls;
};

const PIN_IDS: ReadonlySet<string> = new Set(['session.pin', 'session.unpin']);

export const SessionLevelActions = ({ session, controls }: Props) => {
  const sessionId = session.id;
  const refresh = useSessionRefresh();
  const isRefreshing = useAppStore((state) => state.sessionSyncing[sessionId] === true);
  const pin = controls.actions.find((action) => PIN_IDS.has(action.id)) ?? null;
  const target = useMemo<ObjectTarget>(() => ({ kind: 'session', sessionId }), [sessionId]);
  const menu = (
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
          onArm={({ action }) => controls.trigger({ actionId: action.id })}
        />
      )}
    />
  );
  if (session.archivedAt != null) {
    return (
      <div data-session-actions="" className="flex shrink-0 items-center gap-1">
        {menu}
      </div>
    );
  }
  return (
    <div data-session-actions="" className="flex shrink-0 items-center gap-1">
      {pin === null ? null : (
        <IconButton
          icon={Pin}
          label={NAMES.pin}
          tooltip={pin.label}
          aria-pressed={pin.id === 'session.unpin'}
          busy={controls.pendingId === pin.id}
          className={PRESSED_TOGGLE}
          data-session-action="pin"
          onClick={() => controls.trigger({ actionId: pin.id })}
        />
      )}
      <IconButton
        icon={CONCEPT_ICONS.refresh}
        label="Refresh session"
        tooltip={isRefreshing ? 'Refreshing' : 'Refresh session'}
        shortcut="session.refresh"
        busy={isRefreshing}
        data-session-action="refresh"
        onClick={() => void refresh({ sessionId })}
      />
      {menu}
    </div>
  );
};
