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

const GRID: ContactSheetPlates = {
  mobile: 150,
  tablet: 220,
  desktop: 280,
};

export type ContactSheetDensity = 'sheet' | 'grid';

export const isWideContactSheet = ({
  screens,
}: {
  readonly screens: ReadonlyArray<WireframeScreen>;
}): boolean => screens.length > 0 && screens.every((screen) => screen.viewport !== 'mobile');

export const contactSheetPlates = ({
  screens,
  density = 'sheet',
}: {
  readonly screens: ReadonlyArray<WireframeScreen>;
  readonly density?: ContactSheetDensity;
}): ContactSheetPlates => {
  if (density === 'grid') {
    return GRID;
  }
  return isWideContactSheet({ screens }) ? WIDE : COMPACT;
};
