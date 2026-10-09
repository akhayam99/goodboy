import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import { mountGridTracksOf } from './mountGrid';

type Props = {
  readonly className?: string;
  readonly children: ReactNode;
};

export const MountTrackGrid = ({ className, children }: Props) => {
  const template = mountGridTracksOf().join(' ');
  return (
    <div
      data-mount-grid={template}
      style={{ gridTemplateColumns: template }}
      className={cn('grid min-w-0', className)}
    >
      {children}
    </div>
  );
};
