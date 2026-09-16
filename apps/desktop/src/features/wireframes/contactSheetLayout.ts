import type { WireframeScreen, WireframeViewport } from '@goodboy/core';

export type ContactSheetPlates = Readonly<Record<WireframeViewport, number>>;

const COMPACT: ContactSheetPlates = {
  mobile: 230,
  tablet: 370,
  desktop: 520,
};

const WIDE: ContactSheetPlates = {
  mobile: 230,
  tablet: 560,
  desktop: 880,
};

export const isWideContactSheet = ({
  screens,
}: {
  readonly screens: ReadonlyArray<WireframeScreen>;
}): boolean => screens.length > 0 && screens.every((screen) => screen.viewport !== 'mobile');

export const contactSheetPlates = ({
  screens,
}: {
  readonly screens: ReadonlyArray<WireframeScreen>;
}): ContactSheetPlates => (isWideContactSheet({ screens }) ? WIDE : COMPACT);
