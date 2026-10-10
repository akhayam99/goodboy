import type {
  LinearTeamMember,
  LinearWorkflowState,
} from '../../../../features/integrations/linear/client';

const STATES: ReadonlyArray<LinearWorkflowState> = [
  { id: 'mock-state-backlog', name: 'Backlog', type: 'backlog', position: 0 },
  { id: 'mock-state-todo', name: 'Todo', type: 'unstarted', position: 1 },
  { id: 'mock-state-progress', name: 'In Progress', type: 'started', position: 2 },
  { id: 'mock-state-done', name: 'Done', type: 'completed', position: 3 },
];

const MEMBERS: ReadonlyArray<LinearTeamMember> = [
  { id: 'mock-member-robin', name: 'Robin V.', active: true },
  { id: 'mock-member-priya', name: 'Priya N.', active: true },
  { id: 'mock-member-hana', name: 'Hana L.', active: true },
];

export const LINEAR_PICKER_ANSWERS: Readonly<Record<string, () => unknown>> = {
  linear_fetch_team_states: () => STATES,
  linear_fetch_team_members: () => MEMBERS,
};
