import type { IconGlyph } from '../types';
import { findGlyphs } from './findGlyphs';

type FindGlyphParams = {
  readonly root: Element | Document | null | undefined;
  readonly icon: IconGlyph;
};

export const findGlyph = ({ root, icon }: FindGlyphParams): SVGSVGElement | null =>
  findGlyphs({ root, icons: [icon] })[0] ?? null;
