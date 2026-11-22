import { useMemo } from 'react';
import { AnchoredPopover, Chip, useDropdown } from '@goodboy/ui';
import type { MountId } from '@goodboy/types';
import { mergeOrderOf } from '../mergeOrderOf';
import { OverlapEntry } from './OverlapEntry';
import { overlapsOf } from '../overlapsOf';
import { overlapWordsOf } from '../overlapWordsOf';
import { useLiveMounts } from '../hooks/useLiveMounts';
import { useSessionLabels } from '../hooks/useSessionLabels';

type Props = {
  readonly mountId: MountId;
  readonly placement: 'queue' | 'session';
};

export const OverlapChip = ({ mountId, placement }: Props) => {
  const { mounts } = useLiveMounts();
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-80 max-w-[calc(100vw-2rem)]',
    expectedWidth: 320,
    expectedHeight: 140,
  });
  const overlaps = useMemo(
    () =>
      overlapsOf({ mounts, mountId }).filter(
        (overlap) => placement === 'session' || mergeOrderOf({ overlap }).then.mountId === mountId,
      ),
    [mounts, mountId, placement],
  );
  const sessionIds = useMemo(
    () => [
      ...new Set(overlaps.flatMap((overlap) => [overlap.mount.sessionId, overlap.other.sessionId])),
    ],
    [overlaps],
  );
  const sessionLabels = useSessionLabels({ sessionIds });
  const [first] = overlaps;
  if (first === undefined) {
    return null;
  }
  const chip = overlapWordsOf({ overlap: first, sessionLabels }).chip;
  const label = overlaps.length > 1 ? `${chip} +${overlaps.length - 1}` : chip;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Overlap"
      className="gap-3 p-3"
      anchorClassName="min-w-0 shrink"
      trigger={
        <Chip
          as="button"
          tone="warning"
          kind="reference"
          label={label}
          title={first.paths.join('\n')}
          hasPopup="dialog"
          expanded={dropdown.open}
          onClick={dropdown.toggle}
          className="min-w-0 truncate"
        />
      }
    >
      {overlaps.map((overlap) => (
        <OverlapEntry
          key={overlap.other.mountId}
          overlap={overlap}
          sessionLabels={sessionLabels}
          onSent={dropdown.close}
        />
      ))}
    </AnchoredPopover>
  );
};
