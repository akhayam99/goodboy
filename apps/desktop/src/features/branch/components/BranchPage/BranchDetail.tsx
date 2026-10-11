import type { ReactNode } from 'react';
import { useStudioBand } from '../../../../shared/components/StudioShell/studioBandContext';

type Props = {
  readonly sectionsButton: ReactNode;
  readonly isInert: boolean;
  readonly children: ReactNode;
};

export const BranchDetail = ({ sectionsButton, isInert, children }: Props) => {
  const band = useStudioBand();
  return (
    <div
      data-studio-detail=""
      inert={isInert}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
    >
      {sectionsButton === null && band === null ? null : (
        <div className="flex shrink-0 items-start gap-2">
          {sectionsButton}
          <div className="flex min-w-0 flex-1 flex-col">{band}</div>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
};
