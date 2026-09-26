import { describe, expect, it } from 'vitest';
import { thumbGeometry } from '../components/ScrollFade/useOverlayThumb/geometry';

describe('thumbGeometry', () => {
  it('reports no overflow when the content fits the viewport', () => {
    const geometry = thumbGeometry({ scrollSize: 100, clientSize: 100, scrollPos: 0 });

    expect(geometry.hasOverflow).toBe(false);
    expect(geometry.length).toBe(0);
  });

  it('sizes the thumb to the ratio of visible to total content', () => {
    const geometry = thumbGeometry({ scrollSize: 1000, clientSize: 200, scrollPos: 0 });

    expect(geometry.hasOverflow).toBe(true);
    expect(geometry.length).toBeCloseTo((200 / 1000) * (200 - 8));
  });

  it('never sizes the thumb under the minimum, even for a very long list', () => {
    const geometry = thumbGeometry({ scrollSize: 100_000, clientSize: 200, scrollPos: 0 });

    expect(geometry.length).toBe(24);
  });

  it('sits at the top of the track at scroll position zero', () => {
    const geometry = thumbGeometry({ scrollSize: 1000, clientSize: 200, scrollPos: 0 });

    expect(geometry.offset).toBe(0);
  });

  it('sits at the bottom of the track at the maximum scroll position', () => {
    const geometry = thumbGeometry({ scrollSize: 1000, clientSize: 200, scrollPos: 800 });
    const trackLength = 200 - 8;

    expect(geometry.offset).toBeCloseTo(trackLength - geometry.length);
  });

  it('moves proportionally to the scroll ratio between the ends', () => {
    const quarter = thumbGeometry({ scrollSize: 1000, clientSize: 200, scrollPos: 200 });
    const half = thumbGeometry({ scrollSize: 1000, clientSize: 200, scrollPos: 400 });

    expect(half.offset).toBeGreaterThan(quarter.offset);
    expect(half.offset).toBeCloseTo(quarter.offset * 2, 5);
  });
});
