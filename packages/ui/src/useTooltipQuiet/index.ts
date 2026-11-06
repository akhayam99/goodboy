import { useContext, type RefObject } from 'react';
import { hoverSurfaces } from '../hoverSurfaceStore';
import { TooltipTriggerContext } from '../tooltipTriggerContext';
import { useHoverSurfaceCount } from '../useHoverSurfaceCount';

type Params = {
  readonly isSuppressed: boolean;
  readonly anchorRef: RefObject<HTMLElement | null>;
};

type Quiet = {
  readonly isNested: boolean;
  readonly isQuiet: boolean;
  readonly isQuietNow: () => boolean;
};

export const useTooltipQuiet = ({ isSuppressed, anchorRef }: Params): Quiet => {
  const isNested = useContext(TooltipTriggerContext);
  const surfaceCount = useHoverSurfaceCount();
  const isCovered = () =>
    hoverSurfaces.count() > 0 && !hoverSurfaces.isInside({ anchor: anchorRef.current });
  return {
    isNested,
    isQuiet: isSuppressed || isNested || (surfaceCount > 0 && isCovered()),
    isQuietNow: () => isSuppressed || isNested || isCovered(),
  };
};
