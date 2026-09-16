import { describe, expect, it } from 'vitest';
import { wireframeCanvasBox, wireframeFitZoom } from './wireframeFit';

describe('wireframeCanvasBox', () => {
  it('reads the height budget from where the canvas actually starts', () => {
    const box = wireframeCanvasBox({ clientWidth: 640, top: 420, bottom: 900 });
    expect(box.maxHeight).toBe(456);
    expect(box.available).toEqual({ width: 600, height: 416 });
  });

  it('never returns a box smaller than the floor when the furniture pushes the canvas off screen', () => {
    const box = wireframeCanvasBox({ clientWidth: 120, top: 880, bottom: 900 });
    expect(box.maxHeight).toBe(200);
    expect(box.available).toEqual({ width: 80, height: 160 });
  });
});

describe('wireframeFitZoom', () => {
  it('fits a frame taller than the available box on the vertical ratio, not the horizontal one', () => {
    const zoom = wireframeFitZoom({
      available: { width: 600, height: 416 },
      frame: { width: 1280, height: 900 },
    });
    expect(zoom).toBeCloseTo(416 / 900, 10);
    expect(zoom).toBeLessThan(600 / 1280);
  });

  it('fits on the horizontal ratio when the frame is wide and short', () => {
    const zoom = wireframeFitZoom({
      available: { width: 600, height: 704 },
      frame: { width: 1280, height: 720 },
    });
    expect(zoom).toBeCloseTo(600 / 1280, 10);
  });

  it('keeps a mobile frame inside the box instead of overflowing it', () => {
    const zoom = wireframeFitZoom({
      available: { width: 600, height: 416 },
      frame: { width: 375, height: 640 },
    });
    expect(zoom).toBeCloseTo(416 / 640, 10);
    expect((zoom ?? 0) * 640).toBeLessThanOrEqual(416);
  });

  it('refuses to fit against a collapsed box or a collapsed frame', () => {
    expect(
      wireframeFitZoom({
        available: { width: 0, height: 416 },
        frame: { width: 1280, height: 900 },
      }),
    ).toBeNull();
    expect(
      wireframeFitZoom({
        available: { width: 600, height: 0 },
        frame: { width: 1280, height: 900 },
      }),
    ).toBeNull();
    expect(
      wireframeFitZoom({
        available: { width: 600, height: 416 },
        frame: { width: 0, height: 900 },
      }),
    ).toBeNull();
  });

  it('refuses to fit when a measurement came back as not a number', () => {
    expect(
      wireframeFitZoom({
        available: { width: 600, height: 416 },
        frame: { width: 1280, height: Number.NaN },
      }),
    ).toBeNull();
  });
});
