import { forwardRef } from 'react';
import type { WireframeAction, WireframeScreen } from '@goodboy/core';
import { VIEWPORT_MIN_HEIGHT, VIEWPORT_WIDTH, type WireframePalette } from '../../wireframePalette';
import { WireframeNodeView } from './WireframeNodeView';

type Props = {
  readonly screen: WireframeScreen;
  readonly palette: WireframePalette;
  readonly isLowFidelity: boolean;
  readonly zoom: number;
  readonly selectedNodeId: string | null;
  readonly hotspots: ReadonlySet<string>;
  readonly onSelect: (nodeId: string) => void;
  readonly onAction: (params: {
    readonly nodeId: string;
    readonly action: WireframeAction | null;
  }) => void;
};

export const WireframeCanvas = forwardRef<HTMLDivElement, Props>(
  ({ screen, palette, isLowFidelity, zoom, selectedNodeId, hotspots, onSelect, onAction }, ref) => {
    const width = VIEWPORT_WIDTH[screen.viewport];
    return (
      <div
        ref={ref}
        data-testid="wireframe-canvas"
        className="min-h-0 w-full overflow-auto rounded-md border border-border-soft bg-elevated p-4"
      >
        <div style={{ width: width * zoom, height: VIEWPORT_MIN_HEIGHT[screen.viewport] * zoom }}>
          <div
            data-testid="wireframe-screen"
            data-screen-id={screen.id}
            style={{
              width,
              minHeight: VIEWPORT_MIN_HEIGHT[screen.viewport],
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              background: palette.background,
              color: palette.foreground,
              fontFamily: palette.fontFamily,
              border: `1px solid ${palette.border}`,
              borderRadius: palette.radius,
              padding: 16,
              boxSizing: 'border-box',
            }}
          >
            <WireframeNodeView
              node={screen.root}
              palette={palette}
              isLowFidelity={isLowFidelity}
              selectedNodeId={selectedNodeId}
              hotspots={hotspots}
              onSelect={onSelect}
              onAction={onAction}
            />
          </div>
        </div>
      </div>
    );
  },
);

WireframeCanvas.displayName = 'WireframeCanvas';
