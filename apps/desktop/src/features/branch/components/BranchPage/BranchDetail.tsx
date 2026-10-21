import { useContext, type ReactNode } from 'react';
import { PageTrailContext } from '@goodboy/ui';
import { useStudioBand } from '../../../../shared/components/StudioShell/studioBandContext';

type Props = {
  readonly children: ReactNode;
};

export const BranchDetail = ({ children }: Props) => {
  const band = useStudioBand();
  const trail = useContext(PageTrailContext);
  return (
    <div data-studio-detail="" className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {band === null ? null : <div className="flex shrink-0 flex-col">{band}</div>}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PageTrailContext.Provider value={band === null ? trail : null}>
          {children}
        </PageTrailContext.Provider>
      </div>
    </div>
  );
};
