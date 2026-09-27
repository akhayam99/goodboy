import type { ReactNode } from 'react';

type Props = {
  readonly href: string;
  readonly children: ReactNode;
};

export const More = ({ href, children }: Props) => (
  <a className="more" href={href}>
    {children} <span className="arr">→</span>
  </a>
);
