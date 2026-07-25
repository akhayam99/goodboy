import { forwardRef } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';

export const ProviderStudioIcon: LucideIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, color: _color, strokeWidth: _sw, absoluteStrokeWidth: _asw, ...rest }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M9.7 9.9 6.3 6.5M14.3 9.9l3.4-3.4M14.3 14.1l3.4 3.4" />
    </svg>
  ),
);
ProviderStudioIcon.displayName = 'ProviderStudioIcon';
