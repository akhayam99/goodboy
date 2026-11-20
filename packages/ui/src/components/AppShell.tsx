import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../cn';
import { DrawerColumn } from './DrawerColumn';
import type { DrawerPlacement, DrawerSizing } from '../drawerGeometry';
import type { DockGridSpec } from '../dockGridSpec';
import { ShellDockContext } from '../shellDockContext';
import { ShellRailContext } from '../shellRailContext';
import { StudioSlotContext } from '../studioSlotContext';

export type AppShellProps = {
  readonly topBar?: ReactNode;
  readonly footer?: ReactNode;
  readonly leftRail?: ReactNode;
  readonly main: ReactNode;
  readonly drawer?: ReactNode;
  readonly drawerSizing?: DrawerSizing;
  readonly dockGrid?: DockGridSpec | null;
  readonly detail?: ReactNode;
  readonly detailSizing?: DrawerSizing;
  readonly detailKind?: string | null;
  readonly isDetailParked?: boolean;
  readonly drawerPlacement?: DrawerPlacement;
  readonly studio?: ReactNode;
  readonly isDockInStudio?: boolean;
  readonly rightRail?: ReactNode;
  readonly isDrawerParked?: boolean;
  readonly className?: string;
};

export const COLLAPSED_RAIL_WIDTH = 44;

const STUDIO_SHEET_OWNED =
  '[&>[data-drawer-main]:has([data-studio-sheet-owner])]:rounded-none [&>[data-drawer-main]:has([data-studio-sheet-owner])]:border-0 [&>[data-drawer-main]:has([data-studio-sheet-owner])]:bg-transparent';

type LayoutParams = {
  readonly hasLeftRail: boolean;
  readonly hasFooter: boolean;
};

type Layout = {
  readonly templateAreas: string;
  readonly templateColumns: string;
  readonly templateRows: string;
};

const buildLayout = ({ hasLeftRail, hasFooter }: LayoutParams): Layout => {
  const rows = hasFooter ? 'minmax(0,1fr) auto' : 'minmax(0,1fr)';
  if (!hasLeftRail) {
    return {
      templateAreas: hasFooter ? '"main" "footer"' : '"main"',
      templateColumns: 'minmax(0,1fr)',
      templateRows: rows,
    };
  }
  return {
    templateAreas: hasFooter ? '"left main" "footer footer"' : '"left main"',
    templateColumns: 'auto minmax(0,1fr)',
    templateRows: rows,
  };
};

export const AppShell = ({
  topBar,
  footer,
  leftRail,
  main,
  drawer,
  drawerSizing,
  dockGrid = null,
  detail,
  detailSizing,
  detailKind = null,
  isDetailParked,
  drawerPlacement,
  studio,
  isDockInStudio = false,
  rightRail,
  isDrawerParked,
  className,
}: AppShellProps) => {
  const hasFooter = footer != null;
  const hasLeftRail = leftRail != null;
  const isStudioShown = studio != null;
  const isDockHosted = isStudioShown && isDockInStudio;

  const layout = buildLayout({ hasLeftRail, hasFooter });
  const gridStyle = {
    gridTemplateAreas: layout.templateAreas,
    gridTemplateColumns: layout.templateColumns,
    gridTemplateRows: layout.templateRows,
  } satisfies CSSProperties;

  return (
    <div data-app-backdrop="" className="flex h-screen w-screen flex-col bg-backdrop">
      {topBar != null ? <div className="shrink-0">{topBar}</div> : null}
      <div
        className={cn('grid min-h-0 w-full flex-1 overflow-hidden text-foreground', className)}
        style={gridStyle}
      >
        {hasLeftRail ? (
          <aside
            className="flex min-h-0 min-w-0 flex-col overflow-hidden"
            style={{ gridArea: 'left' }}
          >
            {leftRail}
          </aside>
        ) : null}
        <main className="flex min-h-0 min-w-0 flex-col" style={{ gridArea: 'main' }}>
          <DrawerColumn
            main={
              <div className="flex min-h-0 min-w-0 flex-1">
                <div
                  data-studio-host=""
                  className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col"
                >
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col" inert={isStudioShown}>
                    <ShellRailContext.Provider value={rightRail != null || isStudioShown}>
                      {main}
                    </ShellRailContext.Provider>
                  </div>
                  {isStudioShown ? (
                    <div
                      data-studio-slot="content"
                      className="absolute inset-0 z-studio flex min-h-0 min-w-0 flex-col overflow-hidden bg-background empty:hidden has-[[data-studio-sheet-owner]]:bg-chrome"
                    >
                      <StudioSlotContext.Provider value>
                        <ShellDockContext.Provider
                          value={isDockHosted ? { node: drawer ?? null, grid: dockGrid } : null}
                        >
                          {studio}
                        </ShellDockContext.Provider>
                      </StudioSlotContext.Provider>
                    </div>
                  ) : null}
                </div>
                {rightRail}
              </div>
            }
            drawer={isDockHosted ? null : (drawer ?? null)}
            dockGrid={isDockHosted ? null : dockGrid}
            sizing={drawerSizing}
            detail={detail ?? null}
            detailSizing={detailSizing}
            detailKind={detailKind}
            isDetailParked={isDetailParked ?? isStudioShown}
            placement={drawerPlacement}
            isParked={isDrawerParked ?? isStudioShown}
            frame="sheet"
            sheetEdge={hasLeftRail ? 'wrapped' : 'flush'}
            className={STUDIO_SHEET_OWNED}
            ariaLabel="Side panel"
            resizeLabel="Resize side panel"
          />
        </main>
        {hasFooter ? (
          <div className="shrink-0" style={{ gridArea: 'footer' }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};
