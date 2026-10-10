import type { ReactNode, Ref } from 'react';
import { DrawerColumn, StudioRailLayout, useStudioRailFold } from '@goodboy/ui';

export type InboxRailState = {
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

export const InboxStudioLayout = ({ rail, railHeader, list, drawer, drawerRef }: Props) => {
  const fold = useStudioRailFold({ surface: 'inbox' });

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
          <DrawerColumn
            className="h-full"
            main={
              <div className="flex min-h-0 min-w-0 flex-1">
                {list({
                  isRailCollapsed: fold.isCollapsed,
                  onDock: fold.canDock ? () => fold.setFolded(false) : undefined,
                })}
              </div>
            }
            drawer={drawer ?? null}
            ariaLabel="Task"
            resizeLabel="Resize the item panel"
            {...(drawerRef !== undefined && { drawerRef })}
          />
        }
      />
    </div>
  );
};
