import './mocks.css';
import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly isHero?: boolean;
};

export const MockStage = ({ label, children, className, isHero = false }: Props) => (
  <figure
    className={['mockStage', className].filter(Boolean).join(' ')}
    aria-label={label}
    data-hero-mock={isHero ? '' : undefined}
  >
    {children}
  </figure>
);
