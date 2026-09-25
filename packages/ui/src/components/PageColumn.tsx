import type { ReactNode } from 'react';
import { cn } from '../cn';

export const PAGE_COLUMN_CLASS =
  'mx-auto w-full max-w-[var(--column-frame)] px-6 @max-[720px]:px-4';

type Props = {
  readonly className?: string;
  readonly children: ReactNode;
};

export const PageColumn = ({ className, children }: Props) => (
  <div data-page-column="" className={cn(PAGE_COLUMN_CLASS, className)}>
    {children}
  </div>
);
