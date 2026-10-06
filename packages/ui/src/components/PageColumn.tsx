import type { ReactNode } from 'react';
import { cn } from '../cn';

const GUTTER_CLASS = 'w-full px-6 @max-[720px]:px-4';

export type PageColumnWidth = 'column' | 'measure' | 'full';

const WIDTH_CLASS: Readonly<Record<PageColumnWidth, string>> = {
  column: `mx-auto max-w-[var(--column-frame)] ${GUTTER_CLASS}`,
  measure: `mx-auto max-w-[var(--measure-frame)] ${GUTTER_CLASS}`,
  full: GUTTER_CLASS,
};

type Props = {
  readonly width?: PageColumnWidth;
  readonly className?: string;
  readonly children: ReactNode;
};

export const PageColumn = ({ width = 'column', className, children }: Props) => (
  <div data-page-column="" data-width={width} className={cn(WIDTH_CLASS[width], className)}>
    {children}
  </div>
);
