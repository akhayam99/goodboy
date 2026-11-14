import { WorkLeadTreeScene } from './WorkLeadTreeScene';

export const WORK_LEAD_TREE_SCENES = {
  'work-lead-tree': () => <WorkLeadTreeScene theme="dark" density="full" />,
  'work-lead-tree-light': () => <WorkLeadTreeScene theme="light" density="full" />,
  'work-lead-tree-compact': () => <WorkLeadTreeScene theme="dark" density="compact" />,
};
