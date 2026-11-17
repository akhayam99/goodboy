import { CardAction } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { usePendingAction } from '../../../../../shared/hooks/usePendingAction';

const RESTORE_KEY = 'restore-session';

type Props = {
  readonly session: Session;
  readonly onRestore?: (session: Session) => Promise<void>;
};

export const RestoreCardAction = ({ session, onRestore }: Props) => {
  const { pendingKeys, run } = usePendingAction({ sessionId: session.id as SessionId });
  return (
    <CardAction
      icon={CONCEPT_ICONS.restore}
      tone="primary"
      label="Restore"
      isBusy={pendingKeys.has(RESTORE_KEY)}
      onClick={() => {
        if (onRestore === undefined) {
          return;
        }
        void run({
          key: RESTORE_KEY,
          failureTitle: "Couldn't restore the session",
          task: () => onRestore(session),
        });
      }}
    />
  );
};
