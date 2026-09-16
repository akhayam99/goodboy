import type { WireframeScreen } from '@goodboy/core';
import { cn } from '@goodboy/ui';
import type { ContactSheetPlates } from '../../contactSheetLayout';
import { VIEWPORT_MIN_HEIGHT, VIEWPORT_WIDTH, type WireframePalette } from '../../wireframePalette';
import { WireframeNodeView } from '../WireframeNodeView';
import { WireframeFrameChrome } from './WireframeFrameChrome';
import type { WireframeSheetInteraction } from './interaction';
import type { WireframeSheetSurface } from './surface';

type Props = {
  readonly screen: WireframeScreen;
  readonly palette: WireframePalette;
  readonly plates: ContactSheetPlates;
  readonly isLowFidelity: boolean;
  readonly isCurrent: boolean;
  readonly surface: WireframeSheetSurface;
  readonly interaction: WireframeSheetInteraction | null;
};

const BEZEL = 7;

const HOME_INDICATOR_BAND = 14;

const NO_HOTSPOTS: ReadonlySet<string> = new Set<string>();

const inert = () => undefined;

const screenMinHeight = ({
  screen,
  surface,
}: {
  readonly screen: WireframeScreen;
  readonly surface: WireframeSheetSurface;
}): number | undefined => {
  if (surface === 'app' || screen.viewport === 'mobile') {
    return VIEWPORT_MIN_HEIGHT[screen.viewport];
  }
  return undefined;
};

export const WireframeSheetFrame = ({
  screen,
  palette,
  plates,
  isLowFidelity,
  isCurrent,
  surface,
  interaction,
}: Props) => {
  const plate = plates[screen.viewport];
  const width = VIEWPORT_WIDTH[screen.viewport];
  const scale = plate / width;
  const hasHomeIndicator = screen.viewport === 'mobile';
  const isLive = interaction !== null;

  return (
    <div
      data-testid="wireframe-sheet-frame"
      data-screen-id={screen.id}
      data-viewport={screen.viewport}
      data-current={isCurrent ? 'true' : 'false'}
      className={cn(isLive && isCurrent && 'ring-2 ring-primary')}
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
        <div inert={!isLive} style={{ zoom: scale }}>
          <div
            data-testid="wireframe-sheet-screen"
            style={{
              width,
              minHeight: screenMinHeight({ screen, surface }),
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
              selectedNodeId={interaction?.selectedNodeId ?? null}
              hotspots={interaction?.hotspots ?? NO_HOTSPOTS}
              onSelect={interaction?.onSelect ?? inert}
              onAction={interaction?.onAction ?? inert}
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
