import type { ReactNode, Ref } from 'react';
import { Divider } from '@goodboy/ui';

type Props = {
  readonly bodyRef?: Ref<HTMLDivElement>;
  readonly rail: ReactNode;
  readonly list: ReactNode;
  readonly detail: ReactNode;
};

export const InboxStudioLayout = ({ bodyRef, rail, list, detail }: Props) => (
  <div className="flex h-full min-h-0 flex-1">
    <div ref={bodyRef} className="flex min-h-0 min-w-0 flex-1">
      {rail == null ? null : (
        <aside aria-label="Inbox filters" className="flex min-h-0 w-64 shrink-0 flex-col">
          {rail}
        </aside>
      )}
      {rail == null ? null : <Divider orientation="vertical" />}
      <div className="min-h-0 min-w-0 flex-1">{list}</div>
    </div>
    {detail == null ? null : <Divider orientation="vertical" />}
    {detail}
  </div>
);
