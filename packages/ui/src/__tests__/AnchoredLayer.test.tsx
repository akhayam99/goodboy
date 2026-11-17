// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AnchoredLayer } from '../components/AnchoredLayer';
import { PopoverPortalProvider } from '../PopoverPortalContext';

type Box = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

const boxOf = ({ top, left, width, height }: Box): DOMRect =>
  ({
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) satisfies DOMRect;

const NOTHING: Box = { top: 0, left: 0, width: 0, height: 0 };

type BoxesParams = {
  readonly anchor: Box;
  readonly layer: Box;
};

const placeBoxes = ({ anchor, layer }: BoxesParams) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
    this: HTMLElement,
  ) {
    if (this.dataset.testid === 'anchor') {
      return boxOf(anchor);
    }
    if (this.hasAttribute('data-anchored-layer')) {
      return boxOf(layer);
    }
    return boxOf(NOTHING);
  });
};

type ClipParams = {
  readonly side: 'top' | 'bottom';
  readonly isAnchorWidth?: boolean;
  readonly maxWidth?: number;
};

const renderInClip = ({ side, isAnchorWidth, maxWidth }: ClipParams) =>
  render(
    <div data-testid="clip" style={{ width: 320, overflow: 'hidden' }}>
      <div data-testid="anchor">
        <AnchoredLayer side={side} isAnchorWidth={isAnchorWidth} maxWidth={maxWidth}>
          <p>Queued line</p>
        </AnchoredLayer>
      </div>
    </div>,
  );

const layerOf = (): HTMLElement => {
  const layer = screen.getByText('Queued line').parentElement;
  if (layer === null) {
    throw new Error('no layer');
  }
  return layer;
};

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AnchoredLayer', () => {
  it('leaves a clipping 320px container for the body, so the container cannot cut it', () => {
    placeBoxes({
      anchor: { top: 400, left: 100, width: 320, height: 40 },
      layer: { top: 0, left: 0, width: 320, height: 120 },
    });
    renderInClip({ side: 'top' });

    const layer = layerOf();
    expect(screen.getByTestId('clip').contains(layer)).toBe(false);
    expect(layer.parentElement).toBe(document.body);
    expect(layer.style.position).toBe('fixed');
    expect(layer.style.visibility).toBe('visible');
  });

  it('sits above its anchor, start aligned, with the gap between them', () => {
    placeBoxes({
      anchor: { top: 400, left: 100, width: 320, height: 40 },
      layer: { top: 0, left: 0, width: 320, height: 120 },
    });
    renderInClip({ side: 'top' });

    expect(layerOf().style.top).toBe('276px');
    expect(layerOf().style.left).toBe('100px');
  });

  it('flips under the anchor when the room above is short', () => {
    placeBoxes({
      anchor: { top: 30, left: 100, width: 320, height: 40 },
      layer: { top: 0, left: 0, width: 320, height: 120 },
    });
    renderInClip({ side: 'top' });

    expect(layerOf().style.top).toBe('74px');
  });

  it('keeps the shell gutter from the window edge and caps its height at the room left', () => {
    placeBoxes({
      anchor: { top: 600, left: 0, width: 200, height: 40 },
      layer: { top: 0, left: 0, width: 200, height: 40 },
    });
    renderInClip({ side: 'bottom' });

    expect(layerOf().style.left).toBe('12px');
    expect(layerOf().style.maxHeight).toBe('44px');
  });

  it('takes the anchor width when asked, under the max width and the window', () => {
    placeBoxes({
      anchor: { top: 400, left: 100, width: 320, height: 40 },
      layer: { top: 0, left: 0, width: 320, height: 120 },
    });
    renderInClip({ side: 'top', isAnchorWidth: true, maxWidth: 500 });

    expect(layerOf().style.width).toBe('320px');
    expect(layerOf().style.maxWidth).toBe('min(500px, calc(100vw - 24px))');
  });

  it('portals into the layer a palette provides', () => {
    placeBoxes({
      anchor: { top: 400, left: 100, width: 320, height: 40 },
      layer: { top: 0, left: 0, width: 320, height: 120 },
    });
    const palette = document.createElement('div');
    document.body.appendChild(palette);
    render(
      <PopoverPortalProvider value={palette}>
        <div data-testid="anchor">
          <AnchoredLayer side="top">
            <p>Queued line</p>
          </AnchoredLayer>
        </div>
      </PopoverPortalProvider>,
    );

    expect(layerOf().parentElement).toBe(palette);
    palette.remove();
  });
});
