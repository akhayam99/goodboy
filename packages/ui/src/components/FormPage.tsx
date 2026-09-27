import type { ReactNode } from 'react';
import { cn } from '../cn';
import { PANE_RHYTHM } from '../paneRhythm';
import { ScrollFade } from './ScrollFade';

type Props = {
  readonly children: ReactNode;
  readonly className?: string;
};

export const FormPage = ({ children, className }: Props) => (
  <ScrollFade className="min-h-0 w-full flex-1">
    <div
      data-slot="form-page"
      className={cn(PANE_RHYTHM.column, PANE_RHYTHM.body, 'flex flex-col gap-8', className)}
    >
      {children}
    </div>
  </ScrollFade>
);
