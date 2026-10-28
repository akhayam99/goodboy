import type { LucideProps } from 'lucide-react';

export const brandSvgProps = ({
  size = 24,
  color: _color,
  strokeWidth: _sw,
  absoluteStrokeWidth: _asw,
  ...rest
}: LucideProps) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  xmlns: 'http://www.w3.org/2000/svg',
  ...rest,
});
