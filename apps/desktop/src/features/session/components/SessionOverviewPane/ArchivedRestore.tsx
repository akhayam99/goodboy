import { Button, Chip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionArchive } from '../../hooks/useSessionArchive';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';

type Props = {
  readonly session: Session;
};

const RESTORE_KEY = 'restore';

export const ArchivedRestore = ({ session }: Props) => {
  const { restore } = useSessionArchive();
  const pending = usePendingAction({ sessionId: session.id });
  return (
    <>
      <Chip
        tone="neutral"
        shape="badge"
        kind="reference"
        icon={<CONCEPT_ICONS.archive size={ICON_SIZE.row} aria-hidden />}
        label="Archived"
      />
      <Button
        variant="secondary"
        size="sm"
        isBusy={pending.pendingKeys.has(RESTORE_KEY)}
        onClick={() =>
          void pending.run({
            key: RESTORE_KEY,
            failureTitle: "Couldn't restore the session",
            task: () => restore({ sessions: [session] }),
          })
        }
      >
        <CONCEPT_ICONS.restore size={ICON_SIZE.row} aria-hidden />
        Restore
      </Button>
    </>
  );
};
