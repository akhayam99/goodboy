import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { IconGlyph, IconWeight } from '../types';

const WEIGHTS: ReadonlyArray<IconWeight> = ['regular', 'bold', 'fill', 'duotone'];

type DrawingParams = {
  readonly icon: IconGlyph;
  readonly weight: IconWeight;
};

const drawingOf = ({ icon, weight }: DrawingParams): string => {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(createElement(icon, { weight }));
  return host.firstElementChild?.innerHTML ?? '';
};

type FindGlyphsParams = {
  readonly root: Element | Document | null | undefined;
  readonly icons: ReadonlyArray<IconGlyph>;
};

export const findGlyphs = ({ root, icons }: FindGlyphsParams): ReadonlyArray<SVGSVGElement> => {
  if (root == null) {
    return [];
  }
  const drawings = new Set(
    icons.flatMap((icon) => WEIGHTS.map((weight) => drawingOf({ icon, weight }))),
  );
  const svgs = [...root.querySelectorAll('svg')];
  if (root instanceof SVGSVGElement) {
    svgs.unshift(root);
  }
  return svgs.filter((svg) => drawings.has(svg.innerHTML));
};
