import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  readonly node?: HTMLElement | null;
  readonly children: ReactNode;
};

export const Docked = ({ node, children }: Props) => {
  if (node === undefined) {
    return <>{children}</>;
  }
  return node === null ? null : createPortal(children, node);
};
