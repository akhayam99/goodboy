import type { ReactNode, Ref } from 'react';
import { DrawerColumn, StudioRailLayout, useStudioRailFold } from '@goodboy/ui';
import { useStudioDrawer } from '../../../../shared/hooks/useStudioDrawer';

type InboxRailState = {
  readonly isRailCollapsed: boolean;
  readonly onDock: (() => void) | undefined;
};

type Props = {
  readonly rail: ReactNode;
  readonly railHeader: ReactNode;
  readonly list: (state: InboxRailState) => ReactNode;
  readonly drawer: ReactNode;
  readonly drawerRef?: Ref<HTMLElement>;
};

const ARIA_LABEL = 'Task';
const RESIZE_LABEL = 'Resize the item panel';

export const InboxStudioLayout = ({ rail, railHeader, list, drawer, drawerRef }: Props) => {
  const fold = useStudioRailFold({ surface: 'inbox' });
  const isHosted = useStudioDrawer({
    node: drawer ?? null,
    ariaLabel: ARIA_LABEL,
    resizeLabel: RESIZE_LABEL,
    ...(drawerRef !== undefined && { drawerRef }),
  });
  const main = (
    <div className="flex min-h-0 min-w-0 flex-1">
      {list({
        isRailCollapsed: fold.isCollapsed,
        onDock: fold.canDock ? () => fold.setFolded(false) : undefined,
      })}
    </div>
  );

  return (
    <div ref={fold.paneRef} className="flex h-full min-h-0 min-w-0 flex-1">
      <StudioRailLayout
        railLabel="Task filters"
        railWidth="standard"
        surface="inbox"
        placement="page"
        rail={rail}
        railHeader={railHeader}
        isCollapsed={fold.isCollapsed}
        onCollapsedChange={fold.setFolded}
        detail={
          isHosted ? (
            main
          ) : (
            <DrawerColumn
              className="h-full"
              main={main}
              drawer={drawer ?? null}
              ariaLabel={ARIA_LABEL}
              resizeLabel={RESIZE_LABEL}
              {...(drawerRef !== undefined && { drawerRef })}
            />
          )
        }
      />
    </div>
  );
};
