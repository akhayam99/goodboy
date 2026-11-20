import type { ReactNode, Ref } from 'react';
import type { DockGridSpec } from '../dockGridSpec';
import type { DrawerPlacement, DrawerSizing } from '../drawerGeometry';
import type { SheetEdge } from '../sheet';

export type DrawerColumnFrame = 'sheet' | 'none';

export type DrawerColumnProps = {
  readonly main: ReactNode;
  readonly drawer?: ReactNode | null;
  readonly drawerKey?: string;
  readonly dockGrid?: DockGridSpec | null;
  readonly detail?: ReactNode | null;
  readonly detailKey?: string;
  readonly detailKind?: string | null;
  readonly detailSizing?: DrawerSizing;
  readonly isDetailParked?: boolean;
  readonly detailResizeLabel?: string;
  readonly ariaLabel: string;
  readonly resizeLabel: string;
  readonly drawerRef?: Ref<HTMLElement>;
  readonly sizing?: DrawerSizing;
  readonly placement?: DrawerPlacement;
  readonly frame?: DrawerColumnFrame;
  readonly sheetEdge?: Exclude<SheetEdge, 'pushed'>;
  readonly isParked?: boolean;
  readonly className?: string;
};
