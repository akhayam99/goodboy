import type { ReactNode } from 'react';
import { cn } from '../cn';
import { PageColumn } from './PageColumn';
import { ScrollFade } from './ScrollFade';

type Props = {
  readonly children: ReactNode;
  readonly className?: string;
};

export const FormPage = ({ children, className }: Props) => (
  <ScrollFade className="min-h-0 w-full flex-1">
    <PageColumn>
      <div data-slot="form-page" className={cn('flex flex-col gap-8 py-5', className)}>
        {children}
      </div>
    </PageColumn>
  </ScrollFade>
);
