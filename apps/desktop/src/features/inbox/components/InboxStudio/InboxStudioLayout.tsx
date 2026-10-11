import type { ReactNode, Ref } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import { useStudioDrawer } from '../../../../shared/hooks/useStudioDrawer';

type Props = {
  readonly list: ReactNode;
  readonly drawer: ReactNode;
  readonly drawerRef?: Ref<HTMLElement>;
};

const ARIA_LABEL = 'Task';
const RESIZE_LABEL = 'Resize the item panel';

export const InboxStudioLayout = ({ list, drawer, drawerRef }: Props) => {
  const isHosted = useStudioDrawer({
    node: drawer ?? null,
    ariaLabel: ARIA_LABEL,
    resizeLabel: RESIZE_LABEL,
    ...(drawerRef !== undefined && { drawerRef }),
  });
  const main = <div className="flex min-h-0 min-w-0 flex-1">{list}</div>;
  if (isHosted) {
    return main;
  }
  return (
    <DrawerColumn
      className="h-full"
      main={main}
      drawer={drawer ?? null}
      ariaLabel={ARIA_LABEL}
      resizeLabel={RESIZE_LABEL}
      {...(drawerRef !== undefined && { drawerRef })}
    />
  );
};
