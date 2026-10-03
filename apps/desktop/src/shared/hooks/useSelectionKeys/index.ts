import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { registerSelectionSurface } from '../../keyboard/selectionSurfaces';

type Params = {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly hasSelection: boolean;
  readonly onToggle: (id: string) => void;
  readonly onSelectAll: () => void;
  readonly onDelete?: () => void;
  readonly isEnabled?: boolean;
};

export const useSelectionKeys = ({
  containerRef,
  hasSelection,
  onToggle,
  onSelectAll,
  onDelete,
  isEnabled = true,
}: Params): void => {
  const latest = useRef({ hasSelection, onToggle, onSelectAll, onDelete });
  latest.current = { hasSelection, onToggle, onSelectAll, onDelete };
  const surface = useMemo(() => ({ containerRef, latest }), [containerRef]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    return registerSelectionSurface(surface);
  }, [isEnabled, surface]);
};
