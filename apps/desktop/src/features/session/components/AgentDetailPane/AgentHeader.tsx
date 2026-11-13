import { PaneTitleRow } from '@goodboy/ui';
import type { ReactNode, Ref } from 'react';

type Props = {
  readonly title: ReactNode;
  readonly actions: ReactNode;
  readonly meta?: ReactNode;
  readonly below?: ReactNode;
  readonly rootRef?: Ref<HTMLDivElement>;
};

export const AgentHeader = ({ title, actions, meta = null, below = null, rootRef }: Props) => {
  return (
    <div ref={rootRef} className="flex min-w-0 flex-col gap-2">
      <PaneTitleRow
        rowTestId="agent-header-title-row"
        title={title}
        meta={meta}
        actions={actions}
      />
      {below}
    </div>
  );
};
