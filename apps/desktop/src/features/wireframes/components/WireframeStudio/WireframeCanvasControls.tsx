import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minus,
  Plus,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { Button, Divider } from '@goodboy/ui';
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
  <>
    <Divider orientation="vertical" className="mx-1 h-4" />
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
      disabled={order < 0 || order >= screenCount - 1}
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
      onClick={onZoomToFit}
      data-testid="wireframe-zoom-fit"
      title="Fit the screen to the pane and follow it again"
    >
      <Maximize2 size={ICON_SIZE.row} aria-hidden />
      Fit
    </Button>
  </>
);
