import type { ReactNode } from 'react';
import { useObjectMenuTrigger } from '../useObjectMenuTrigger';
import type { ObjectTarget } from '../types';

type Props = {
  readonly target: ObjectTarget;
  readonly anchorKey: string;
  readonly children: ReactNode;
};

export const ObjectMenuArea = ({ target, anchorKey, children }: Props) => {
  const menu = useObjectMenuTrigger({ target, anchorKey });
  return (
    <div className="contents" onContextMenu={menu.onContextMenu} onKeyDown={menu.onKeyDown}>
      {children}
    </div>
  );
};
