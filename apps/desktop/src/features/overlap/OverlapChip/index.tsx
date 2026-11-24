import { useMemo } from 'react';
import { AnchoredPopover, Chip, useDropdown } from '@goodboy/ui';
import type { MountId } from '@goodboy/types';
import { MergeStepRow } from './MergeStepRow';
import { OverlapActions } from './OverlapActions';
import { SharedFiles } from './SharedFiles';
import { overlapGroupOf } from '../overlapGroupOf';
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
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    expectedWidth: 384,
    expectedHeight: 280,
  });
  const group = useMemo(() => overlapGroupOf({ mounts, mountId }), [mounts, mountId]);
  const sessionIds = useMemo(
    () => (group === null ? [] : [...new Set(group.steps.map((step) => step.mount.sessionId))]),
    [group],
  );
  const { labels: sessionLabels, titles: sessionTitles } = useSessionLabels({ sessionIds });
  if (group === null || (placement === 'queue' && group.steps[0]?.isOwn === true)) {
    return null;
  }
  const words = overlapWordsOf({ group, sessionLabels });

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={words.title}
      className="gap-3 p-3"
      anchorClassName="pointer-events-auto flex min-w-0 max-w-48 shrink"
      trigger={
        <Chip
          as="button"
          tone="warning"
          kind="reference"
          label={<span className="min-w-0 truncate">{words.chip}</span>}
          ariaLabel={words.chip}
          hasPopup="dialog"
          expanded={dropdown.open}
          onClick={dropdown.toggle}
          className="min-w-0 max-w-full"
        />
      }
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-heading text-foreground">{words.title}</h2>
        <p className="text-meta text-muted-foreground">{words.lead}</p>
      </div>
      <ol aria-label="Merge order" className="flex min-w-0 flex-col gap-2">
        {group.steps.map((step, index) => (
          <MergeStepRow
            key={step.mount.mountId}
            step={step}
            position={index + 1}
            title={sessionTitles.get(step.mount.sessionId) ?? ''}
            reason={words.reasons[index] ?? ''}
          />
        ))}
      </ol>
      <SharedFiles paths={group.sharedPaths} label={words.shared} />
      <OverlapActions group={group} onDone={dropdown.close} />
    </AnchoredPopover>
  );
};
