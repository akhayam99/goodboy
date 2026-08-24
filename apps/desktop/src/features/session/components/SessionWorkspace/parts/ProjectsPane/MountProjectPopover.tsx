import { Plus } from 'lucide-react';
import { AnchoredPopover, useDropdown } from '@goodboy/ui';
import type { Project, SessionId } from '@goodboy/types';
import { MountProjectList } from './MountProjectList';

type Props = {
  readonly sessionId: SessionId;
  readonly projects: ReadonlyArray<Project>;
};

export const MountProjectPopover = ({ sessionId, projects }: Props) => {
  const dropdown = useDropdown({ expectedHeight: 280, width: 'w-72' });
  const { open, toggle, close } = dropdown;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Mount another project"
      trigger={
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={toggle}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border-soft px-3 py-2 text-left text-xs leading-5 text-muted-foreground motion-safe:transition-colors hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Plus size={13} aria-hidden className="shrink-0" />
          Mount another project
        </button>
      }
    >
      <MountProjectList sessionId={sessionId} projects={projects} onDone={close} />
    </AnchoredPopover>
  );
};
