import { cn } from '@goodboy/ui';
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
  readonly className?: string;
  readonly label?: string;
  readonly useBrandColor?: boolean;
};

export const BrandGlyph = ({
  icon: Icon,
  cssVar,
  size = 'sm',
  className,
  label,
  useBrandColor = true,
}: Props) => {
  const color = `var(${cssVar})`;
  const glyphSize = typeof size === 'string' ? MARK_SIZE[size] : size;

  return (
    <Icon
      size={glyphSize}
      role={label != null ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label == null ? true : undefined}
      className={cn('shrink-0', className)}
      style={useBrandColor ? { color } : undefined}
    />
  );
};
