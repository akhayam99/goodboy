import type { ReactNode } from 'react';
import { PageColumn } from '@goodboy/ui';

type Props = {
  readonly children: ReactNode;
};

export const BranchBodyColumn = ({ children }: Props) => (
  <PageColumn
    width="column"
    className="flex min-h-0 min-w-0 flex-1 flex-col px-0 @max-[720px]:px-0"
  >
    {children}
  </PageColumn>
);
