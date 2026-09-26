import type { ReactNode, Ref } from 'react';
import { Divider, DrawerColumn } from '@goodboy/ui';

type Props = {
  readonly bodyRef?: Ref<HTMLDivElement>;
  readonly rail: ReactNode;
  readonly list: ReactNode;
  readonly drawer: ReactNode;
  readonly drawerRef?: Ref<HTMLElement>;
};

export const InboxStudioLayout = ({ bodyRef, rail, list, drawer, drawerRef }: Props) => (
  <DrawerColumn
    className="h-full"
    main={
      <div ref={bodyRef} className="flex min-h-0 min-w-0 flex-1">
        {rail == null ? null : (
          <aside aria-label="Inbox filters" className="flex min-h-0 w-64 shrink-0 flex-col">
            {rail}
          </aside>
        )}
        {rail == null ? null : <Divider orientation="vertical" />}
        <div className="min-h-0 min-w-0 flex-1">{list}</div>
      </div>
    }
    drawer={drawer ?? null}
    ariaLabel="Inbox item"
    resizeLabel="Resize the item panel"
    {...(drawerRef !== undefined && { drawerRef })}
  />
);
