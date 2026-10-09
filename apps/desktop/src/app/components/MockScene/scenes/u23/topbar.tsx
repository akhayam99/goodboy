import type { ComponentType } from 'react';
import { BoardShellScene } from '../BoardShellScene';
import { ChatRoomScene } from '../ChatRoomScene';
import { ShellScene } from '../ShellScene';
import { BrandStorageScene } from '../brand/StorageScene';
import { FeaturesImpactOverviewScene } from '../features/ImpactOverviewScene';
import { PaletteStableHeightScene } from './topbar/PaletteStableHeightScene';
import { TopbarStatesScene } from './topbar/TopbarStatesScene';
import { WorkspaceSwitcherSingleScene } from './topbar/WorkspaceSwitcherSingleScene';

export const U23_TOPBAR_SCENES: Readonly<Record<string, ComponentType>> = {
  'topbar-states': () => <TopbarStatesScene Inner={BoardShellScene} providerCount={3} />,
  'topbar-1100': () => <TopbarStatesScene Inner={ShellScene} providerCount={3} width={1100} />,
  'topbar-limits-overflow': () => (
    <TopbarStatesScene Inner={BoardShellScene} providerCount={4} width={1000} />
  ),
  'palette-stable-height': () => <PaletteStableHeightScene initialQuery="" />,
  'palette-stable-height-typing': () => (
    <PaletteStableHeightScene initialQuery="is the export streaming?" />
  ),
  'chat-list-idle': ChatRoomScene,
  'impact-stat-cards': FeaturesImpactOverviewScene,
  'storage-other-tools': BrandStorageScene,
  'workspace-switcher-single': WorkspaceSwitcherSingleScene,
};
