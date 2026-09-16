import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import type { WireframeAction, WireframeAdjustment, WireframeDocument } from '@goodboy/core';
import { Button, Divider, cn } from '@goodboy/ui';
import type { WireframeArtifact } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { WIREFRAME_FIDELITY_VARIANT_LABEL, type WireframeFidelity } from '../../wireframeFidelity';
import { buildWireframeIndex } from '../../wireframeIndex';
import { VIEWPORT_WIDTH, wireframePalette } from '../../wireframePalette';
import { WireframeAdjustments } from './WireframeAdjustments';
import { WireframeCanvas } from './WireframeCanvas';
import { WireframeFlowOverview } from './WireframeFlowOverview';
import { WireframeProvenanceRow } from './WireframeProvenanceRow';
import { WireframeScreenTabs } from './WireframeScreenTabs';
import { ZOOM_BOUNDS, useWireframeNavigation } from './useWireframeNavigation';

const CANVAS_GUTTER = 40;
const ZOOM_STEP = 0.1;

type Props = {
  readonly artifact: WireframeArtifact;
  readonly fidelity: WireframeFidelity;
  readonly document: WireframeDocument;
  readonly adjustments: ReadonlyArray<WireframeAdjustment>;
  readonly isRespawning: boolean;
  readonly error: string | null;
  readonly onRespawn: (fidelity: WireframeFidelity) => void;
};

export const WireframeStudioBody = ({
  artifact,
  fidelity,
  document,
  adjustments,
  isRespawning,
  error,
  onRespawn,
}: Props) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => buildWireframeIndex({ document }), [document]);
  const palette = useMemo(
    () => wireframePalette({ theme: document.theme, fidelity }),
    [document.theme, fidelity],
  );
  const navigation = useWireframeNavigation({ document, resetKey: artifact.id });
  const screen =
    document.screens.find((entry) => entry.id === navigation.currentScreenId) ??
    document.screens[0];
  const order = document.screens.findIndex((entry) => entry.id === screen?.id);
  const otherFidelity: WireframeFidelity = fidelity === 'low' ? 'high' : 'low';

  const runAction = ({
    nodeId,
    action,
  }: {
    readonly nodeId: string;
    readonly action: WireframeAction | null;
  }) => {
    const resolved = index.actionByNodeId.get(nodeId) ?? action;
    if (resolved === null) {
      return;
    }
    if (resolved.type === 'navigate') {
      navigation.goTo(resolved.toScreenId);
      return;
    }
    navigation.toggle(resolved.stateKey);
  };

  const viewportWidth = screen === undefined ? null : VIEWPORT_WIDTH[screen.viewport];
  const { fitZoom, isZoomPinned } = navigation;

  const zoomToFit = useCallback(() => {
    const node = canvasRef.current;
    if (node === null || viewportWidth === null) {
      return;
    }
    const available = node.clientWidth - CANVAS_GUTTER;
    if (available <= 0) {
      return;
    }
    fitZoom(available / viewportWidth);
  }, [fitZoom, viewportWidth]);

  useEffect(() => {
    if (isZoomPinned) {
      return;
    }
    zoomToFit();
    const node = canvasRef.current;
    if (node === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => zoomToFit());
    observer.observe(node);
    return () => observer.disconnect();
  }, [isZoomPinned, zoomToFit, screen?.id]);

  const toggledOn = Object.entries(navigation.mockState).filter(([, value]) => value === true);

  return (
    <div data-testid="wireframe-studio" className="flex min-w-0 flex-col gap-3">
      <WireframeProvenanceRow
        fidelity={fidelity}
        theme={document.theme}
        designProfile={artifact.metadata.designProfile}
      />
      <WireframeAdjustments adjustments={adjustments} />
      <WireframeScreenTabs
        screens={document.screens}
        currentScreenId={navigation.currentScreenId}
        onSelect={navigation.goTo}
      />
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={navigation.goBack}
          disabled={!navigation.canGoBack}
          data-testid="wireframe-back"
          title="Back in the click history"
        >
          <ChevronLeft size={ICON_SIZE.row} aria-hidden />
          Back
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={navigation.goForward}
          disabled={!navigation.canGoForward}
          data-testid="wireframe-forward"
          title="Forward in the click history"
        >
          Forward
          <ChevronRight size={ICON_SIZE.row} aria-hidden />
        </Button>
        <Divider orientation="vertical" className="mx-1 h-4" />
        <Button
          variant="ghost"
          size="sm"
          onClick={navigation.goPrevious}
          disabled={order <= 0}
          data-testid="wireframe-previous"
          title="Previous screen in document order"
        >
          <SkipBack size={ICON_SIZE.row} aria-hidden />
          Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={navigation.goNext}
          disabled={order < 0 || order >= document.screens.length - 1}
          data-testid="wireframe-next"
          title="Next screen in document order"
        >
          Next
          <SkipForward size={ICON_SIZE.row} aria-hidden />
        </Button>
        <Divider orientation="vertical" className="mx-1 h-4" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigation.setZoom(navigation.zoom - ZOOM_STEP)}
          disabled={navigation.zoom <= ZOOM_BOUNDS.min}
          data-testid="wireframe-zoom-out"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus size={ICON_SIZE.row} aria-hidden />
        </Button>
        <span className="min-w-10 text-center tabular-nums text-2xs text-muted-foreground">
          {Math.round(navigation.zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigation.setZoom(navigation.zoom + ZOOM_STEP)}
          disabled={navigation.zoom >= ZOOM_BOUNDS.max}
          data-testid="wireframe-zoom-in"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={zoomToFit}
          data-testid="wireframe-zoom-fit"
          title="Fit the screen to the pane and follow it again"
        >
          <Maximize2 size={ICON_SIZE.row} aria-hidden />
          Fit
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => onRespawn(otherFidelity)}
          disabled={isRespawning}
          data-testid="wireframe-convert-fidelity"
          title={`Run the wireframe again as a separate ${WIREFRAME_FIDELITY_VARIANT_LABEL[otherFidelity]}, leaving this one untouched`}
        >
          <RotateCcw size={ICON_SIZE.row} aria-hidden />
          {isRespawning ? 'Starting' : `New ${WIREFRAME_FIDELITY_VARIANT_LABEL[otherFidelity]}`}
        </Button>
      </div>
      {error === null ? null : (
        <span role="alert" className="text-2xs text-danger">
          {error}
        </span>
      )}
      {toggledOn.length === 0 ? null : (
        <span data-testid="wireframe-mock-state" className="text-2xs text-muted-foreground">
          mock state on: {toggledOn.map(([key]) => key).join(', ')}
        </span>
      )}
      {screen === undefined ? null : (
        <>
          {screen.note === undefined ? null : (
            <span className="text-2xs italic text-muted-foreground">{screen.note}</span>
          )}
          <WireframeCanvas
            ref={canvasRef}
            screen={screen}
            palette={palette}
            isLowFidelity={fidelity === 'low'}
            zoom={navigation.zoom}
            selectedNodeId={navigation.selectedNodeId}
            hotspots={index.hotspots}
            onSelect={navigation.select}
            onAction={runAction}
          />
        </>
      )}
      <Divider />
      <div className={cn('flex min-w-0 flex-col gap-2')}>
        <h3 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Flow</h3>
        <WireframeFlowOverview
          document={document}
          index={index}
          currentScreenId={navigation.currentScreenId}
          onSelectScreen={navigation.goTo}
        />
      </div>
    </div>
  );
};
