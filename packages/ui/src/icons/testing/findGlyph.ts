import type { Icon } from '@phosphor-icons/react/dist/lib/types';
import { findGlyphs } from './findGlyphs';

type FindGlyphParams = {
  readonly root: Element | Document | null | undefined;
  readonly icon: Icon;
};

export const findGlyph = ({ root, icon }: FindGlyphParams): SVGSVGElement | null =>
  findGlyphs({ root, icons: [icon] })[0] ?? null;
