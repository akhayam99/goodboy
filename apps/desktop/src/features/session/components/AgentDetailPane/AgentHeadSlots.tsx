import type { ReactNode } from 'react';
import { HeadSlotPortal } from '../HeadSlotPortal';

type Props = {
  readonly title: ReactNode;
  readonly actions: ReactNode;
  readonly isRunStep: boolean;
};

export const AgentHeadSlots = ({ title, actions, isRunStep }: Props) => {
  if (!isRunStep) {
    return <HeadSlotPortal slot="title">{title}</HeadSlotPortal>;
  }
  return (
    <HeadSlotPortal slot="meta" isPageHeading>
      <span className="flex min-w-0 items-center gap-3 text-meta text-muted-foreground">
        {title}
        {actions}
      </span>
    </HeadSlotPortal>
  );
};
