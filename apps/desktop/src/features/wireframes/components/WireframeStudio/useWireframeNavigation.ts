import { useCallback, useEffect, useState } from 'react';
import type { WireframeDocument } from '@goodboy/core';

export type WireframeNavigation = Readonly<{
  currentScreenId: string;
  selectedNodeId: string | null;
  zoom: number;
  isZoomPinned: boolean;
  mockState: Readonly<Record<string, boolean>>;
  canGoBack: boolean;
  canGoForward: boolean;
  goTo: (screenId: string) => void;
  goBack: () => void;
  goForward: () => void;
  goPrevious: () => void;
  goNext: () => void;
  select: (nodeId: string) => void;
  toggle: (stateKey: string) => void;
  setZoom: (zoom: number) => void;
  fitZoom: (zoom: number) => void;
}>;

export const ZOOM_BOUNDS = { min: 0.25, max: 1.5 } as const;

type Trail = Readonly<{ entries: ReadonlyArray<string>; cursor: number }>;

const clampZoom = (zoom: number): number =>
  Math.min(ZOOM_BOUNDS.max, Math.max(ZOOM_BOUNDS.min, Math.round(zoom * 100) / 100));

export const useWireframeNavigation = ({
  document,
  resetKey,
}: {
  readonly document: WireframeDocument;
  readonly resetKey: string;
}): WireframeNavigation => {
  const [trail, setTrail] = useState<Trail>({ entries: [document.initialScreenId], cursor: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoomState] = useState(1);
  const [isZoomPinned, setIsZoomPinned] = useState(false);
  const [mockState, setMockState] = useState<Readonly<Record<string, boolean>>>(
    document.mockState ?? {},
  );

  useEffect(() => {
    setTrail({ entries: [document.initialScreenId], cursor: 0 });
    setSelectedNodeId(null);
    setIsZoomPinned(false);
    setMockState(document.mockState ?? {});
  }, [resetKey, document.initialScreenId, document.mockState]);

  const currentScreenId = trail.entries[trail.cursor] ?? document.initialScreenId;
  const order = document.screens.findIndex((screen) => screen.id === currentScreenId);

  const goTo = useCallback((screenId: string) => {
    setTrail((previous) => {
      if (previous.entries[previous.cursor] === screenId) {
        return previous;
      }
      const trimmed = previous.entries.slice(0, previous.cursor + 1);
      return { entries: [...trimmed, screenId], cursor: trimmed.length };
    });
  }, []);

  const goBack = useCallback(() => {
    setTrail((previous) =>
      previous.cursor > 0 ? { ...previous, cursor: previous.cursor - 1 } : previous,
    );
  }, []);

  const goForward = useCallback(() => {
    setTrail((previous) =>
      previous.cursor < previous.entries.length - 1
        ? { ...previous, cursor: previous.cursor + 1 }
        : previous,
    );
  }, []);

  const goPrevious = useCallback(() => {
    const target = document.screens[order - 1];
    if (target !== undefined) {
      goTo(target.id);
    }
  }, [document.screens, order, goTo]);

  const goNext = useCallback(() => {
    const target = document.screens[order + 1];
    if (target !== undefined) {
      goTo(target.id);
    }
  }, [document.screens, order, goTo]);

  const toggle = useCallback((stateKey: string) => {
    setMockState((previous) => ({ ...previous, [stateKey]: previous[stateKey] !== true }));
  }, []);

  const setZoom = useCallback((next: number) => {
    setZoomState(clampZoom(next));
    setIsZoomPinned(true);
  }, []);

  const fitZoom = useCallback((next: number) => {
    setZoomState(clampZoom(next));
    setIsZoomPinned(false);
  }, []);

  return {
    currentScreenId,
    selectedNodeId,
    zoom,
    isZoomPinned,
    mockState,
    canGoBack: trail.cursor > 0,
    canGoForward: trail.cursor < trail.entries.length - 1,
    goTo,
    goBack,
    goForward,
    goPrevious,
    goNext,
    select: setSelectedNodeId,
    toggle,
    setZoom,
    fitZoom,
  };
};
