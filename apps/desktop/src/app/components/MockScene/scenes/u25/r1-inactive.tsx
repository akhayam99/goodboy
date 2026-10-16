import { InactiveSessionsScene } from './r1InactiveScene';

export const U25_R1_INACTIVE_SCENES = {
  'r1-inactive-sidebar': () => <InactiveSessionsScene group="none" pageView={null} />,
  'r1-inactive-sidebar-grouped': () => <InactiveSessionsScene group="project" pageView={null} />,
  'r1-inactive-list': () => <InactiveSessionsScene group="none" pageView="list" />,
  'r1-inactive-list-grouped': () => <InactiveSessionsScene group="stage" pageView="list" />,
};
