import type { CSSProperties } from 'react';
import type { WireframeViewport } from '@goodboy/core';
import type { WireframePalette } from '../../wireframePalette';

type Props = {
  readonly viewport: WireframeViewport;
  readonly palette: WireframePalette;
};

const FRAME_CHROME_HEIGHT = 18;

const DEVICE_MARKS = [10, 8, 13];

const WINDOW_DOTS = [0, 1, 2];

const mark = ({
  width,
  height,
  palette,
}: {
  readonly width: number | 'auto';
  readonly height: number;
  readonly palette: WireframePalette;
}): CSSProperties => ({
  width,
  height,
  borderRadius: 999,
  background: palette.border,
  flexGrow: width === 'auto' ? 1 : 0,
  flexShrink: width === 'auto' ? 1 : 0,
});

export const WireframeFrameChrome = ({ viewport, palette }: Props) => {
  const isWindow = viewport === 'desktop';
  return (
    <div
      data-testid="wireframe-frame-chrome"
      data-chrome={isWindow ? 'window' : 'device'}
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        height: FRAME_CHROME_HEIGHT,
        padding: '0 9px',
        background: palette.surface,
        borderBottom: `1px solid ${palette.border}`,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {isWindow ? (
          WINDOW_DOTS.map((dot) => (
            <span key={dot} style={mark({ width: 6, height: 6, palette })} />
          ))
        ) : (
          <span style={mark({ width: 22, height: 5, palette })} />
        )}
      </div>
      {isWindow ? (
        <span style={mark({ width: 'auto', height: 7, palette })} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {DEVICE_MARKS.map((width) => (
            <span key={width} style={mark({ width, height: 5, palette })} />
          ))}
        </div>
      )}
    </div>
  );
};
