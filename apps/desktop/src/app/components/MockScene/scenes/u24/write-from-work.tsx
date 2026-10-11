import { GoalFromWorkScene } from './GoalFromWorkScene';

export const U24_WRITE_FROM_WORK_SCENES = {
  goalhint: () => <GoalFromWorkScene variant="hint" />,
  goalproposal: () => <GoalFromWorkScene variant="proposal" />,
  goalreplace: () => <GoalFromWorkScene variant="replace" />,
  goaltitlesonly: () => <GoalFromWorkScene variant="titlesonly" />,
};
