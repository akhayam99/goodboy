import { useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  RotateCcw,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import type { WireframeAction, WireframeDocument } from '@goodboy/core';
import { Button, Divider, cn } from '@goodboy/ui';
import type { WireframeArtifact } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { WireframeFidelity } from '../../wireframeFidelity';
import { buildWireframeIndex } from '../../wireframeIndex';
import { VIEWPORT_WIDTH, wireframePalette } from '../../wireframePalette';
import { WireframeCanvas } from './WireframeCanvas';
import { WireframeFlowOverview } from './WireframeFlowOverview';
import { WireframeProvenanceRow } from './WireframeProvenanceRow';
import { WireframeScreenTabs } from './WireframeScreenTabs';
import { useWireframeNavigation } from './useWireframeNavigation';

type Props = {
  readonly artifact: WireframeArtifact;
  readonly fidelity: WireframeFidelity;
  readonly document: WireframeDocument;
  readonly isRespawning: boolean;
  readonly error: string | null;
  readonly onRespawn: (fidelity: WireframeFidelity) => void;
};

export const WireframeStudioBody = ({
  artifact,
  fidelity,
  document,
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
    action,
  }: {
    readonly nodeId: string;
    readonly action: WireframeAction | null;
  }) => {
    if (action === null) {
      return;
    }
    if (action.type === 'navigate') {
      navigation.goTo(action.toScreenId);
      return;
    }
    navigation.toggle(action.stateKey);
  };

  const zoomToFit = () => {
    if (screen === undefined) {
      return;
    }
    const available = (canvasRef.current?.clientWidth ?? 0) - 40;
    navigation.setZoom(available > 0 ? available / VIEWPORT_WIDTH[screen.viewport] : 1);
  };

  const toggledOn = Object.entries(navigation.mockState).filter(([, value]) => value === true);

  return (
    <div data-testid="wireframe-studio" className="flex min-w-0 flex-col gap-3">
      <WireframeProvenanceRow
        fidelity={fidelity}
        theme={document.theme}
        designProfile={artifact.metadata.designProfile}
      />
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
          onClick={zoomToFit}
          data-testid="wireframe-zoom-fit"
          title="Fit the screen to the pane"
        >
          <Maximize2 size={ICON_SIZE.row} aria-hidden />
          Fit
        </Button>
        <span className="tabular-nums text-2xs text-muted-foreground">
          {Math.round(navigation.zoom * 100)}%
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => onRespawn(otherFidelity)}
          disabled={isRespawning}
          data-testid="wireframe-convert-fidelity"
          title="Run the wireframe again at the other fidelity as a new revision"
        >
          <RotateCcw size={ICON_SIZE.row} aria-hidden />
          {isRespawning ? 'Starting' : `Convert to ${otherFidelity}`}
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
