import type { WireframeScreen } from '@goodboy/core';
import {
  CONTACT_SHEET_PLATE_WIDTH,
  VIEWPORT_MIN_HEIGHT,
  VIEWPORT_WIDTH,
  type WireframePalette,
} from '../../wireframePalette';
import { WireframeNodeView } from '../WireframeNodeView';
import { WireframeFrameChrome } from './WireframeFrameChrome';

type Props = {
  readonly screen: WireframeScreen;
  readonly palette: WireframePalette;
  readonly isLowFidelity: boolean;
};

const BEZEL = 7;

const HOME_INDICATOR_BAND = 14;

const NO_HOTSPOTS: ReadonlySet<string> = new Set<string>();

const inert = () => undefined;

export const WireframeSheetFrame = ({ screen, palette, isLowFidelity }: Props) => {
  const plate = CONTACT_SHEET_PLATE_WIDTH[screen.viewport];
  const width = VIEWPORT_WIDTH[screen.viewport];
  const scale = plate / width;
  const hasHomeIndicator = screen.viewport === 'mobile';

  return (
    <div
      data-testid="wireframe-sheet-frame"
      data-screen-id={screen.id}
      data-viewport={screen.viewport}
      style={{
        padding: BEZEL,
        borderRadius: palette.radius + BEZEL,
        border: `1px solid ${palette.border}`,
        background: palette.surface,
        boxSizing: 'content-box',
        width: plate,
      }}
    >
      <div
        style={{
          width: plate,
          overflow: 'hidden',
          borderRadius: palette.radius,
          background: palette.background,
          boxSizing: 'border-box',
        }}
      >
        <WireframeFrameChrome viewport={screen.viewport} palette={palette} />
        <div inert style={{ zoom: scale }}>
          <div
            data-testid="wireframe-sheet-screen"
            style={{
              width,
              minHeight: VIEWPORT_MIN_HEIGHT[screen.viewport],
              padding: 16,
              boxSizing: 'border-box',
              background: palette.background,
              color: palette.foreground,
              fontFamily: palette.fontFamily,
            }}
          >
            <WireframeNodeView
              node={screen.root}
              palette={palette}
              isLowFidelity={isLowFidelity}
              selectedNodeId={null}
              hotspots={NO_HOTSPOTS}
              onSelect={inert}
              onAction={inert}
            />
          </div>
        </div>
        {hasHomeIndicator ? (
          <div
            data-testid="wireframe-home-indicator"
            aria-hidden
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: HOME_INDICATOR_BAND,
              background: palette.background,
            }}
          >
            <span
              style={{
                width: Math.round(plate * 0.32),
                height: 3,
                borderRadius: 999,
                background: palette.border,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
