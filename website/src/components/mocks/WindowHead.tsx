import type { ReactNode } from 'react';

type Props = {
  readonly title: string;
  readonly sub?: string;
  readonly side: ReactNode;
};

export const WindowHead = ({ title, sub, side }: Props) => (
  <div className="mk-whead">
    <div className="mk-wtitle">
      <span className="mk-wname mk-ell">{title}</span>
      {sub === undefined ? null : <span className="mk-wsub mk-ell">{sub}</span>}
    </div>
    <div className="mk-wside">{side}</div>
  </div>
);
