import type { ReactNode, Ref } from 'react';
import { DrawerColumn } from '@goodboy/ui';

type Props = {
  readonly list: ReactNode;
  readonly drawer: ReactNode;
  readonly drawerRef?: Ref<HTMLElement>;
};

export const InboxStudioLayout = ({ list, drawer, drawerRef }: Props) => (
  <DrawerColumn
    className="h-full"
    main={<div className="flex min-h-0 min-w-0 flex-1">{list}</div>}
    drawer={drawer ?? null}
    ariaLabel="Inbox item"
    resizeLabel="Resize the item panel"
    {...(drawerRef !== undefined && { drawerRef })}
  />
);
