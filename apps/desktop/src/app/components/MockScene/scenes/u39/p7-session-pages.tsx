import type { ComponentType } from 'react';
import { C08RunScene } from '../u25/C08RunScene';
import { LevelsScene } from '../u25/c02LevelsScene';
import { P7SessionMenuScene } from './P7SessionMenuScene';

const OPEN = { isBusy: true } as const;
const OPEN_BRANCHLESS = { branches: 0, isBusy: true } as const;

export const U39_P7_SCENES = {
  'ux39-p7-open': () => <LevelsScene config={OPEN} />,
  'ux39-p7-open-branchless': () => <LevelsScene config={OPEN_BRANCHLESS} />,
  'ux39-p7-session-menu': P7SessionMenuScene,
  'ux39-p7-runs-waiting': () => <C08RunScene state="capped" selection="list" />,
} satisfies Readonly<Record<string, ComponentType>>;
