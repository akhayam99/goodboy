import { SidebarNavColumnScene } from './SidebarNavColumnScene';
import { SidebarNavRailScene } from './SidebarNavRailScene';
import { SwitcherPinnedScene } from './SwitcherPinnedScene';

const STUDIO_OVER = { lens: 'agents' } as const;
const FLYOUT = { branches: 3, pinCount: 2, hasPullRequest: true } as const;
const PINNED = { pinCount: 9 } as const;
const DRAFT = { hasDraft: true } as const;

export const U23_SIDEBAR_NAV_SCENES = {
  'session-studio-over': () => <SidebarNavColumnScene config={STUDIO_OVER} place="inbox" />,
  'rail-flyout': () => <SidebarNavRailScene config={FLYOUT} isHovered />,
  'rail-pinned': () => <SidebarNavRailScene config={PINNED} />,
  'rail-draft-dot': () => <SidebarNavRailScene config={DRAFT} />,
  'switcher-pinned': SwitcherPinnedScene,
};
