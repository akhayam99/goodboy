import { LevelsScene } from '../u25/c02LevelsScene';
import { U23_FRAME_SCENES } from '../u23/frame';
import { RailFootScene } from './RailFootScene';
import { RailProjectsScene } from './RailProjectsScene';

const SIGNALS = { isBusy: true, place: 'board' } as const;

export const U26_SHELL_SCENES = {
  'u26-rail-projects': () => <RailProjectsScene opens="none" />,
  'u26-rail-projects-focus': () => <RailProjectsScene opens="focus" />,
  'u26-rail-projects-picker': () => <RailProjectsScene opens="picker" />,
  'u26-sidebar-signals': () => <LevelsScene config={SIGNALS} />,
  'u26-sidebar-impact': U23_FRAME_SCENES['frame-studio-impact'],
  'u26-rail-foot-archive': () => <RailFootScene isArchiveAsking />,
};
