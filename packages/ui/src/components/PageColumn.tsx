import type { ReactNode } from 'react';
import { cn } from '../cn';

const GUTTER_CLASS = 'w-full px-6 @max-[720px]:px-4';
const COLUMN_CLASS = `mx-auto max-w-[var(--column-frame)] ${GUTTER_CLASS}`;

export type PageColumnWidth = 'column' | 'full';

type Props = {
  readonly width?: PageColumnWidth;
  readonly className?: string;
  readonly children: ReactNode;
};

export const PageColumn = ({ width = 'column', className, children }: Props) => (
  <div
    data-page-column=""
    className={cn(width === 'full' ? GUTTER_CLASS : COLUMN_CLASS, className)}
  >
    {children}
  </div>
);
