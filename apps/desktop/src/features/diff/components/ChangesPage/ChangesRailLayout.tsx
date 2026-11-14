import type { ReactNode } from 'react';
import { StudioRailLayout } from '@goodboy/ui';
import type { ChangesMode } from '../../hooks/useChangesMode';
import type { FilesFact } from '../../filesFact';
import { CHANGES_RAIL_SURFACE } from '../../changesRailSurface';
import { ModeControl } from '../ChangeTree/ModeControl';

type Props = {
  readonly isFramed: boolean;
  readonly isCollapsed: boolean;
  readonly onCollapsedChange: (isCollapsed: boolean) => void;
  readonly hasHeader: boolean;
  readonly mode: ChangesMode;
  readonly onMode: (mode: ChangesMode) => void;
  readonly count: number;
  readonly fact: FilesFact;
  readonly rail: ReactNode | null;
  readonly onRailBody: (node: HTMLDivElement | null) => void;
  readonly detail: ReactNode;
};

const RAIL_MAX_PX = 560;

export const ChangesRailLayout = ({
  isFramed,
  isCollapsed,
  onCollapsedChange,
  hasHeader,
  mode,
  onMode,
  count,
  fact,
  rail,
  onRailBody,
  detail,
}: Props) => (
  <StudioRailLayout
    railLabel="Files"
    railWidth={isFramed ? 'wide' : 'standard'}
    {...(isFramed && { max: RAIL_MAX_PX })}
    surface={CHANGES_RAIL_SURFACE}
    placement="page"
    isCollapsed={isCollapsed}
    onCollapsedChange={onCollapsedChange}
    railHeader={
      hasHeader ? <ModeControl mode={mode} onMode={onMode} count={count} fact={fact} /> : null
    }
    rail={
      rail === null ? null : (
        <div ref={onRailBody} className="flex min-h-0 flex-1 flex-col">
          {rail}
        </div>
      )
    }
    detail={detail}
  />
);
