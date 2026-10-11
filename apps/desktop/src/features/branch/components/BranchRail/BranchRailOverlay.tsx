import type { ReactNode } from 'react';
import { Eyebrow, readStudioRailWidth } from '@goodboy/ui';
import { BRANCH_RAIL_SURFACE } from '../../branchRailSurface';

type Props = {
  readonly rail: ReactNode;
  readonly onClose: () => void;
};

export const BranchRailOverlay = ({ rail, onClose }: Props) => (
  <>
    <div
      aria-hidden
      data-branch-rail-scrim=""
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClose}
      className="absolute inset-0 z-10 bg-scrim motion-safe:animate-fade-in"
    />
    <aside
      aria-label="Branch sections"
      data-branch-rail="overlay"
      style={{
        width: readStudioRailWidth({ surface: BRANCH_RAIL_SURFACE, railWidth: 'standard' }),
        maxWidth: 'calc(100% - 48px)',
      }}
      className="absolute inset-y-0 left-0 z-20 flex min-h-0 flex-col bg-background shadow-xl"
    >
      <div className="flex shrink-0 items-center px-2 pt-3">
        <div className="flex h-6 min-w-0 flex-1 items-center px-2">
          <Eyebrow label="Sections" muted />
        </div>
      </div>
      {rail}
    </aside>
  </>
);
