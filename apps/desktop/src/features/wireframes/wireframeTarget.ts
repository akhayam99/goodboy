import type { WireframeScreen } from '@goodboy/core';
import type { ArtifactRunTarget } from '@goodboy/types';

export const WIREFRAME_TARGETS = [
  'mobile',
  'desktop',
  'both',
] as const satisfies ReadonlyArray<ArtifactRunTarget>;

export type WireframeTarget = (typeof WIREFRAME_TARGETS)[number];

export const WIREFRAME_TARGET_CHOICE_LABEL: Record<WireframeTarget, string> = {
  mobile: 'Phone',
  desktop: 'Desktop',
  both: 'Phone and desktop',
};

export const WIREFRAME_TARGET_LABEL: Record<WireframeTarget, string> = {
  mobile: 'phone',
  desktop: 'desktop',
  both: 'phone and desktop',
};

export const WIREFRAME_TARGET_HINT: Record<WireframeTarget, string> = {
  mobile: 'every screen is drawn at phone width, in a device frame',
  desktop: 'every screen is drawn at desktop width, in a browser window',
  both: 'the flow spans both, and each screen is drawn at the width where it belongs',
};

export const WIREFRAME_TARGET_BRIEF: Record<WireframeTarget, string> = {
  mobile:
    'every screen is for a phone. set viewport to "mobile" on every screen, lay out one column, and put primary navigation in a bottom bar.',
  desktop:
    'every screen is for a desktop browser. set viewport to "desktop" on every screen and use the width: side or top navigation, grids and tables rather than a single column.',
  both: 'this product is used on both. choose the viewport per screen, "mobile" for what a user holds and "desktop" for what they sit at, and cover both in the same document.',
};

export const asWireframeTarget = ({ value }: { readonly value: string }): WireframeTarget | null =>
  (WIREFRAME_TARGETS as ReadonlyArray<string>).includes(value) ? (value as WireframeTarget) : null;

export const deriveWireframeTarget = ({
  screens,
}: {
  readonly screens: ReadonlyArray<WireframeScreen>;
}): WireframeTarget | null => {
  if (screens.length === 0 || screens.some((screen) => screen.viewport === 'tablet')) {
    return null;
  }
  if (screens.every((screen) => screen.viewport === 'mobile')) {
    return 'mobile';
  }
  if (screens.every((screen) => screen.viewport === 'desktop')) {
    return 'desktop';
  }
  return 'both';
};
