import './Stage.css';
import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
  readonly isRevealed?: boolean;
};

export const Stage = ({ children, isRevealed = true }: Props) => (
  <div className="stage" data-reveal={isRevealed ? '' : undefined}>
    {children}
  </div>
);
