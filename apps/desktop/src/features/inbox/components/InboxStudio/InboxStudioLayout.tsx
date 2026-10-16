import type { ReactNode, Ref } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import { useStudioDrawer } from '../../../../shared/hooks/useStudioDrawer';
import { StudioDetail } from '../../../../shared/components/StudioShell/StudioDetail';

type Props = {
  readonly main: ReactNode;
  readonly drawer: ReactNode;
  readonly drawerRef?: Ref<HTMLElement>;
};

const ARIA_LABEL = 'Task';
const RESIZE_LABEL = 'Resize the task pane';

export const InboxStudioLayout = ({ main, drawer, drawerRef }: Props) => {
  const isHosted = useStudioDrawer({
    node: drawer ?? null,
    ariaLabel: ARIA_LABEL,
    resizeLabel: RESIZE_LABEL,
    sizing: 'reader',
    ...(drawerRef !== undefined && { drawerRef }),
  });
  const page = <StudioDetail>{main}</StudioDetail>;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      {isHosted ? (
        page
      ) : (
        <DrawerColumn
          className="h-full"
          main={page}
          drawer={drawer ?? null}
          sizing="reader"
          ariaLabel={ARIA_LABEL}
          resizeLabel={RESIZE_LABEL}
          {...(drawerRef !== undefined && { drawerRef })}
        />
      )}
    </div>
  );
};
