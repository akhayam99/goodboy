import { SidebarNavColumnScene } from './SidebarNavColumnScene';
import { SidebarNavRailScene } from './SidebarNavRailScene';
import { SwitcherPinnedScene } from './SwitcherPinnedScene';

const TERMINAL = { lens: 'terminal' } as const;
const BRANCHES = { lens: 'branch', branches: 3, hasPullRequest: true } as const;
const BRANCHES_MANY = { lens: 'branch', branches: 6 } as const;
const FOLDED = { lens: 'agents', isFolded: true } as const;
const STUDIO_OVER = { lens: 'agents' } as const;
const FLYOUT = { branches: 3, pinCount: 2, hasPullRequest: true } as const;
const PINNED = { pinCount: 9 } as const;
const DRAFT = { hasDraft: true } as const;

export const U23_SIDEBAR_NAV_SCENES = {
  'sidebar-terminal-current': () => <SidebarNavColumnScene config={TERMINAL} />,
  'sidebar-branches': () => <SidebarNavColumnScene config={BRANCHES} />,
  'sidebar-branches-many': () => <SidebarNavColumnScene config={BRANCHES_MANY} />,
  'sidebar-pages-folded': () => <SidebarNavColumnScene config={FOLDED} />,
  'session-studio-over': () => <SidebarNavColumnScene config={STUDIO_OVER} place="inbox" />,
  'rail-flyout': () => <SidebarNavRailScene config={FLYOUT} isHovered />,
  'rail-pinned': () => <SidebarNavRailScene config={PINNED} />,
  'rail-draft-dot': () => <SidebarNavRailScene config={DRAFT} />,
  'switcher-pinned': SwitcherPinnedScene,
};
