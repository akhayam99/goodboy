import { Button, Chip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionArchive } from '../../hooks/useSessionArchive';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly session: Session;
};

export const ArchivedRestore = ({ session }: Props) => {
  const { restore } = useSessionArchive();
  return (
    <>
      <Chip
        tone="neutral"
        shape="badge"
        size="control"
        icon={<CONCEPT_ICONS.archive size={ICON_SIZE.row} aria-hidden />}
        label="Archived"
      />
      <Button variant="secondary" size="sm" onClick={() => void restore({ sessions: [session] })}>
        <CONCEPT_ICONS.restore size={ICON_SIZE.row} aria-hidden />
        Restore
      </Button>
    </>
  );
};
