import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
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

type ContentSize = Readonly<{ width: number; height: number }>;

export const WireframeCanvas = forwardRef<HTMLDivElement, Props>(
  ({ screen, palette, isLowFidelity, zoom, selectedNodeId, hotspots, onSelect, onAction }, ref) => {
    const screenRef = useRef<HTMLDivElement>(null);
    const [content, setContent] = useState<ContentSize | null>(null);
    const width = VIEWPORT_WIDTH[screen.viewport];
    const minHeight = VIEWPORT_MIN_HEIGHT[screen.viewport];

    useLayoutEffect(() => {
      const node = screenRef.current;
      if (node === null) {
        return;
      }
      const measure = () => {
        const next = { width: node.offsetWidth, height: node.offsetHeight };
        setContent((previous) =>
          previous !== null && previous.width === next.width && previous.height === next.height
            ? previous
            : next,
        );
      };
      measure();
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    }, [screen, palette, isLowFidelity]);

    const contentWidth = content === null ? width : Math.max(content.width, width);
    const contentHeight = content === null ? minHeight : Math.max(content.height, minHeight);

    return (
      <div
        ref={ref}
        data-testid="wireframe-canvas"
        className="max-h-[min(32rem,calc(100vh-2rem))] min-h-0 w-full overflow-auto rounded-md border border-border-soft bg-elevated p-4"
      >
        <div style={{ width: contentWidth * zoom, height: contentHeight * zoom }}>
          <div
            ref={screenRef}
            data-testid="wireframe-screen"
            data-screen-id={screen.id}
            style={{
              width,
              minHeight,
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
