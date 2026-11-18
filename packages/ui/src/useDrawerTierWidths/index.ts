import type { DrawerSizing } from '../drawerGeometry';
import type { ResizableWidth } from '../useResizableWidth';
import { useDrawerTierWidthSet } from '../useDrawerTierWidthSet';

type Params = {
  readonly sizing: DrawerSizing;
  readonly onPreview: (width: number) => void;
};

export const useDrawerTierWidths = ({ sizing, onPreview }: Params): ResizableWidth<HTMLElement> =>
  useDrawerTierWidthSet({ onPreview })[sizing];
