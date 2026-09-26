import { Maximize2, Minus, Plus, SkipBack, SkipForward } from 'lucide-react';
import { Button, IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ZOOM_BOUNDS, type WireframeNavigation } from './useWireframeNavigation';

const ZOOM_STEP = 0.1;

type Props = {
  readonly navigation: WireframeNavigation;
  readonly order: number;
  readonly screenCount: number;
  readonly onZoomToFit: () => void;
};

export const WireframeCanvasControls = ({ navigation, order, screenCount, onZoomToFit }: Props) => (
  <span className="flex shrink-0 items-center gap-1">
    <IconButton
      variant="ghost"
      icon={SkipBack}
      label="Previous"
      tooltip="Previous screen"
      onClick={navigation.goPrevious}
      disabled={order <= 0}
      data-testid="wireframe-previous"
    />
    <IconButton
      variant="ghost"
      icon={SkipForward}
      label="Next"
      tooltip="Next screen"
      onClick={navigation.goNext}
      disabled={order < 0 || order >= screenCount - 1}
      data-testid="wireframe-next"
    />
    <IconButton
      variant="ghost"
      icon={Minus}
      label="Zoom out"
      tooltip="Zoom out"
      onClick={() => navigation.setZoom(navigation.zoom - ZOOM_STEP)}
      disabled={navigation.zoom <= ZOOM_BOUNDS.min}
      data-testid="wireframe-zoom-out"
    />
    <span className="min-w-10 text-center tabular-nums text-secondary text-muted-foreground">
      {Math.round(navigation.zoom * 100)}%
    </span>
    <IconButton
      variant="ghost"
      icon={Plus}
      label="Zoom in"
      tooltip="Zoom in"
      onClick={() => navigation.setZoom(navigation.zoom + ZOOM_STEP)}
      disabled={navigation.zoom >= ZOOM_BOUNDS.max}
      data-testid="wireframe-zoom-in"
    />
    <Button
      variant="ghost"
      size="sm"
      onClick={onZoomToFit}
      data-testid="wireframe-zoom-fit"
      title="Fit the screen to the pane and follow it again"
    >
      <Maximize2 size={ICON_SIZE.row} aria-hidden />
      Fit
    </Button>
  </span>
);
