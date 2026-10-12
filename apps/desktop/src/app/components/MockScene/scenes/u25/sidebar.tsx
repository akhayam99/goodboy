import { SidebarNavColumnScene } from '../u23/SidebarNavColumnScene';

const RHYTHM = { pinCount: 3 } as const;
const META_ONE = { lens: 'agents', branches: 1, pinCount: 2 } as const;
const META_MANY = { lens: 'agents', branches: 3, pinCount: 2 } as const;

export const U25_SIDEBAR_SCENES = {
  'sidebar-rhythm': () => <SidebarNavColumnScene config={RHYTHM} />,
  'sidebar-meta-branch': () => <SidebarNavColumnScene config={META_ONE} />,
  'sidebar-meta-branches': () => <SidebarNavColumnScene config={META_MANY} />,
};
