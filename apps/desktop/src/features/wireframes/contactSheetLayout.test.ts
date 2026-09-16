import { describe, expect, it } from 'vitest';
import type { WireframeScreen, WireframeViewport } from '@goodboy/core';
import { contactSheetPlates, isWideContactSheet } from './contactSheetLayout';
import { VIEWPORT_WIDTH } from './wireframePalette';

const screenAt = ({ viewport }: { readonly viewport: WireframeViewport }): WireframeScreen => ({
  id: `screen-${viewport}`,
  title: viewport,
  viewport,
  root: { id: `root-${viewport}`, kind: 'text', text: 'Harborline' },
});

const screensOf = ({
  viewports,
}: {
  readonly viewports: ReadonlyArray<WireframeViewport>;
}): ReadonlyArray<WireframeScreen> => viewports.map((viewport) => screenAt({ viewport }));

describe('contactSheetLayout', () => {
  it('reads a document with a phone screen in it as a compact sheet', () => {
    expect(isWideContactSheet({ screens: screensOf({ viewports: ['mobile', 'desktop'] }) })).toBe(
      false,
    );
    expect(isWideContactSheet({ screens: screensOf({ viewports: ['mobile'] }) })).toBe(false);
  });

  it('reads a document with no phone screen as a wide sheet', () => {
    expect(isWideContactSheet({ screens: screensOf({ viewports: ['desktop'] }) })).toBe(true);
    expect(isWideContactSheet({ screens: screensOf({ viewports: ['desktop', 'tablet'] }) })).toBe(
      true,
    );
  });

  it('treats an empty document as compact rather than wide', () => {
    expect(isWideContactSheet({ screens: [] })).toBe(false);
  });

  it('draws a desktop screen larger when no phone shares the sheet', () => {
    const mixed = contactSheetPlates({ screens: screensOf({ viewports: ['mobile', 'desktop'] }) });
    const wide = contactSheetPlates({ screens: screensOf({ viewports: ['desktop'] }) });
    expect(wide.desktop).toBeGreaterThan(mixed.desktop);
    expect(wide.tablet).toBeGreaterThan(mixed.tablet);
    expect(wide.desktop / VIEWPORT_WIDTH.desktop).toBeGreaterThan(0.6);
  });

  it('keeps every plate narrower than the screen it stands for', () => {
    const plates = contactSheetPlates({ screens: screensOf({ viewports: ['desktop'] }) });
    expect(plates.mobile).toBeLessThan(VIEWPORT_WIDTH.mobile);
    expect(plates.tablet).toBeLessThan(VIEWPORT_WIDTH.tablet);
    expect(plates.desktop).toBeLessThan(VIEWPORT_WIDTH.desktop);
  });
});
