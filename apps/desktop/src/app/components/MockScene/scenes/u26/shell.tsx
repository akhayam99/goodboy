import { LevelsScene } from '../u25/c02LevelsScene';
import { U23_FRAME_SCENES } from '../u23/frame';
import { FilterScene } from './FilterScene';
import { RailFootScene } from './RailFootScene';
import { RailProjectsScene } from './RailProjectsScene';
import { SidebarPortsScene } from './SidebarPortsScene';

const SIGNALS = { isBusy: true, place: 'board' } as const;

export const U26_SHELL_SCENES = {
  'u26-rail-projects': () => <RailProjectsScene opens="none" />,
  'u26-rail-projects-focus': () => <RailProjectsScene opens="focus" />,
  'u26-rail-projects-picker': () => <RailProjectsScene opens="picker" />,
  'u26-sidebar-signals': () => <LevelsScene config={SIGNALS} />,
  'u26-sidebar-ports': SidebarPortsScene,
  'u26-sidebar-impact': U23_FRAME_SCENES['frame-studio-impact'],
  'u26-filter-default': () => <FilterScene isActive={false} />,
  'u26-filter-active': () => <FilterScene isActive />,
  'u26-rail-foot': () => <RailFootScene isArchiveAsking={false} />,
  'u26-rail-foot-archive': () => <RailFootScene isArchiveAsking />,
};
