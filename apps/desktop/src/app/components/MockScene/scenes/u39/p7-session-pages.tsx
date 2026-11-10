import type { ComponentType } from 'react';
import { C08RunScene } from '../u25/C08RunScene';
import { LevelsScene } from '../u25/c02LevelsScene';
import { P7FoldedMenuScene } from './P7FoldedMenuScene';

const OPEN = { isBusy: true } as const;
const OPEN_BRANCHLESS = { branches: 0, isBusy: true } as const;
const FOLDED = { isBusy: true, isRailFolded: true } as const;
const FOLDED_BRANCHLESS = { branches: 0, isBusy: true, isRailFolded: true } as const;

export const U39_P7_SCENES = {
  'ux39-p7-open': () => <LevelsScene config={OPEN} />,
  'ux39-p7-open-branchless': () => <LevelsScene config={OPEN_BRANCHLESS} />,
  'ux39-p7-folded': () => <LevelsScene config={FOLDED} />,
  'ux39-p7-folded-branchless': () => <LevelsScene config={FOLDED_BRANCHLESS} />,
  'ux39-p7-folded-menu': P7FoldedMenuScene,
  'ux39-p7-runs-waiting': () => <C08RunScene state="capped" selection="list" />,
  'ux39-p7-runs-waiting-folded': () => <C08RunScene state="capped" selection="list" isFolded />,
} satisfies Readonly<Record<string, ComponentType>>;
