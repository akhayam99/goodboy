import { cn, IconTile } from '@goodboy/ui';
import type { LucideIcon } from 'lucide-react';

const MARK_SIZE = {
  xs: 12,
  sm: 14,
} satisfies Record<'xs' | 'sm', number>;

type Size = number | keyof typeof MARK_SIZE;

type Props = {
  readonly icon: LucideIcon;
  readonly cssVar: string;
  readonly size?: Size;
  readonly framed?: boolean;
  readonly className?: string;
  readonly label?: string;
};

export const BrandGlyph = ({
  icon: Icon,
  cssVar,
  size = 'sm',
  framed = false,
  className,
  label,
}: Props) => {
  const color = `var(${cssVar})`;
  const isSemanticSize = typeof size === 'string';
  const glyphSize = isSemanticSize ? (framed ? 16 : MARK_SIZE[size]) : size;

  if (!framed) {
    return (
      <Icon
        size={glyphSize}
        role={label != null ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label == null ? true : undefined}
        className={cn('shrink-0', className)}
        style={{ color }}
      />
    );
  }

  let tileSize: 'xs' | 'sm' | 'md' | 'lg' = 'sm';
  if (!isSemanticSize) {
    tileSize = 'md';
  }
  if (!isSemanticSize && size <= 16) {
    tileSize = 'xs';
  }
  if (!isSemanticSize && size > 16 && size <= 22) {
    tileSize = 'sm';
  }
  if (!isSemanticSize && size > 30) {
    tileSize = 'lg';
  }

  return (
    <IconTile size={tileSize} color={color} className={className}>
      <Icon
        size={glyphSize}
        role={label != null ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label == null ? true : undefined}
        style={{ color }}
      />
    </IconTile>
  );
};
