import type { ReactNode, Ref } from 'react';
import {
  Divider,
  DrawerColumn,
  ResizeHandle,
  STUDIO_RAIL_MAX,
  STUDIO_RAIL_MIN,
  STUDIO_RAIL_WIDTHS,
  studioRailStorageKey,
  useResizableWidth,
} from '@goodboy/ui';

type Props = {
  readonly bodyRef?: Ref<HTMLDivElement>;
  readonly rail: ReactNode;
  readonly list: ReactNode;
  readonly drawer: ReactNode;
  readonly drawerRef?: Ref<HTMLElement>;
};

const RAIL_WIDTH_VAR = '--goodboy-inbox-rail-width';

export const InboxStudioLayout = ({ bodyRef, rail, list, drawer, drawerRef }: Props) => {
  const resizable = useResizableWidth<HTMLElement>({
    storageKey: studioRailStorageKey({ surface: 'inbox' }),
    defaultWidth: STUDIO_RAIL_WIDTHS.narrow,
    min: STUDIO_RAIL_MIN,
    max: STUDIO_RAIL_MAX,
    cssVar: RAIL_WIDTH_VAR,
  });
  return (
    <DrawerColumn
      className="h-full"
      main={
        <div ref={bodyRef} className="flex min-h-0 min-w-0 flex-1">
          {rail == null ? null : (
            <aside
              ref={resizable.targetRef}
              aria-label="Inbox filters"
              style={{ ...resizable.style, width: `var(${RAIL_WIDTH_VAR})` }}
              className="relative flex min-h-0 shrink-0 flex-col"
            >
              {rail}
              <div className="absolute inset-y-0 -right-1 z-10 flex">
                <ResizeHandle {...resizable.handleProps} ariaLabel="Resize inbox filters" />
              </div>
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
};
