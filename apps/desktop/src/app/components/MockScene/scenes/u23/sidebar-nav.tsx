import { SidebarNavColumnScene } from './SidebarNavColumnScene';
import { SwitcherPinnedScene } from './SwitcherPinnedScene';

const STUDIO_OVER = { lens: 'workflows' } as const;

export const U23_SIDEBAR_NAV_SCENES = {
  'session-studio-over': () => <SidebarNavColumnScene config={STUDIO_OVER} place="inbox" />,
  'switcher-pinned': SwitcherPinnedScene,
};
