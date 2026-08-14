import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
  readonly portal: boolean;
  readonly portalTarget: Element;
};

export const DropdownPortal = ({ children, portal, portalTarget }: Props) => {
  if (!portal) {
    return children;
  }
  return createPortal(<div data-dropdown-portal>{children}</div>, portalTarget);
};
