import { describe, expect, it } from 'vitest';
import type { WireframeScreen, WireframeViewport } from '@goodboy/core';
import { asWireframeTarget, deriveWireframeTarget, WIREFRAME_TARGETS } from './wireframeTarget';

const screensOf = ({
  viewports,
}: {
  readonly viewports: ReadonlyArray<WireframeViewport>;
}): ReadonlyArray<WireframeScreen> =>
  viewports.map((viewport, index) => ({
    id: `screen-${index}`,
    title: `Screen ${index}`,
    viewport,
    root: { id: `root-${index}`, kind: 'text', text: 'Northwind' },
  }));

describe('wireframeTarget', () => {
  it('offers a phone, a desktop and one that means both', () => {
    expect([...WIREFRAME_TARGETS]).toEqual(['mobile', 'desktop', 'both']);
  });

  it('reads back only a declared target', () => {
    expect(asWireframeTarget({ value: 'desktop' })).toBe('desktop');
    expect(asWireframeTarget({ value: 'watch' })).toBeNull();
  });

  it('derives the target a document was drawn for', () => {
    expect(deriveWireframeTarget({ screens: screensOf({ viewports: ['mobile', 'mobile'] }) })).toBe(
      'mobile',
    );
    expect(deriveWireframeTarget({ screens: screensOf({ viewports: ['desktop'] }) })).toBe(
      'desktop',
    );
    expect(
      deriveWireframeTarget({ screens: screensOf({ viewports: ['mobile', 'desktop'] }) }),
    ).toBe('both');
    expect(deriveWireframeTarget({ screens: [] })).toBeNull();
  });

  it('refuses to call a tablet document something it is not', () => {
    expect(
      deriveWireframeTarget({ screens: screensOf({ viewports: ['tablet', 'tablet'] }) }),
    ).toBeNull();
    expect(
      deriveWireframeTarget({ screens: screensOf({ viewports: ['desktop', 'tablet'] }) }),
    ).toBeNull();
  });
});
