import { SidebarNavColumnScene } from '../u23/SidebarNavColumnScene';

const RHYTHM = { pinCount: 3 } as const;

export const U25_SIDEBAR_SCENES = {
  'sidebar-rhythm': () => <SidebarNavColumnScene config={RHYTHM} />,
};
