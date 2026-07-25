import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly visible: boolean;
  readonly children: ReactNode;
};

export const Pane = ({ visible, children }: Props) => (
  <div hidden={!visible} className={cn('absolute inset-0', !visible && 'pointer-events-none')}>
    {children}
  </div>
);
