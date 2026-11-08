import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
};

export const BranchWorkNotice = ({ children }: Props) => (
  <li className="col-span-full grid grid-cols-subgrid">
    <div className="col-start-2 col-end-[-2] min-w-0">{children}</div>
  </li>
);
