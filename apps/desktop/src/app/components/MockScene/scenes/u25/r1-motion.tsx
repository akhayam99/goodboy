import { MotionShellScene } from './r1MotionShellScene';

export const U25_R1_MOTION_SCENES = {
  'r1-motion-shell-open': () => <MotionShellScene isFolded={false} />,
  'r1-motion-shell-folded': () => <MotionShellScene isFolded />,
};
