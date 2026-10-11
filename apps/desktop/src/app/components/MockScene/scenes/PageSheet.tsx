import type { ReactNode } from 'react';
import { DrawerColumn } from '@goodboy/ui';

type Props = {
  readonly children: ReactNode;
};

export const PageSheet = ({ children }: Props) => (
  <DrawerColumn
    frame="sheet"
    main={children}
    ariaLabel="Side panel"
    resizeLabel="Resize side panel"
  />
);
