import type { ReactNode } from 'react';
import { Divider } from '@goodboy/ui';

type Props = {
  readonly open: boolean;
  readonly panel: ReactNode;
  readonly children: ReactNode;
};

export const InspectorSplit = ({ open, panel, children }: Props) => (
  <div className="flex h-full min-h-0">
    <div className="min-h-0 min-w-0 flex-1">{children}</div>
    {open ? (
      <>
        <Divider orientation="vertical" />
        <div className="flex min-h-0 w-80 shrink-0 flex-col">{panel}</div>
      </>
    ) : null}
  </div>
);
