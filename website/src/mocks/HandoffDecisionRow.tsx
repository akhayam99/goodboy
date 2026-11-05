import type { ReactNode } from 'react';

type Props = {
  readonly number: number;
  readonly source: string;
  readonly children: ReactNode;
  readonly isHot?: boolean;
  readonly isOld?: boolean;
  readonly label?: ReactNode;
};

export const HandoffDecisionRow = ({
  number,
  source,
  children,
  isHot = false,
  isOld = false,
  label,
}: Props) => (
  <div className="hmDec" data-hot={isHot ? '' : undefined} data-old={isOld ? '' : undefined}>
    <span className="hmNum">{number}</span>
    <div className="hmDecBody">
      <div className="hmDecText">
        {children}
        {label}
      </div>
      <div className="hmDecSource">{source}</div>
    </div>
  </div>
);
