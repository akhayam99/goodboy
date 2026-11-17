import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { ActionStatusLine } from '../../../features/actions/components/ActionControls/ActionStatusLine';
import type { ObjectTarget } from '../../../features/actions/types';
import { useActionControls } from '../../../features/actions/useActionControls';
import { SessionLevelActions } from './SessionLevelActions';

type Props = {
  readonly session: Session;
  readonly isMenuShown?: boolean;
};

export const SessionHeaderActions = ({ session, isMenuShown = true }: Props) => {
  const sessionId = session.id;
  const target = useMemo<ObjectTarget>(() => ({ kind: 'session', sessionId }), [sessionId]);
  const controls = useActionControls({ target, scopeKey: sessionId });
  return (
    <>
      {controls.failure === null ? null : (
        <div className="min-w-0 truncate">
          <ActionStatusLine controls={controls} showReasons={false} />
        </div>
      )}
      {isMenuShown ? <SessionLevelActions session={session} controls={controls} /> : null}
    </>
  );
};
