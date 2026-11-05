import type { ReactNode } from 'react';
import { ObjectMenuArea } from './components/ObjectMenuArea';
import type { ObjectTarget } from './types';

type Props = {
  readonly target: ObjectTarget;
  readonly anchorKey: string;
  readonly children: ReactNode;
};

export const ActionCardMenuArea = ({ target, anchorKey, children }: Props) => (
  <ObjectMenuArea target={target} anchorKey={anchorKey}>
    {children}
  </ObjectMenuArea>
);
