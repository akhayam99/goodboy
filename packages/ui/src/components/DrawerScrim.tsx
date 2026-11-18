import { cn } from '../cn';
import { drawerAsideWidthOf } from '../drawerGeometry';
import { dismissTopEscapeLayer } from '../escape';
import type { SheetEdge } from '../sheet';

const SCRIM_RADIUS: Readonly<Record<SheetEdge, string>> = {
  wrapped: 'rounded-l-frame',
  flush: '',
  pushed: 'rounded-frame',
};

type Props = {
  readonly isSheet: boolean;
  readonly sheetState: SheetEdge;
  readonly isAnyExiting: boolean;
  readonly isOverlay: boolean;
  readonly isOverlayExit: boolean;
  readonly isResumed: boolean;
  readonly railWidth: number;
};

export const DrawerScrim = ({
  isSheet,
  sheetState,
  isAnyExiting,
  isOverlay,
  isOverlayExit,
  isResumed,
  railWidth,
}: Props) => (
  <>
    <div
      aria-hidden
      data-drawer-scrim=""
      onMouseDown={isAnyExiting ? undefined : (event) => event.preventDefault()}
      onClick={isAnyExiting ? undefined : () => dismissTopEscapeLayer()}
      className={cn(
        'absolute inset-0 z-10 bg-scrim',
        isSheet && SCRIM_RADIUS[sheetState],
        isOverlayExit && !isOverlay && 'pointer-events-none animate-drawer-fade-out',
        !isOverlayExit && !isResumed && 'motion-safe:animate-fade-in',
      )}
    />
    <div
      aria-hidden
      data-drawer-spacer=""
      style={{ width: drawerAsideWidthOf({ width: 0, mode: 'closed', railWidth }) }}
      className="shrink-0"
    />
  </>
);
