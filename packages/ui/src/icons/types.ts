import type { ComponentPropsWithoutRef, ForwardRefExoticComponent, RefAttributes } from 'react';

export type IconWeight = 'regular' | 'bold' | 'fill';

export type IconGlyphProps = ComponentPropsWithoutRef<'svg'> &
  RefAttributes<SVGSVGElement> & {
    readonly alt?: string;
    readonly color?: string;
    readonly size?: string | number;
    readonly weight?: IconWeight;
  };

export type IconGlyph = ForwardRefExoticComponent<IconGlyphProps>;

export type GlyphDrawing = {
  readonly regular: string;
  readonly fill?: string;
};
