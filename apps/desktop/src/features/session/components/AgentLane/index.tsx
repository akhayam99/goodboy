import type { ReactNode } from 'react';

type Props = {
  readonly toolbar?: ReactNode;
  readonly isEmpty: boolean;
  readonly empty: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
};

export const AgentLane = ({ toolbar, isEmpty, empty, footer, children }: Props) => (
  <div className="flex flex-col gap-3">
    {toolbar}
    {isEmpty && empty}
    {children}
    {footer}
  </div>
);
