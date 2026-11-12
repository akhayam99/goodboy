import { DRAWER_TIERS, type DrawerSizing } from '../drawerGeometry';
import {
  BROWSER_DRAWER_STORAGE_KEY,
  READER_DRAWER_STORAGE_KEY,
  RIGHT_DRAWER_STORAGE_KEY,
} from '../drawerWidthKeys';
import { useResizableWidth, type ResizableWidth, type WidthVar } from '../useResizableWidth';

type Params = {
  readonly sizing: DrawerSizing;
  readonly onPreview: (width: number) => void;
};

type TierParams = Pick<Params, 'onPreview'> & {
  readonly tier: DrawerSizing;
  readonly storageKey: string;
  readonly cssVar: WidthVar;
};

const useTierWidth = ({ tier, storageKey, cssVar, onPreview }: TierParams) =>
  useResizableWidth<HTMLElement>({
    storageKey,
    defaultWidth: DRAWER_TIERS[tier].fallback,
    min: DRAWER_TIERS[tier].min,
    max: DRAWER_TIERS[tier].max,
    cssVar,
    onPreview,
  });

export const useDrawerTierWidths = ({ sizing, onPreview }: Params): ResizableWidth<HTMLElement> => {
  const side = useTierWidth({
    tier: 'side',
    storageKey: RIGHT_DRAWER_STORAGE_KEY,
    cssVar: '--goodboy-drawer-width',
    onPreview,
  });
  const reader = useTierWidth({
    tier: 'reader',
    storageKey: READER_DRAWER_STORAGE_KEY,
    cssVar: '--goodboy-reader-drawer-width',
    onPreview,
  });
  const browser = useTierWidth({
    tier: 'browser',
    storageKey: BROWSER_DRAWER_STORAGE_KEY,
    cssVar: '--goodboy-browser-drawer-width',
    onPreview,
  });
  return { side, reader, browser }[sizing];
};
