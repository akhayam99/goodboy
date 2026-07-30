import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
  readonly portal: boolean;
};

export const DropdownPortal = ({ children, portal }: Props) => {
  if (!portal) {
    return children;
  }
  return createPortal(children, document.body);
};
