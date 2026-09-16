import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WireframeAction, WireframeAdjustment, WireframeDocument } from '@goodboy/core';
import { Divider, StudioDetailTabs, cn } from '@goodboy/ui';
import type { WireframeArtifact } from '@goodboy/types';
import type { WireframeFidelity } from '../../wireframeFidelity';
import {
  wireframeCanvasBox,
  wireframeFitZoom,
  wireframeScrollBottom,
  type WireframeBox,
} from '../../wireframeFit';
import { buildWireframeIndex } from '../../wireframeIndex';
import { VIEWPORT_MIN_HEIGHT, VIEWPORT_WIDTH, wireframePalette } from '../../wireframePalette';
import { WireframeContactSheet } from '../WireframeContactSheet';
import { WireframeAdjustments } from './WireframeAdjustments';
import { WireframeCanvas } from './WireframeCanvas';
import { WireframeCanvasControls } from './WireframeCanvasControls';
import { WireframeFlowOverview } from './WireframeFlowOverview';
import { WireframeProvenanceRow } from './WireframeProvenanceRow';
import { WireframeScreenTabs } from './WireframeScreenTabs';
import { useWireframeNavigation } from './useWireframeNavigation';

type WireframeView = 'screen' | 'sheet';

const VIEW_OPTIONS = [
  { value: 'screen', label: 'Screen' },
  { value: 'sheet', label: 'Contact sheet' },
] satisfies ReadonlyArray<{ readonly value: WireframeView; readonly label: string }>;

type Props = {
  readonly artifact: WireframeArtifact;
  readonly fidelity: WireframeFidelity;
  readonly requestedFidelity: WireframeFidelity | null;
  readonly document: WireframeDocument;
  readonly adjustments: ReadonlyArray<WireframeAdjustment>;
};

export const WireframeStudioBody = ({
  artifact,
  fidelity,
  requestedFidelity,
  document,
  adjustments,
}: Props) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<WireframeView>('screen');
  const [canvasHeight, setCanvasHeight] = useState<number | null>(null);
  const [content, setContent] = useState<WireframeBox | null>(null);
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

  const viewport = screen?.viewport ?? null;
  const frame = useMemo<WireframeBox | null>(() => {
    if (viewport === null) {
      return null;
    }
    return {
      width: VIEWPORT_WIDTH[viewport],
      height: Math.max(content === null ? 0 : content.height, VIEWPORT_MIN_HEIGHT[viewport]),
    };
  }, [viewport, content]);
  const { fitZoom, isZoomPinned } = navigation;

  const trackContent = useCallback((next: WireframeBox) => {
    setContent((previous) =>
      previous !== null && previous.width === next.width && previous.height === next.height
        ? previous
        : next,
    );
  }, []);

  const measureCanvas = useCallback(() => {
    const node = canvasRef.current;
    if (node === null) {
      return null;
    }
    const rect = node.getBoundingClientRect();
    const box = wireframeCanvasBox({
      clientWidth: node.clientWidth,
      top: rect.top,
      bottom: wireframeScrollBottom({ node, fallback: window.innerHeight }),
    });
    setCanvasHeight(box.maxHeight);
    return box;
  }, []);

  const zoomToFit = useCallback(() => {
    const box = measureCanvas();
    if (box === null || frame === null) {
      return;
    }
    const next = wireframeFitZoom({ available: box.available, frame });
    if (next === null) {
      return;
    }
    fitZoom(next);
  }, [measureCanvas, fitZoom, frame]);

  useEffect(() => {
    if (view !== 'screen') {
      return;
    }
    const refit = () => {
      if (isZoomPinned) {
        measureCanvas();
        return;
      }
      zoomToFit();
    };
    refit();
    const node = canvasRef.current;
    if (node === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(refit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isZoomPinned, view, zoomToFit, measureCanvas, screen?.id]);

  const toggledOn = Object.entries(navigation.mockState).filter(([, value]) => value === true);

  return (
    <div data-testid="wireframe-studio" className="flex min-w-0 flex-col gap-2">
      <WireframeProvenanceRow
        fidelity={fidelity}
        requestedFidelity={requestedFidelity}
        theme={document.theme}
        designProfile={artifact.metadata.designProfile}
      />
      <div data-testid="wireframe-toolbar" className="flex min-w-0 flex-wrap items-center gap-1">
        <StudioDetailTabs
          ariaLabel="Wireframe view"
          options={VIEW_OPTIONS}
          value={view}
          onChange={setView}
        />
        {view === 'screen' ? (
          <>
            <Divider orientation="vertical" className="mx-1 h-4" />
            <WireframeScreenTabs
              screens={document.screens}
              currentScreenId={navigation.currentScreenId}
              onSelect={navigation.goTo}
            />
            <WireframeCanvasControls
              navigation={navigation}
              order={order}
              screenCount={document.screens.length}
              onZoomToFit={zoomToFit}
            />
          </>
        ) : null}
      </div>
      {toggledOn.length === 0 ? null : (
        <span data-testid="wireframe-mock-state" className="text-2xs text-muted-foreground">
          mock state on: {toggledOn.map(([key]) => key).join(', ')}
        </span>
      )}
      {view === 'sheet' ? (
        <WireframeContactSheet
          document={document}
          palette={palette}
          isLowFidelity={fidelity === 'low'}
          interaction={{
            currentScreenId: navigation.currentScreenId,
            selectedNodeId: navigation.selectedNodeId,
            hotspots: index.hotspots,
            onSelect: navigation.select,
            onAction: runAction,
            onOpenScreen: (screenId) => {
              navigation.goTo(screenId);
              setView('screen');
            },
          }}
        />
      ) : null}
      {view === 'screen' && screen !== undefined ? (
        <>
          <WireframeCanvas
            ref={canvasRef}
            screen={screen}
            palette={palette}
            isLowFidelity={fidelity === 'low'}
            zoom={navigation.zoom}
            maxHeight={canvasHeight}
            selectedNodeId={navigation.selectedNodeId}
            hotspots={index.hotspots}
            onSelect={navigation.select}
            onContentResize={trackContent}
            onAction={runAction}
          />
          {screen.note === undefined ? null : (
            <span className="text-2xs italic text-muted-foreground">{screen.note}</span>
          )}
        </>
      ) : null}
      <WireframeAdjustments adjustments={adjustments} />
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
