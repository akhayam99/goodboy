import type { ReactNode } from 'react';
import { useStudioBand } from './studioBandContext';

type Props = {
  readonly children: ReactNode;
};

export const StudioDetail = ({ children }: Props) => {
  const band = useStudioBand();
  return (
    <div data-studio-detail="" className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {band}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
};
