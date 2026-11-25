import { forwardRef } from 'react';
import type { GlyphDrawing, IconGlyph, IconGlyphProps, IconWeight } from './types';

const BOLD_STROKE_WIDTH = 8;

type PathsParams = {
  readonly drawing: GlyphDrawing;
  readonly weight: IconWeight;
  readonly color: string;
};

const pathsOf = ({ drawing, weight, color }: PathsParams) => {
  if (weight === 'bold') {
    return (
      <path
        d={drawing.regular}
        stroke={color}
        strokeWidth={BOLD_STROKE_WIDTH}
        strokeLinejoin="round"
      />
    );
  }
  if (weight === 'fill' && drawing.fill != null) {
    return <path d={drawing.fill} />;
  }
  return <path d={drawing.regular} />;
};

type GlyphParams = {
  readonly name: string;
  readonly drawing: GlyphDrawing;
};

export const glyph = ({ name, drawing }: GlyphParams): IconGlyph => {
  const Glyph = forwardRef<SVGSVGElement, IconGlyphProps>(
    ({ alt, color = 'currentColor', size = 24, weight = 'regular', children, ...rest }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        fill={color}
        viewBox="0 0 256 256"
        {...rest}
      >
        {alt != null && alt !== '' ? <title>{alt}</title> : null}
        {children}
        {pathsOf({ drawing, weight, color })}
      </svg>
    ),
  );
  Glyph.displayName = name;
  return Glyph;
};
